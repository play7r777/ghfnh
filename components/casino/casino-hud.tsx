'use client'

import { useEffect, useRef, useState } from 'react'
import { Crown, Flame, Gem, Gift, Sparkles, Target, TrendingUp, Trophy, X, Zap } from 'lucide-react'
import {
  claimDailyBonus, claimMission, claimRakeback, DAILY_MISSIONS, dailyBonusValue, generateLiveWin,
  levelProgress, onCasinoEvent, rolloverMissions, simulatedOnline, todayKey, VIP_TIERS, vipTier,
  type CasinoEvent, type CasinoState, type LiveWin,
} from '@/lib/casino-system'
import { money, secureRandomValue, type GameState } from '@/lib/game-model'
import { MAX_BALANCE } from '@/lib/game-logic'
import { playUpgradeResult } from '@/lib/game-audio'

type SetState = React.Dispatch<React.SetStateAction<GameState>>

// ---- Header widgets ----

export function JackpotTicker({ jackpot }: { jackpot: number }) {
  const [shown, setShown] = useState(jackpot)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setShown((current) => current + (jackpot - current) * 0.2 + 0.4)
    }, 120)
    return () => window.clearInterval(timer)
  }, [jackpot])
  return (
    <div className="jackpot-ticker" title="Progressive jackpot — every bet feeds it">
      <Gem aria-hidden="true" />
      <div>
        <span>JACKPOT</span>
        <b>{money(Math.min(shown, jackpot + 5))}</b>
      </div>
    </div>
  )
}

