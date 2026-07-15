'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { caseReward, MAX_BALANCE, type CaseDrop } from '@/lib/game-logic'
import { playArcadeStart, playUpgradeResult, stopSpinSound } from '@/lib/game-audio'
import { money, secureRandomValue, type GameState, type Skin } from '@/lib/game-model'
import { trackResult, trackWager } from '@/lib/casino-system'
import { instanceId, Mark, SkinImage } from '@/components/game/shared'

const CELL = 136 // 128px card + 8px gap
const REEL_LENGTH = 56
const WINNER_INDEX = 48
const SPIN_MS = 5400

type ReelCell = { skin: Skin; key: string }

// Build the visual strip: weighted filler biased cheap with occasional expensive teasers.
function buildReel(allSkins: Skin[], casePrice: number, drop: CaseDrop, random: () => number): ReelCell[] {
  const nearest = (desired: number) => allSkins.reduce<Skin | null>((best, item) => !best || Math.abs(item.price - desired) < Math.abs(best.price - desired) ? item : best, null)!
  const cells: ReelCell[] = []
  for (let index = 0; index < REEL_LENGTH; index += 1) {
    if (index === WINNER_INDEX) { cells.push({ skin: drop.item, key: `win-${index}` }); continue }
    const roll = random()
    const desired = roll < 0.55 ? casePrice * (0.15 + random() * 0.4) : roll < 0.85 ? casePrice * (0.6 + random() * 0.9) : roll < 0.97 ? casePrice * (2 + random() * 5) : casePrice * (12 + random() * 20)
    cells.push({ skin: nearest(desired), key: `cell-${index}` })
  }
  // Near-miss staging: on scrap/break-even drops, park a jackpot-tier item right next
  // to the winner so the pointer stops a hair away from it. Pure presentation —
  // the outcome was decided before the reel started moving.
  if ((drop.tier === 'scrap' || drop.tier === 'break-even') && random() < 0.5) {
    const side = random() < 0.5 ? WINNER_INDEX - 1 : WINNER_INDEX + 1
    cells[side] = { skin: nearest(casePrice * (15 + random() * 25)), key: `tease-${side}` }
  }
  return cells
}

type Props = { state: GameState; setState: React.Dispatch<React.SetStateAction<GameState>>; allSkins: Skin[]; operationLock: boolean; setOperationLock: React.Dispatch<React.SetStateAction<boolean>>; sound: boolean }

