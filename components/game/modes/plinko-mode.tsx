'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bodies, Body, Composite, Engine } from 'matter-js'
import { CircleDollarSign, Gauge, History } from 'lucide-react'
import { MAX_BALANCE, PLINKO_MULTIPLIERS, PLINKO_ROWS, createPlinkoPath, plinkoMultiplier, plinkoSlotFromPath, type PlinkoRisk, type PlinkoStep } from '@/lib/game-logic'
import { money, secureRandomValue, type GameState } from '@/lib/game-model'
import { playArcadeStart, playUpgradeResult } from '@/lib/game-audio'
import { trackResult, trackWager } from '@/lib/casino-system'

type Props = {
  state: GameState
  setState: React.Dispatch<React.SetStateAction<GameState>>
  operationLock: boolean
  setOperationLock: React.Dispatch<React.SetStateAction<boolean>>
  sound: boolean
}

type DropResult = { id: string; slot: number; multiplier: number; risk: PlinkoRisk; payout: number }
type ActiveBall = { id: string; risk: PlinkoRisk; wager: number; launchedAt: number; seed: number; path: PlinkoStep[]; targetSlot: number }
const risks: PlinkoRisk[] = ['low', 'medium', 'high']
const DROP_DURATION = 5000

function Ball({ ball, boardRef, onLanded }: { ball: ActiveBall; boardRef: React.RefObject<HTMLDivElement | null>; onLanded: (ball: ActiveBall, slot: number) => void }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = ref.current
    const board = boardRef.current
    if (!element || !board) return

    const width = board.clientWidth
    const height = board.clientHeight
    const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.00155 } })
    engine.positionIterations = 10
    engine.velocityIterations = 8

    const pegRadius = Math.max(3, width * 0.0046)
    const ballRadius = Math.max(7, width * 0.0105)
    const gridLeft = width * 0.025
    const gridWidth = width * 0.95
    const top = height * 0.055
    const bottom = height * 0.835
    const rowGap = (bottom - top) / (PLINKO_ROWS - 1)
    const pegs = []

    for (let row = 0; row < PLINKO_ROWS; row += 1) {
      const count = row + 3
      const rowWidth = Math.min(width * (0.16 + row * 0.05), width * 0.92)
      const startX = width / 2 - rowWidth / 2
      for (let index = 0; index < count; index += 1) {
        const x = count === 1 ? width / 2 : startX + (rowWidth * index) / (count - 1)
        pegs.push(Bodies.circle(x, top + row * rowGap, pegRadius, {
          isStatic: true,
          restitution: 0.72,
          friction: 0,
          label: 'peg',
        }))
      }
    }

    const body = Bodies.circle(width / 2 + (ball.seed - 0.5) * pegRadius * 0.45, height * 0.018, ballRadius, {
      restitution: 0.68,
      friction: 0.002,
      frictionAir: 0.005,
      density: 0.0022,
      slop: 0.01,
      label: 'ball',
    })
    Body.setVelocity(body, { x: (ball.seed - 0.5) * 0.32, y: 0.25 })

    const walls = [
      Bodies.rectangle(gridLeft - 20, height / 2, 40, height, { isStatic: true, restitution: 0.5 }),
      Bodies.rectangle(gridLeft + gridWidth + 20, height / 2, 40, height, { isStatic: true, restitution: 0.5 }),
    ]
    Composite.add(engine.world, [...pegs, ...walls, body])

    let frame = 0
    let last = performance.now()
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      onLanded(ball, ball.targetSlot)
    }
    const tick = (now: number) => {
      const delta = Math.min(24, now - last)
      last = now
      Engine.update(engine, delta)

      const progress = Math.max(0, Math.min(1, (body.position.y - top) / (bottom - top)))
      const resolvedRows = Math.min(PLINKO_ROWS, Math.floor(progress * PLINKO_ROWS))
      const rightSteps = ball.path.slice(0, resolvedRows).filter((step) => step === 1).length
      const branchOffset = rightSteps - resolvedRows / 2
      const targetX = width / 2 + branchOffset * (width / (PLINKO_ROWS + 1))
      const correction = Math.max(-0.38, Math.min(0.38, (targetX - body.position.x) * 0.006))
      Body.setVelocity(body, {
        x: Math.max(-3.8, Math.min(3.8, body.velocity.x * 0.985 + correction)),
        y: body.velocity.y,
      })

      element.style.transform = `translate3d(${body.position.x - ballRadius}px,${body.position.y - ballRadius}px,0) rotate(${body.angle}rad)`
      if (body.position.y >= height * 0.895 || now - ball.launchedAt > DROP_DURATION) finish()
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      Composite.clear(engine.world, false)
      Engine.clear(engine)
    }
  }, [ball, boardRef, onLanded])

  return <span ref={ref} className="plinko-ball" aria-hidden="true" />
}

