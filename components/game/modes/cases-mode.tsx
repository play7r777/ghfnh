'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MAX_BALANCE, rarityColor } from '@/lib/game-logic'
import { playArcadeStart, playUpgradeResult, stopSpinSound } from '@/lib/game-audio'
import { money, secureRandomValue, type GameState, type Skin } from '@/lib/game-model'
import { trackResult, trackWager } from '@/lib/casino-system'
import { instanceId, Mark, SkinImage } from '@/components/game/shared'

const CELL = 136 // 128px card + 8px gap
// A long strip with a deep trailing buffer so the reel never stops in an empty
// void — even on ultra-wide screens the winner stays centered with cards on both sides.
const REEL_LENGTH = 90
const WINNER_INDEX = 68
const SPIN_MS = 5400

// ---- Cases ----
type CaseDef = { id: string; name: string; price: number; accent: string; tag: string }
const CASES: CaseDef[] = [
  { id: 'starter', name: 'STARTER CASE', price: 150,   accent: '#5e98d9', tag: 'ENTRY' },
  { id: 'street',  name: 'STREET CASE',  price: 400,   accent: '#4b69ff', tag: 'COMMON' },
  { id: 'urban',   name: 'URBAN CASE',   price: 900,   accent: '#8847ff', tag: 'RARE' },
  { id: 'elite',   name: 'ELITE CASE',   price: 2000,  accent: '#d32ce6', tag: 'ELITE' },
  { id: 'covert',  name: 'COVERT CASE',  price: 5000,  accent: '#eb4b4b', tag: 'COVERT' },
  { id: 'dragon',  name: 'DRAGON CASE',  price: 12000, accent: '#e4ae39', tag: 'PREMIUM' },
  { id: 'prime',   name: 'PRIME CASE',   price: 30000, accent: '#eb4b4b', tag: 'HIGH ROLLER' },
  { id: 'mythic',  name: 'MYTHIC CASE',  price: 90000, accent: '#e4ae39', tag: 'MYTHIC' },
]

// Weighted drop tiers relative to the case price. Probabilities sum to 1 and the
// blended payout lands well below the case price (~80% RTP) so opening cases can no
// longer print guaranteed profit — the earlier "250 case always drops 500" abuse.
type Tier = { key: 'blue' | 'purple' | 'pink' | 'red' | 'gold'; prob: number; lo: number; hi: number }
const TIERS: Tier[] = [
  { key: 'blue',   prob: 0.784, lo: 0.05, hi: 0.55 },
  { key: 'purple', prob: 0.160, lo: 0.55, hi: 1.40 },
  { key: 'pink',   prob: 0.040, lo: 1.40, hi: 4.00 },
  { key: 'red',    prob: 0.012, lo: 4.00, hi: 16.0 },
  { key: 'gold',   prob: 0.004, lo: 16.0, hi: 70.0 },
]

type ReelCell = { skin: Skin; key: string }
type Drop = { item: Skin; tier: Tier['key'] }
type TierPool = Tier & { pool: Skin[] }

function nearest(skins: Skin[], desired: number): Skin | null {
  return skins.reduce<Skin | null>((best, item) => !best || Math.abs(item.price - desired) < Math.abs(best.price - desired) ? item : best, null)
}

// Split the live catalog into this case's rarity bands.
function buildPools(allSkins: Skin[], price: number): TierPool[] {
  const usable = allSkins.filter((skin) => skin.image && Number.isFinite(skin.price) && skin.price > 0)
  return TIERS.map((tier) => {
    const lo = price * tier.lo
    const hi = price * tier.hi
    let pool = usable.filter((skin) => skin.price >= lo && skin.price <= hi)
    if (!pool.length) {
      const mid = nearest(usable, price * (tier.lo + tier.hi) / 2)
      pool = mid ? [mid] : []
    }
    return { ...tier, pool }
  })
}

// Roll a real drop from the weighted tiers.
function rollDrop(pools: TierPool[], random: () => number): Drop | null {
  const roll = random()
  let acc = 0
  for (const tier of pools) {
    acc += tier.prob
    if (roll < acc && tier.pool.length) return { item: tier.pool[Math.floor(random() * tier.pool.length)], tier: tier.key }
  }
  for (let i = pools.length - 1; i >= 0; i -= 1) if (pools[i].pool.length) return { item: pools[i].pool[0], tier: pools[i].key }
  return null
}