export function OnlineCounter() {
  const [online, setOnline] = useState<number | null>(null)
  useEffect(() => {
    setOnline(simulatedOnline())
    const timer = window.setInterval(() => setOnline(simulatedOnline()), 4000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <div className="top-stat online-stat">
      <span><i className="online-dot" aria-hidden="true" />Online</span>
      <b>{online === null ? '—' : online.toLocaleString('ru-RU')}</b>
    </div>
  )
}

export function LevelBadge({ casino, onOpen }: { casino: CasinoState; onOpen: () => void }) {
  const { level, progress } = levelProgress(casino.xp)
  const tier = vipTier(level)
  return (
    <button className="level-badge" onClick={onOpen} aria-label={`Level ${level}, ${tier.name} VIP. Open rewards`} style={{ '--tier-color': tier.color } as React.CSSProperties}>
      <span className="level-ring" aria-hidden="true" style={{ '--progress': `${Math.round(progress * 100)}%` } as React.CSSProperties}>
        <b>{level}</b>
      </span>
      <span className="level-tier">
        <Crown aria-hidden="true" />
        {tier.name}
      </span>
    </button>
  )
}

// ---- Live wins ticker strip ----

export function LiveWinsTicker() {
  const [wins, setWins] = useState<LiveWin[]>([])
  useEffect(() => {
    setWins(Array.from({ length: 9 }, () => generateLiveWin(secureRandomValue)))
    let timer: number
    const push = () => {
      setWins((current) => [generateLiveWin(secureRandomValue), ...current].slice(0, 12))
      timer = window.setTimeout(push, 2200 + secureRandomValue() * 4800)
    }
    timer = window.setTimeout(push, 3000)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div className="live-wins" aria-label="Live wins across the casino">
      <div className="live-wins-label"><Zap aria-hidden="true" /><span>LIVE</span></div>
      <div className="live-wins-track">
        {wins.map((win) => (
          <article key={win.id} className={win.multiplier >= 20 ? 'hot' : ''}>
            <b>{win.player}</b>
            <span>{win.game}</span>
            <strong>{money(win.payout)}</strong>
            <em>{win.multiplier.toFixed(2)}x</em>
          </article>
        ))}
      </div>
    </div>
  )
}

// ---- Toasts + big win overlay ----

type Toast = { id: number; event: CasinoEvent }
let toastId = 0

export function CasinoEventLayer({ sound }: { sound: boolean }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [bigWin, setBigWin] = useState<{ payout: number; multiplier: number; mega: boolean } | null>(null)
  const soundRef = useRef(sound)
  soundRef.current = sound

  useEffect(() => onCasinoEvent((event) => {
    if (event.type === 'big-win') {
      setBigWin({ payout: event.payout, multiplier: event.multiplier, mega: event.mega })
      playUpgradeResult(soundRef.current, true)
      return
    }
    if (event.type === 'jackpot') playUpgradeResult(soundRef.current, true)
    const id = ++toastId
    setToasts((current) => [...current.slice(-3), { id, event }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200)
  }), [])

  useEffect(() => {
    if (!bigWin) return
    const timer = window.setTimeout(() => setBigWin(null), 3400)
    return () => window.clearTimeout(timer)
  }, [bigWin])

  return (
    <>
      <div className="casino-toasts" aria-live="polite">
        {toasts.map(({ id, event }) => (
          <div key={id} className={`casino-toast toast-${event.type}`}>
            {event.type === 'level-up' && <><Sparkles aria-hidden="true" /><div><b>LEVEL {event.level}!</b><span>+{money(event.reward)} coins reward</span></div></>}
            {event.type === 'jackpot' && <><Gem aria-hidden="true" /><div><b>JACKPOT HIT!</b><span>+{money(event.amount)} coins</span></div></>}
            {event.type === 'mission' && <><Target aria-hidden="true" /><div><b>MISSION COMPLETE</b><span>{event.label} · claim +{money(event.reward)}</span></div></>}
            {event.type === 'streak' && <><Flame aria-hidden="true" /><div><b>{event.streak} WIN STREAK</b><span>+50% XP boost active</span></div></>}
            {event.type === 'tier-up' && <><Crown aria-hidden="true" /><div><b>{event.tier} VIP</b><span>Higher rakeback unlocked</span></div></>}
          </div>
        ))}
      </div>
      {bigWin && (
        <div className={`big-win-overlay ${bigWin.mega ? 'mega' : ''}`} role="status" onClick={() => setBigWin(null)}>
          <div className="big-win-card">
            <div className="big-win-rays" aria-hidden="true" />
            <span>{bigWin.mega ? 'MEGA WIN' : 'BIG WIN'}</span>
            <b>{money(bigWin.payout)}</b>
            <em>{bigWin.multiplier.toFixed(2)}x</em>
            <div className="big-win-coins" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--n': index } as React.CSSProperties} />)}</div>
          </div>
        </div>
      )}
    </>
  )
}

// ---- Rewards hub modal ----

export function RewardsModal({ state, setState, onClose }: { state: GameState; setState: SetState; onClose: () => void }) {
  const [lock, setLock] = useState(false)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const casino = rolloverMissions(state.casino)
  const { level, progress, currentXp, neededXp } = levelProgress(casino.xp)
  const tier = vipTier(level)
  const nextTier = VIP_TIERS.find((item) => item.minLevel > level)
  const dailyClaimed = casino.lastDailyClaim === todayKey()
  const nextDaily = dailyBonusValue(casino.dailyStreak, level)
  const rakeAvailable = Math.floor(casino.rakeback)

  const withLock = (action: () => void) => {
    if (lock) return
    setLock(true)
    action()
    window.setTimeout(() => setLock(false), 400)
  }

  const claimDaily = () => withLock(() => setState((current) => {
    const { casino: next, reward } = claimDailyBonus(rolloverMissions(current.casino))
    if (!reward) return current
    return { ...current, casino: next, balance: Math.min(MAX_BALANCE, current.balance + reward) }
  }))

  const claimRake = () => withLock(() => setState((current) => {
    const { casino: next, reward } = claimRakeback(current.casino)
    if (!reward) return current
    return { ...current, casino: next, balance: Math.min(MAX_BALANCE, current.balance + reward) }
  }))

  const claimMissionReward = (missionId: string) => withLock(() => setState((current) => {
    const { casino: next, reward } = claimMission(rolloverMissions(current.casino), missionId)
    if (!reward) return current
    return { ...current, casino: next, balance: Math.min(MAX_BALANCE, current.balance + reward) }
  }))

  const hitRate = casino.roundsPlayed ? Math.round((casino.roundsWon / casino.roundsPlayed) * 100) : 0

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal modal-wide rewards-modal" role="dialog" aria-modal="true" aria-label="Rewards hub">
        <div className="modal-title"><h2>REWARDS HUB</h2><button onClick={onClose} aria-label="Close"><X /></button></div>

        <div className="rewards-vip" style={{ '--tier-color': tier.color } as React.CSSProperties}>
          <div className="vip-crest"><Crown aria-hidden="true" /><b>{tier.name}</b></div>
          <div className="vip-progress">
            <div className="vip-progress-top">
              <span>LEVEL {level}</span>
              <span>{currentXp.toLocaleString('ru-RU')} / {neededXp.toLocaleString('ru-RU')} XP</span>
            </div>
            <div className="vip-bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress * 100}%` }} /></div>
            <p>{nextTier ? `${nextTier.name} VIP at level ${nextTier.minLevel}` : 'Maximum VIP tier reached'} · rakeback {(tier.rakeback * 100).toFixed(0)}% · daily boost x{tier.dailyBoost}</p>
          </div>
        </div>

        <div className="rewards-claims">
          <article className={dailyClaimed ? 'claimed' : ''}>
            <Gift aria-hidden="true" />
            <div>
              <b>DAILY BONUS</b>
              <span>{casino.dailyStreak > 0 ? `${casino.dailyStreak} day streak` : 'Start your streak'} · next: {money(nextDaily)}</span>
            </div>
            <button className="yellow-button" disabled={dailyClaimed || lock} onClick={claimDaily}>{dailyClaimed ? 'CLAIMED TODAY' : `CLAIM ${money(nextDaily)}`}</button>
          </article>
          <article className={rakeAvailable < 1 ? 'claimed' : ''}>
            <TrendingUp aria-hidden="true" />
            <div>
              <b>RAKEBACK {(tier.rakeback * 100).toFixed(0)}%</b>
              <span>Cash returned from every bet you place</span>
            </div>
            <button className="yellow-button" disabled={rakeAvailable < 1 || lock} onClick={claimRake}>{rakeAvailable < 1 ? 'KEEP PLAYING' : `CLAIM ${money(rakeAvailable)}`}</button>
          </article>
        </div>

        <div className="rewards-missions">
          <div className="rewards-section-title"><Target aria-hidden="true" /><b>DAILY MISSIONS</b><span>Reset at midnight</span></div>
          {DAILY_MISSIONS.map((mission) => {
            const done = (casino.missionProgress[mission.id] ?? 0)
            const complete = done >= mission.goal
            const claimed = casino.missionsClaimed.includes(mission.id)
            return (
              <article key={mission.id} className={claimed ? 'claimed' : complete ? 'complete' : ''}>
                <div>
                  <b>{mission.label}</b>
                  <div className="mission-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (done / mission.goal) * 100)}%` }} /></div>
                  <span>{Math.floor(done).toLocaleString('ru-RU')} / {mission.goal.toLocaleString('ru-RU')}</span>
                </div>
                <button disabled={!complete || claimed || lock} onClick={() => claimMissionReward(mission.id)}>{claimed ? 'DONE' : `+${money(mission.reward)}`}</button>
              </article>
            )
          })}
        </div>

        <div className="rewards-stats">
          <div className="rewards-section-title"><Trophy aria-hidden="true" /><b>LIFETIME STATS</b></div>
          <div className="rewards-stats-grid">
            <div><span>WAGERED</span><b>{money(casino.totalWagered)}</b></div>
            <div><span>WON</span><b>{money(casino.totalWon)}</b></div>
            <div><span>BIGGEST WIN</span><b>{money(casino.biggestWin)}</b></div>
            <div><span>HIT RATE</span><b>{hitRate}%</b></div>
            <div><span>BEST STREAK</span><b>{casino.bestStreak}x</b></div>
            <div><span>JACKPOTS</span><b>{casino.jackpotWins}</b></div>
          </div>
        </div>
      </section>
    </div>
  )
}