export function CasesMode({ state, setState, allSkins, operationLock, setOperationLock, sound }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const roundTimer = useRef<number | null>(null)
  const roundToken = useRef(0)
  const [casePrice, setCasePrice] = useState(500)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('PICK A CASE AND OPEN IT')
  const [reel, setReel] = useState<ReelCell[]>([])
  const [translate, setTranslate] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [drop, setDrop] = useState<CaseDrop | null>(null)
  const [session, setSession] = useState({ rounds: 0, wins: 0, profit: 0, streak: 0 })

  useEffect(() => () => {
    roundToken.current += 1
    if (roundTimer.current) window.clearTimeout(roundTimer.current)
    stopSpinSound()
    setOperationLock(false)
  }, [setOperationLock])

  const idleReel = useMemo<ReelCell[]>(() => {
    const sorted = [...allSkins].sort((a, b) => a.price - b.price)
    return Array.from({ length: 14 }, (_, index) => ({ skin: sorted[Math.min(sorted.length - 1, index * 7)], key: `idle-${index}` }))
  }, [allSkins])

  const openCase = () => {
    if (operationLock || playing || casePrice > state.balance) return
    const random = () => secureRandomValue()
    const decided = caseReward(allSkins, casePrice, random, state.casino.lossStreak)
    if (!decided) return
    const cells = buildReel(allSkins, casePrice, decided, random)
    setOperationLock(true)
    setPlaying(true)
    setDrop(null)
    setStatus('OPENING...')
    setState((current) => {
      const tracked = trackWager(current.casino, casePrice, secureRandomValue)
      return { ...current, balance: Math.min(MAX_BALANCE, current.balance - casePrice + tracked.bonus), casino: tracked.casino }
    })
    playArcadeStart(sound, 'cases', SPIN_MS)
    // Mount reel at start position, then roll to the winner on the next frame.
    setReel(cells)
    setSpinning(false)
    setTranslate(0)
    const viewportWidth = viewportRef.current?.clientWidth ?? 900
    const offsetInCell = (random() * 0.5 - 0.25) * CELL // stop point jitter inside the cell
    const target = WINNER_INDEX * CELL + CELL / 2 - viewportWidth / 2 + offsetInCell
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => { setSpinning(true); setTranslate(-target) }))
    const token = ++roundToken.current
    roundTimer.current = window.setTimeout(() => {
      if (token !== roundToken.current) return
      const item = decided.item
      setState((current) => ({ ...current, inventory: [...current.inventory, instanceId(item.id)], casino: trackResult(current.casino, casePrice, item.price) }))
      setDrop(decided)
      setSession((current) => ({ rounds: current.rounds + 1, wins: current.wins + (item.price > casePrice ? 1 : 0), profit: current.profit + item.price - casePrice, streak: item.price > casePrice ? (current.streak > 0 ? current.streak + 1 : 1) : (current.streak < 0 ? current.streak - 1 : -1) }))
      setPlaying(false)
      setOperationLock(false)
      stopSpinSound()
      playUpgradeResult(sound, item.price > casePrice)
      setStatus(decided.tier === 'jackpot' ? '★ JACKPOT DROP ★' : decided.tier === 'big' ? 'RARE DROP!' : `${item.weapon} · ${item.name}`)
    }, SPIN_MS)
  }

  const cells = reel.length ? reel : idleReel
  return <><div className="wordmark"><Mark/><b>CASES</b></div><section className="arcade-mode arcade-cases">
    <div className="arcade-hero"><span>SOLO GAME</span><h1>CASES</h1><p>{status}</p>
      <div className="case-reel" ref={viewportRef}>
        <i className="case-reel-pointer" aria-hidden="true"/>
        <div className={`case-reel-track ${spinning ? 'is-spinning' : ''}`} style={{ transform: `translateX(${translate}px)`, transitionDuration: spinning ? `${SPIN_MS}ms` : '0ms' }}>
          {cells.map(({ skin, key }) => <div key={key} className={`case-reel-cell ${skin.rarity}`}><SkinImage src={skin.image} alt={`${skin.weapon} ${skin.name}`}/><span>{skin.weapon}</span><b>{money(skin.price)}</b></div>)}
        </div>
        <i className="case-reel-fade left" aria-hidden="true"/>
        <i className="case-reel-fade right" aria-hidden="true"/>
      </div>
      {drop && <div className={`case-drop-result tier-${drop.tier}`}>
        <SkinImage src={drop.item.image} alt={`${drop.item.weapon} ${drop.item.name}`} priority/>
        <div><b>{drop.item.weapon} · {drop.item.name}</b><strong>{money(drop.item.price)} <Mark small/></strong><span>{drop.item.price > casePrice ? `+${money(drop.item.price - casePrice)} PROFIT` : `${money(drop.item.price - casePrice)} NET`}</span></div>
      </div>}
    </div>
    <aside className="arcade-panel">
      <div className="session-pulse" aria-label="Current session statistics"><div><span>SESSION</span><b>{session.rounds} rounds</b></div><div><span>HIT RATE</span><b>{session.rounds ? Math.round(session.wins / session.rounds * 100) : 0}%</b></div><div><span>{session.streak >= 0 ? 'HOT STREAK' : 'COLD STREAK'}</span><b>{Math.abs(session.streak)}×</b></div><div><span>NET</span><b className={session.profit >= 0 ? 'positive' : 'negative'}>{session.profit >= 0 ? '+' : ''}{money(session.profit)}</b></div></div>
      <span>CASE PRICE</span><strong>{money(casePrice)}</strong>
      <div className="case-prices">{[250, 500, 1000, 2500].map((price) => <button key={price} className={casePrice === price ? 'active' : ''} disabled={playing} onClick={() => setCasePrice(price)}>{money(price)}</button>)}</div>
      <button className="arcade-play" disabled={playing || operationLock || casePrice > state.balance} onClick={openCase}>{playing ? 'OPENING...' : `OPEN CASE · ${money(casePrice)}`}</button>
    </aside>
  </section></>
}
