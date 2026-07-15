// Casino engagement engine: XP/levels, VIP tiers, rakeback, progressive jackpot,
// daily missions, win streaks, daily login bonus, big-win events.

export const JACKPOT_SEED = 100_000
export const JACKPOT_CONTRIBUTION = 0.02
export const XP_PER_COIN = 0.1
export const BIG_WIN_MULTIPLIER = 8
export const MEGA_WIN_MULTIPLIER = 25

export type VipTier = { name: string; minLevel: number; rakeback: number; color: string; dailyBoost: number }
export const VIP_TIERS: VipTier[] = [
  { name: 'BRONZE', minLevel: 1, rakeback: 0.03, color: '#cd7f32', dailyBoost: 1 },
  { name: 'SILVER', minLevel: 8, rakeback: 0.05, color: '#c0c4cc', dailyBoost: 1.25 },
  { name: 'GOLD', minLevel: 20, rakeback: 0.07, color: '#ffcc00', dailyBoost: 1.5 },
  { name: 'PLATINUM', minLevel: 40, rakeback: 0.1, color: '#7fd4ff', dailyBoost: 2 },
  { name: 'DIAMOND', minLevel: 70, rakeback: 0.12, color: '#b388ff', dailyBoost: 3 },
]

export type MissionDef = { id: string; label: string; goal: number; reward: number; metric: 'wagered' | 'rounds' | 'wins' | 'streak' }
export const DAILY_MISSIONS: MissionDef[] = [
  { id: 'wager', label: 'Wager 25,000 coins', goal: 25_000, reward: 4_000, metric: 'wagered' },
  { id: 'rounds', label: 'Play 20 rounds', goal: 20, reward: 2_500, metric: 'rounds' },
  { id: 'wins', label: 'Win 6 rounds', goal: 6, reward: 3_500, metric: 'wins' },
  { id: 'streak', label: 'Hit a 3 win streak', goal: 3, reward: 5_000, metric: 'streak' },
]

export type CasinoState = {
  xp: number
  totalWagered: number
  totalWon: number
  roundsPlayed: number
  roundsWon: number
  biggestWin: number
  winStreak: number
  bestStreak: number
  lossStreak: number
  rakeback: number
  jackpot: number
  jackpotWins: number
  lastDailyClaim: string | null
  dailyStreak: number
  missionDate: string
  missionProgress: Record<string, number>
  missionsClaimed: string[]
  dayKey: string
  dayWon: number
  dayBestWin: number
}

export const initialCasino: CasinoState = {
  xp: 0, totalWagered: 0, totalWon: 0, roundsPlayed: 0, roundsWon: 0, biggestWin: 0,
  winStreak: 0, bestStreak: 0, lossStreak: 0, rakeback: 0, jackpot: JACKPOT_SEED, jackpotWins: 0,
  lastDailyClaim: null, dailyStreak: 0, missionDate: '', missionProgress: {}, missionsClaimed: [],
  dayKey: '', dayWon: 0, dayBestWin: 0,
}

const num = (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback

export function normalizeCasino(value: unknown): CasinoState {
  const raw = value && typeof value === 'object' ? (value as Partial<CasinoState>) : {}
  const progress: Record<string, number> = {}
  if (raw.missionProgress && typeof raw.missionProgress === 'object') {
    for (const mission of DAILY_MISSIONS) progress[mission.id] = num((raw.missionProgress as Record<string, unknown>)[mission.id], 0)
  }
  return {
    ...initialCasino,
    xp: num(raw.xp, 0), totalWagered: num(raw.totalWagered, 0), totalWon: num(raw.totalWon, 0),
    roundsPlayed: num(raw.roundsPlayed, 0), roundsWon: num(raw.roundsWon, 0), biggestWin: num(raw.biggestWin, 0),
    winStreak: num(raw.winStreak, 0, 10_000), bestStreak: num(raw.bestStreak, 0, 10_000), lossStreak: num(raw.lossStreak, 0, 10_000),
    rakeback: num(raw.rakeback, 0), jackpot: Math.max(JACKPOT_SEED, num(raw.jackpot, JACKPOT_SEED)),
    jackpotWins: num(raw.jackpotWins, 0), dailyStreak: num(raw.dailyStreak, 0, 365),
    lastDailyClaim: typeof raw.lastDailyClaim === 'string' && raw.lastDailyClaim.length <= 12 ? raw.lastDailyClaim : null,
    missionDate: typeof raw.missionDate === 'string' && raw.missionDate.length <= 12 ? raw.missionDate : '',
    missionProgress: progress,
    missionsClaimed: Array.isArray(raw.missionsClaimed) ? raw.missionsClaimed.filter((id): id is string => DAILY_MISSIONS.some((m) => m.id === id)).slice(0, 10) : [],
    dayKey: typeof raw.dayKey === 'string' && raw.dayKey.length <= 12 ? raw.dayKey : '',
    dayWon: num(raw.dayWon, 0), dayBestWin: num(raw.dayBestWin, 0),
  }
}

// --- Levels & VIP ---
export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1
export const xpForLevel = (level: number) => 120 * (level - 1) ** 2
export function levelProgress(xp: number) {
  const level = levelFromXp(xp)
  const current = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, progress: Math.min(1, (xp - current) / Math.max(1, next - current)), currentXp: Math.floor(xp - current), neededXp: next - current }
}
export function vipTier(level: number) {
  return [...VIP_TIERS].reverse().find((tier) => level >= tier.minLevel) ?? VIP_TIERS[0]
}
export const levelUpReward = (level: number) => 500 + level * 300