// Build the visual strip from the SAME case pools (mostly common, occasional teasers),
// with the decided winner locked at WINNER_INDEX.
function buildReel(pools: TierPool[], drop: Drop, random: () => number): ReelCell[] {
  const cells: ReelCell[] = []
  for (let index = 0; index < REEL_LENGTH; index += 1) {
    if (index === WINNER_INDEX) { cells.push({ skin: drop.item, key: `win-${index}` }); continue }
    cells.push({ skin: rollDrop(pools, random)?.item ?? drop.item, key: `cell-${index}` })
  }
  return cells
}

type Props = { state: GameState; setState: React.Dispatch<React.SetStateAction<GameState>>; allSkins: Skin[]; operationLock: boolean; setOperationLock: React.Dispatch<React.SetStateAction<boolean>>; sound: boolean }

export function CasesMode({ state, setState, allSkins, operationLock, setOperationLock, sound }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const roundTimer = useRef<number | null>(null)
  const roundToken = useRef(0)
  const [caseId, setCaseId] = useState(CASES[0].id)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('PICK A CASE AND OPEN IT')
  const [reel, setReel] = useState<ReelCell[]>([])
  const [translate, setTranslate] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [drop, setDrop] = useState<Drop | null>(null)
  const [session, setSession] = useState({ rounds: 0, wins: 0, profit: 0, streak: 0 })

  const activeCase = CASES.find((item) => item.id === caseId) ?? CASES[0]
  const casePrice = activeCase.price
  const pools = useMemo(() => buildPools(allSkins, casePrice), [allSkins, casePrice])

  useEffect(() => () => {
    roundToken.current += 1
    if (roundTimer.current) window.clearTimeout(roundTimer.current)
    stopSpinSound()
    setOperationLock(false)
  }, [setOperationLock])

  const idleReel = useMemo<ReelCell[]>(() => {
    const flat = pools.flatMap((tier) => tier.pool)
    const sorted = (flat.length ? [...new Set(flat)] : [...allSkins]).sort((a, b) => a.price - b.price)
    if (!sorted.length) return []
    return Array.from({ length: 16 }, (_, index) => ({ skin: sorted[Math.min(sorted.length - 1, Math.floor(index * sorted.length / 16))], key: `idle-${index}` }))
  }, [pools, allSkins])

  const openCase = () => {
    if (operationLock || playing || casePrice > state.balance) return
    const random = () => secureRandomValue()
    const decided = rollDrop(pools, random)
    if (!decided) return
    const cells = buildReel(pools, decided, random)
    setOperationLock(true)
    setPlaying(true)
    setDrop(null)
    setStatus('OPENING...')
    setState((current) => {
      const tracked = trackWager(current.casino, casePrice)
      return { ...current, balance: Math.min(MAX_BALANCE, current.balance - casePrice), casino: tracked.casino }
    })
    playArcadeStart(sound, 'cases', SPIN_MS)
    setReel(cells)
    setSpinning(false)
    setTranslate(0)
    const jitter = random() * 0.4 - 0.2 // stop-point jitter within the winner cell (-0.2..0.2)
    // Wait until the freshly-built strip is really in the DOM, then measure the REAL
    // winner-cell position. Two bugs are fixed here:
    //   1) VOID: card width is responsive (128px / 110px) and the reel is only ever
    //      as long as REEL_LENGTH cells. If we measured the stale idle strip (or used a
    //      hardcoded step) the pointer could overshoot past the last card and stop on
    //      empty grey. We retry across frames until the winner cell exists, and clamp
    //      the stop point so it can never scroll beyond the real content.
    //   2) FROZEN: resetting to 0 and setting the target in the same paint made the
    //      browser skip the CSS transition. Forcing a reflow between the reset and the
    //      target guarantees the reel actually animates every time.
    const animate = (attempt: number) => {
      const track = trackRef.current
      const viewport = viewportRef.current
      const winnerEl = track?.querySelector('[data-winner="true"]') as HTMLElement | null
      if ((!track || !viewport || !winnerEl) && attempt < 8) {
        window.requestAnimationFrame(() => animate(attempt + 1))
        return
      }
      const viewportWidth = viewport?.clientWidth ?? 900
      const cellWidth = winnerEl?.offsetWidth ?? CELL
      const trackWidth = track?.scrollWidth ?? REEL_LENGTH * cellWidth
      const winnerCenter = winnerEl ? winnerEl.offsetLeft + cellWidth / 2 : WINNER_INDEX * CELL + CELL / 2
      const maxTarget = Math.max(0, trackWidth - viewportWidth)
      const target = Math.min(Math.max(0, winnerCenter - viewportWidth / 2 + jitter * cellWidth), maxTarget)
      if (track) void track.offsetWidth // force reflow so translate:0 is committed before we animate
      setSpinning(true)
      setTranslate(-target)
    }
    window.requestAnimationFrame(() => animate(0))
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
      setStatus(decided.tier === 'gold' ? '★ JACKPOT DROP ★' : decided.tier === 'red' ? 'RARE DROP!' : `${item.weapon} · ${item.name}`)
    }, SPIN_MS)
  }

  const cells = reel.length ? reel : idleReel
  return <><div className="wordmark"><Mark/><b>CASES</b></div><section className="arcade-mode arcade-cases">
    <div className="arcade-hero"><span>SOLO GAME</span><h1>{activeCase.name}</h1><p>{status}</p>
      <div className="case-reel" ref={viewportRef}>
        <i className="case-reel-pointer" aria-hidden="true"/>
        <div ref={trackRef} className={`case-reel-track ${spinning ? 'is-spinning' : ''}`} style={{ transform: `translateX(${translate}px)`, transitionDuration: spinning ? `${SPIN_MS}ms` : '0ms' }}>
          {cells.map(({ skin, key }) => <div key={key} data-winner={key.startsWith('win-') ? 'true' : undefined} className={`case-reel-cell ${skin.rarity}`} style={{ borderColor: rarityColor(skin) }}><SkinImage src={skin.image} alt={`${skin.weapon} ${skin.name}`}/><span>{skin.weapon}</span><b>{money(skin.price)}</b></div>)}
        </div>
        <i className="case-reel-fade left" aria-hidden="true"/>
        <i className="case-reel-fade right" aria-hidden="true"/>
      </div>
      {drop && <div className={`case-drop-result tier-${drop.tier}`} style={{ borderColor: rarityColor(drop.item) }}>
        <SkinImage src={drop.item.image} alt={`${drop.item.weapon} ${drop.item.name}`} priority/>
        <div><b>{drop.item.weapon} · {drop.item.name}</b><strong>{money(drop.item.price)} <Mark small/></strong><span>{drop.item.price > casePrice ? `+${money(drop.item.price - casePrice)} PROFIT` : `${money(drop.item.price - casePrice)} NET`}</span></div>
      </div>}
    </div>
    <aside className="arcade-panel">
      <div className="session-pulse" aria-label="Current session statistics"><div><span>SESSION</span><b>{session.rounds} rounds</b></div><div><span>HIT RATE</span><b>{session.rounds ? Math.round(session.wins / session.rounds * 100) : 0}%</b></div><div><span>{session.streak >= 0 ? 'HOT STREAK' : 'COLD STREAK'}</span><b>{Math.abs(session.streak)}×</b></div><div><span>NET</span><b className={session.profit >= 0 ? 'positive' : 'negative'}>{session.profit >= 0 ? '+' : ''}{money(session.profit)}</b></div></div>
      <span>SELECT A CASE</span>
      <div className="case-picker">{CASES.map((item) => <button key={item.id} className={`case-pick ${caseId === item.id ? 'active' : ''}`} style={{ '--case-accent': item.accent } as React.CSSProperties} disabled={playing} onClick={() => { setCaseId(item.id); setReel([]); setDrop(null); setSpinning(false); setTranslate(0); setStatus('PICK A CASE AND OPEN IT') }}><b>{item.name}</b><em>{item.tag}</em><strong>{money(item.price)}</strong></button>)}</div>
      <button className="arcade-play" disabled={playing || operationLock || casePrice > state.balance} onClick={openCase}>{playing ? 'OPENING...' : `OPEN CASE · ${money(casePrice)}`}</button>
      <small>Balance: {money(state.balance)} coins</small>
    </aside>
  </section></>
}
