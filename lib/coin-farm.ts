export const COIN_SLOT_VALUE = 5_000
export const COIN_SLOT_DURATION = 60_000
export const MAX_COIN_SLOTS = 3

export type CoinFarm = { readySlots: number; cycleStartedAt: number }

export function applyClickBurst(balance: number, clicks: number, valuePerClick: number, maxBalance: number) {
  if (![balance, clicks, valuePerClick, maxBalance].every(Number.isFinite)) return balance
  const safeClicks = Math.max(0, Math.floor(clicks))
  const safeValue = Math.max(0, valuePerClick)
  return Math.min(maxBalance, Math.max(0, balance) + safeClicks * safeValue)
}

export function getCoinFarmStatus(farm: CoinFarm, now = Date.now()) {
  const storedReady = Math.max(0, Math.min(MAX_COIN_SLOTS, Math.floor(farm.readySlots)))
  const startedAt = Number.isFinite(farm.cycleStartedAt) ? farm.cycleStartedAt : now
  const elapsedCycles = storedReady >= MAX_COIN_SLOTS
    ? 0
    : Math.max(0, Math.floor((now - startedAt) / COIN_SLOT_DURATION))
  const producedSlots = Math.min(MAX_COIN_SLOTS - storedReady, elapsedCycles)
  const readySlots = storedReady + producedSlots
  const isFull = readySlots >= MAX_COIN_SLOTS
  const cycleStartedAt = isFull ? now : startedAt + producedSlots * COIN_SLOT_DURATION
  const elapsedInCycle = isFull ? 0 : Math.max(0, now - cycleStartedAt)
  const activeProgress = isFull ? 1 : Math.min(1, elapsedInCycle / COIN_SLOT_DURATION)
  const remainingMs = isFull ? 0 : Math.max(0, COIN_SLOT_DURATION - elapsedInCycle)

  return {
    readySlots,
    isFull,
    activeSlot: isFull ? MAX_COIN_SLOTS : readySlots,
    activeProgress,
    remainingMs,
    farm: { readySlots, cycleStartedAt },
  }
}

export function claimCoinSlot(farm: CoinFarm, now = Date.now()) {
  const status = getCoinFarmStatus(farm, now)
  if (status.readySlots < 1) return { reward: 0, farm: status.farm }

  return {
    reward: COIN_SLOT_VALUE,
    farm: {
      readySlots: status.readySlots - 1,
      cycleStartedAt: status.isFull ? now : status.farm.cycleStartedAt,
    },
  }
}