// --- Event bus (transient UI events: toasts, big win overlay) ---
export type CasinoEvent =
  | { type: 'level-up'; level: number; reward: number }
  | { type: 'jackpot'; amount: number }
  | { type: 'mission'; label: string; reward: number }
  | { type: 'big-win'; payout: number; multiplier: number; mega: boolean }
  | { type: 'streak'; streak: number }
  | { type: 'tier-up'; tier: string }

type Listener = (event: CasinoEvent) => void
const listeners = new Set<Listener>()
export function onCasinoEvent(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function emitCasinoEvent(event: CasinoEvent) {
  listeners.forEach((listener) => listener(event))
}

// --- Missions ---
export const todayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)

export function rolloverMissions(casino: CasinoState, now = Date.now()): CasinoState {
  const today = todayKey(now)
  if (casino.missionDate === today) return casino
  return { ...casino, missionDate: today, missionProgress: {}, missionsClaimed: [] }
}

function advanceMissions(casino: CasinoState, deltas: Partial<Record<MissionDef['metric'], number>>, absolute: Partial<Record<MissionDef['metric'], number>>) {
  const progress = { ...casino.missionProgress }
  for (const mission of DAILY_MISSIONS) {
    const before = progress[mission.id] ?? 0
    if (before >= mission.goal) continue
    const delta = deltas[mission.metric] ?? 0
    const abs = absolute[mission.metric]
    const after = Math.min(mission.goal, Math.max(before + delta, abs ?? 0))
    if (after !== before) {
      progress[mission.id] = after
      if (after >= mission.goal) emitCasinoEvent({ type: 'mission', label: mission.label, reward: mission.reward })
    }
  }
  return { ...casino, missionProgress: progress }
}

export function claimMission(casino: CasinoState, missionId: string): { casino: CasinoState; reward: number } {
  const mission = DAILY_MISSIONS.find((item) => item.id === missionId)
  if (!mission || casino.missionsClaimed.includes(missionId) || (casino.missionProgress[missionId] ?? 0) < mission.goal) return { casino, reward: 0 }
  return { casino: { ...casino, missionsClaimed: [...casino.missionsClaimed, missionId] }, reward: mission.reward }
}

// --- Core tracking ---
export type WagerOutcome = { casino: CasinoState; bonus: number }

export function trackWager(rawCasino: CasinoState, wager: number, now = Date.now()): WagerOutcome {
  if (!Number.isFinite(wager) || wager <= 0) return { casino: rawCasino, bonus: 0 }
  let casino = rolloverMissions(rawCasino, now)
  const beforeLevel = levelFromXp(casino.xp)
  const tier = vipTier(beforeLevel)
  const streakBoost = casino.winStreak >= 3 ? 1.5 : 1
  const xpGain = Math.max(1, wager * XP_PER_COIN * streakBoost)
  casino = {
    ...casino,
    xp: casino.xp + xpGain,
    totalWagered: casino.totalWagered + wager,
    roundsPlayed: casino.roundsPlayed + 1,
    rakeback: casino.rakeback + wager * tier.rakeback,
  }
  casino = advanceMissions(casino, { wagered: wager, rounds: 1 }, {})

  // NOTE: placing a bet NEVER grants coins. Levelling up and the progressive
  // jackpot used to add money here, which meant a *losing* bet could still
  // increase your balance (e.g. stake 42k, lose, and end up +12k) — a
  // consolation-prize bug. Level-up / tier-up events are still emitted for
  // stats and UI, but they no longer pay out. The only way to gain balance is
  // to actually win a round.
  const afterLevel = levelFromXp(casino.xp)
  if (afterLevel > beforeLevel) {
    emitCasinoEvent({ type: 'level-up', level: afterLevel, reward: 0 })
    const afterTier = vipTier(afterLevel)
    if (afterTier.name !== tier.name) emitCasinoEvent({ type: 'tier-up', tier: afterTier.name })
  }

  return { casino, bonus: 0 }
}

