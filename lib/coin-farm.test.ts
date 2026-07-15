import { describe, expect, it } from 'vitest'
import { applyClickBurst, claimCoinSlot, COIN_SLOT_DURATION, COIN_SLOT_VALUE, getCoinFarmStatus } from './coin-farm'

describe('click burst accumulator', () => {
  it('accounts for every rapid click in one balance update', () => {
    expect(applyClickBurst(100, 1000, 5, 1_000_000)).toBe(5100)
    expect(applyClickBurst(100, 1000, 15, 1_000_000)).toBe(15100)
  })

  it('caps the batch without producing invalid balances', () => {
    expect(applyClickBurst(990, 100, 5, 1000)).toBe(1000)
    expect(applyClickBurst(100, -20, 5, 1000)).toBe(100)
  })
})

describe('renewable coin farm', () => {
  const cycleStartedAt = 1_000_000
  const emptyFarm = { readySlots: 0, cycleStartedAt }

  it('fills one 5000 coin charge each minute', () => {
    expect(getCoinFarmStatus(emptyFarm, cycleStartedAt + COIN_SLOT_DURATION - 1).readySlots).toBe(0)
    expect(getCoinFarmStatus(emptyFarm, cycleStartedAt + COIN_SLOT_DURATION).readySlots).toBe(1)
    expect(getCoinFarmStatus(emptyFarm, cycleStartedAt + COIN_SLOT_DURATION * 2).readySlots).toBe(2)
  })

  it('caps accumulation at three charges', () => {
    const status = getCoinFarmStatus(emptyFarm, cycleStartedAt + COIN_SLOT_DURATION * 20)
    expect(status.readySlots).toBe(3)
    expect(status.isFull).toBe(true)
  })

  it('claims exactly one charge at a time', () => {
    const fullFarm = { readySlots: 3, cycleStartedAt }
    const result = claimCoinSlot(fullFarm, cycleStartedAt + COIN_SLOT_DURATION * 3)
    expect(result.reward).toBe(COIN_SLOT_VALUE)
    expect(result.farm.readySlots).toBe(2)
  })

  it('restarts a full minute after claiming from a full queue', () => {
    const claimTime = cycleStartedAt + COIN_SLOT_DURATION * 3
    const result = claimCoinSlot({ readySlots: 3, cycleStartedAt }, claimTime)
    expect(getCoinFarmStatus(result.farm, claimTime + COIN_SLOT_DURATION - 1).readySlots).toBe(2)
    expect(getCoinFarmStatus(result.farm, claimTime + COIN_SLOT_DURATION).readySlots).toBe(3)
  })

  it('keeps existing cycle progress when claiming before full', () => {
    const halfway = cycleStartedAt + COIN_SLOT_DURATION / 2
    const result = claimCoinSlot({ readySlots: 1, cycleStartedAt }, halfway)
    expect(result.farm.cycleStartedAt).toBe(cycleStartedAt)
    expect(getCoinFarmStatus(result.farm, halfway).activeProgress).toBe(0.5)
  })
})