export function PlinkoMode({ state, setState, operationLock, setOperationLock, sound }: Props) {
  const [bet, setBet] = useState(100)
  const [risk, setRisk] = useState<PlinkoRisk>('medium')
  const [balls, setBalls] = useState<ActiveBall[]>([])
  const [history, setHistory] = useState<DropResult[]>([])
  const [hotSlots, setHotSlots] = useState<number[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const balanceRef = useRef(state.balance)
  const pendingRef = useRef(new Map<string, number>())
  const multipliers = PLINKO_MULTIPLIERS[risk]
  const canPlay = bet > 0 && bet <= balanceRef.current

  useEffect(() => {
    balanceRef.current = state.balance
  }, [state.balance])

  useEffect(() => {
    return () => {
      const unsettled = [...pendingRef.current.values()].reduce((sum, payout) => sum + payout, 0)
      if (unsettled) {
        setState((current) => ({ ...current, balance: Math.min(MAX_BALANCE, current.balance + unsettled) }))
      }
      pendingRef.current.clear()
      setOperationLock(false)
    }
  }, [setOperationLock, setState])

  const updateBet = (value: number) => setBet(Math.min(balanceRef.current, Math.max(1, Math.floor(value) || 1)))

  const landed = useCallback(
    (ball: ActiveBall, slot: number) => {
      if (!pendingRef.current.has(ball.id)) return
      const multiplier = plinkoMultiplier(ball.risk, slot)
      const payout = Math.floor(ball.wager * multiplier)
      const result: DropResult = { id: ball.id, slot, multiplier, risk: ball.risk, payout }

      pendingRef.current.delete(ball.id)
      setState((current) => ({ ...current, balance: Math.min(MAX_BALANCE, current.balance + payout), casino: trackResult(current.casino, ball.wager, payout) }))
      setBalls((current) => current.filter((item) => item.id !== ball.id))
      setHistory((current) => [result, ...current].slice(0, 8))
      setHotSlots((current) => [...current, slot])

      window.setTimeout(() => {
        setHotSlots((current) => {
          const index = current.indexOf(slot)
          return index < 0 ? current : current.filter((_, itemIndex) => itemIndex !== index)
        })
      }, 420)

      playUpgradeResult(sound, payout > ball.wager)
    },
    [setState, sound]
  )

  const drop = () => {
    const wager = Math.floor(bet)
    if (wager < 1 || wager > balanceRef.current) return

    const path = createPlinkoPath(secureRandomValue)
    const ball: ActiveBall = {
      id: crypto.randomUUID(),
      risk,
      wager,
      launchedAt: performance.now(),
      seed: secureRandomValue(),
      path,
      targetSlot: plinkoSlotFromPath(path),
    }

    balanceRef.current -= wager
    pendingRef.current.set(ball.id, wager)
    setState((current) => {
      const tracked = trackWager(current.casino, wager)
      return { ...current, balance: Math.min(MAX_BALANCE, current.balance - wager), casino: tracked.casino }
    })
    setBalls((current) => [...current, ball])
    playArcadeStart(sound, 'plinko', DROP_DURATION)
  }

  return (
    <div className="plinko-mode">
      <div className="wordmark">
        <span className="mark" aria-hidden="true">
          <i />
          <i />
        </span>
        <b>PLINKO</b>
      </div>
      <section className="plinko-layout">
        <div className="plinko-game-card">
          <div className="plinko-intro">
            <div>
              <span>16 ROWS · UNLIMITED DROPS</span>
              <h1>DROP. BOUNCE. WIN.</h1>
            </div>
            <p aria-live="polite">
              {balls.length ? `${balls.length} BALL${balls.length === 1 ? '' : 'S'} IN PLAY` : 'READY TO DROP'}
            </p>
          </div>
          <div ref={boardRef} className="plinko-board" aria-label={`Plinko board, ${risk} risk`}>
            <div className="plinko-drop-zone" aria-hidden="true">
              <i />
            </div>
            <div className="plinko-pegs" aria-hidden="true">
              {Array.from({ length: PLINKO_ROWS }, (_, row) => (
                <div className="plinko-row" key={row} style={{ '--row': row } as React.CSSProperties}>
                  {Array.from({ length: row + 3 }, (_, peg) => (
                    <i key={peg} />
                  ))}
                </div>
              ))}
            </div>
            {balls.map((ball) => (
              <Ball key={ball.id} ball={ball} boardRef={boardRef} onLanded={landed} />
            ))}
            <div className="plinko-slots">
              {multipliers.map((value, index) => (
                <div
                  key={index}
                  className={`${hotSlots.includes(index) ? 'active' : ''} edge-${Math.abs(index - 8)}`}
                >
                  <b>{value}x</b>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="plinko-panel">
          <div className="plinko-panel-heading">
            <Gauge />
            <div>
              <span>RISK PROFILE</span>
              <strong>{risk.toUpperCase()}</strong>
            </div>
          </div>
          <div className="plinko-risk" aria-label="Choose risk level">
            {risks.map((item) => (
              <button
                key={item}
                className={risk === item ? 'active' : ''}
                onClick={() => setRisk(item)}
                aria-pressed={risk === item}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="plinko-bet">
            <span>BET AMOUNT</span>
            <div>
              <CircleDollarSign />
              <input
                type="number"
                min="1"
                max={state.balance}
                value={bet}
                onChange={(event) => updateBet(Number(event.target.value))}
              />
            </div>
            <input
              aria-label="Bet amount slider"
              type="range"
              min="1"
              max={Math.max(1, state.balance)}
              value={Math.min(bet, Math.max(1, state.balance))}
              disabled={state.balance < 1}
              onChange={(event) => updateBet(Number(event.target.value))}
            />
          </label>
          <div className="plinko-quick">
            <button onClick={() => updateBet(bet / 2)}>½</button>
            <button onClick={() => updateBet(bet * 2)}>2×</button>
            <button onClick={() => updateBet(state.balance)}>MAX</button>
          </div>
          <div className="plinko-potential">
            <span>EDGE PAYOUT</span>
            <strong>{money(bet * Math.max(...multipliers))}</strong>
          </div>
          <button className="plinko-drop" disabled={!canPlay} onClick={drop}>
            DROP BALL <small>{balls.length ? `${balls.length} ACTIVE` : 'NO COOLDOWN'}</small>
          </button>
          <div className="plinko-history">
            <div>
              <History />
              <span>RECENT DROPS</span>
            </div>
            {history.length ? (
              <ul>
                {history.map((item) => (
                  <li key={item.id}>
                    <span>{item.risk}</span>
                    <b>{item.multiplier}x</b>
                    <strong>{money(item.payout)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Your drops will appear here.</p>
            )}
          </div>
        </aside>
      </section>
    </div>
  )
}