export function trackResult(rawCasino: CasinoState, wager: number, payout: number, now = Date.now()): CasinoState {
  let casino = rolloverMissions(rawCasino, now)
  const won = payout > wager
  const winStreak = won ? casino.winStreak + 1 : 0
  const today = todayKey(now)
  const sameDay = casino.dayKey === today
  casino = {
    ...casino,
    totalWon: casino.totalWon + Math.max(0, payout),
    roundsWon: casino.roundsWon + (won ? 1 : 0),
    biggestWin: Math.max(casino.biggestWin, payout),
    winStreak,
    bestStreak: Math.max(casino.bestStreak, winStreak),
    lossStreak: won ? 0 : casino.lossStreak + 1,
    dayKey: today,
    dayWon: (sameDay ? casino.dayWon : 0) + Math.max(0, payout),
    dayBestWin: Math.max(sameDay ? casino.dayBestWin : 0, payout),
  }
  casino = advanceMissions(casino, { wins: won ? 1 : 0 }, { streak: winStreak })
  if (won && winStreak >= 3) emitCasinoEvent({ type: 'streak', streak: winStreak })
  if (won && wager > 0 && payout >= wager * BIG_WIN_MULTIPLIER && payout >= 500) {
    emitCasinoEvent({ type: 'big-win', payout, multiplier: payout / wager, mega: payout >= wager * MEGA_WIN_MULTIPLIER })
  }
  return casino
}

// --- Rakeback & daily bonus ---
export function claimRakeback(casino: CasinoState): { casino: CasinoState; reward: number } {
  const reward = Math.floor(casino.rakeback)
  if (reward < 1) return { casino, reward: 0 }
  return { casino: { ...casino, rakeback: casino.rakeback - reward }, reward }
}

export const DAILY_BASE = 1_500
export function dailyBonusValue(streak: number, level: number) {
  const tier = vipTier(level)
  return Math.floor(DAILY_BASE * (1 + Math.min(6, streak) * 0.5) * tier.dailyBoost)
}

export function claimDailyBonus(casino: CasinoState, now = Date.now()): { casino: CasinoState; reward: number } {
  const today = todayKey(now)
  if (casino.lastDailyClaim === today) return { casino, reward: 0 }
  const yesterday = todayKey(now - 86_400_000)
  const streak = casino.lastDailyClaim === yesterday ? Math.min(365, casino.dailyStreak + 1) : 1
  const reward = dailyBonusValue(streak - 1, levelFromXp(casino.xp))
  return { casino: { ...casino, lastDailyClaim: today, dailyStreak: streak }, reward }
}

// --- Simulated live casino activity ---
const FAKE_NAMES = ['xKira', 'Dendy_777', 'MorozzZ', 'skyfall', 'BAGIRA', 'winstreak', 'Prime4ik', 'Lucky_Leo', 'nofear', 'Zoomer228', 'GHOSTIK', 'raskolnikov', 'MamkinBaron', 'tilted_1', 'AuraFarmer', 'Kefir', 'shadow_wlk', 'BETMEN', 'pluxury', 'cyrex']
const FAKE_GAMES = ['CRASH', 'MINES', 'PLINKO', 'ROULETTE', 'TOWER', 'UPGRADER', 'CASES']

export type LiveWin = { id: string; player: string; game: string; payout: number; multiplier: number }
export function generateLiveWin(random: () => number): LiveWin {
  const heavy = random()
  const multiplier = heavy < 0.6 ? 1.2 + random() * 2.5 : heavy < 0.9 ? 4 + random() * 12 : 20 + random() * 180
  const wager = Math.floor(50 + random() ** 2 * 40_000)
  return {
    id: crypto.randomUUID(),
    player: FAKE_NAMES[Math.floor(random() * FAKE_NAMES.length)],
    game: FAKE_GAMES[Math.floor(random() * FAKE_GAMES.length)],
    payout: Math.floor(wager * multiplier),
    multiplier: Math.round(multiplier * 100) / 100,
  }
}

export function simulatedOnline(now = Date.now()) {
  const hour = new Date(now).getHours()
  const dayCurve = 900 + Math.round(600 * Math.sin(((hour - 4) / 24) * Math.PI * 2))
  const jitter = Math.round(80 * Math.sin(now / 45_000) + 40 * Math.sin(now / 13_000))
  return Math.max(180, dayCurve + jitter)
}
