import { describe, expect, it } from 'vitest'
import { calculateChance, classifyRarity, createPlinkoPath, filterCatalog, findAffordableCatalogPrice, findCoinflipReward, isWinningRoll, MAX_BALANCE, normalizeGameState, PLINKO_MULTIPLIERS, plinkoMultiplier, plinkoSlotFromPath, plinkoTheoreticalReturn, resolveCoinflip, smartPrice, validateUpgradeStake, type CatalogSkin } from './game-logic'

const catalog: CatalogSkin[] = [
  { id: 'a', weapon: 'AK-47', name: 'Vulcan', price: 200, image: '', rarity: 'rare' },
  { id: 'b', weapon: 'AWP', name: 'Dragon Lore', price: 900, image: '', rarity: 'legendary' },
  { id: 'c', weapon: 'P250', name: 'Sand Dune', price: 50, image: '', rarity: 'common' },
]

describe('calculateChance', () => {
  it('calculates the source-to-target ratio', () => expect(calculateChance(250, 1000)).toBe(25))
  it('caps upgrades at 75 percent', () => expect(calculateChance(900, 1000)).toBe(75))
  it('rejects invalid values', () => expect(calculateChance(-1, 0)).toBe(0))
})

describe('isWinningRoll', () => {
  it('uses the exact chance boundary', () => {
    expect(isWinningRoll(0.2499, 25)).toBe(true)
    expect(isWinningRoll(0.25, 25)).toBe(false)
  })
})

describe('validateUpgradeStake', () => {
  it('rejects selling already-sold items', () => {
    const inventory = ['skin-a::123', 'skin-b::456']
    expect(validateUpgradeStake(inventory, ['skin-a::123', 'skin-c::789'], 0, 1000)).toBe(false)
  })
  it('rejects duplicate instance IDs in source', () => {
    const inventory = ['skin-a::123', 'skin-a::123']
    expect(validateUpgradeStake(inventory, ['skin-a::123', 'skin-a::123'], 0, 1000)).toBe(false)
  })
  it('rejects negative or over-balance cash', () => {
    const inventory = ['skin-a::123']
    expect(validateUpgradeStake(inventory, ['skin-a::123'], -1, 1000)).toBe(false)
    expect(validateUpgradeStake(inventory, ['skin-a::123'], 1500, 1000)).toBe(false)
  })
  it('accepts valid stakes with cash and sources', () => {
    const inventory = ['skin-a::123', 'skin-b::456']
    expect(validateUpgradeStake(inventory, ['skin-a::123', 'skin-b::456'], 500, 1000)).toBe(true)
  })
})


describe('plinko', () => {
  it('creates deterministic left and right paths', () => {
    expect(createPlinkoPath(() => 0, 4)).toEqual([-1, -1, -1, -1])
    expect(createPlinkoPath(() => 0.9, 4)).toEqual([1, 1, 1, 1])
  })
  it('maps paths to bounded slots', () => {
    expect(plinkoSlotFromPath([-1, -1, -1])).toBe(0)
    expect(plinkoSlotFromPath([-1, 1, 1])).toBe(2)
    expect(plinkoSlotFromPath([1, 1, 1])).toBe(3)
  })
  it('keeps every risk table symmetric', () => {
    Object.values(PLINKO_MULTIPLIERS).forEach(table => expect([...table].reverse()).toEqual(table))
  })
  it('keeps rare edge wins and losing center slots', () => {
    expect(plinkoMultiplier('high', 0)).toBe(1000)
    expect(plinkoMultiplier('medium', 8)).toBe(0.3)
    expect(plinkoMultiplier('low', 8)).toBe(0.5)
    expect(plinkoMultiplier('low', -20)).toBe(16)
    expect(plinkoMultiplier('low', 99)).toBe(16)
  })
  it('keeps every risk profile just below 100% theoretical return', () => {
    ;(['low', 'medium', 'high'] as const).forEach((risk) => {
      expect(plinkoTheoreticalReturn(risk)).toBeGreaterThan(0.98)
      expect(plinkoTheoreticalReturn(risk)).toBeLessThan(1)
    })
  })
})

describe('coinflip', () => {
  it('resolves both exact halves of the coin', () => {
    expect(resolveCoinflip(0)).toBe('heads')
    expect(resolveCoinflip(0.499999)).toBe('heads')
    expect(resolveCoinflip(0.5)).toBe('tails')
    expect(resolveCoinflip(0.999999)).toBe('tails')
  })
  it('selects the catalog skin closest to double the stake', () => {
    expect(findCoinflipReward(catalog, 100)?.id).toBe('a')
    expect(findCoinflipReward(catalog, 420)?.id).toBe('b')
    expect(findCoinflipReward(catalog, 0)).toBeNull()
  })
})

describe('filterCatalog', () => {
  it('filters by query and price', () => expect(filterCatalog(catalog, 'awp', '100', '1000', true).map((item) => item.id)).toEqual(['b']))
  it('sorts descending without mutating input', () => {
    expect(filterCatalog(catalog, '', '', '', false).map((item) => item.price)).toEqual([900, 200, 50])
    expect(catalog.map((item) => item.price)).toEqual([200, 900, 50])
  })
})

describe('findAffordableCatalogPrice', () => {
  it('selects an exact existing price for one, two, or four purchases', () => {
    expect(findAffordableCatalogPrice(catalog, 1000, 1)).toBe(900)
    expect(findAffordableCatalogPrice(catalog, 1000, 2)).toBe(200)
    expect(findAffordableCatalogPrice(catalog, 1000, 4)).toBe(200)
  })
  it('returns null when no real skin fits the requested quantity', () => {
    expect(findAffordableCatalogPrice(catalog, 199, 4)).toBeNull()
    expect(findAffordableCatalogPrice(catalog, 1000, 0)).toBeNull()
  })
})

describe('classifyRarity', () => {
  it('never gives iconic collectibles a common or rare color', () => {
    expect(classifyRarity('AWP', 'Dragon Lore', 10)).toBe('legendary')
    expect(classifyRarity('AWP', 'Gungnir', 10)).toBe('legendary')
    expect(classifyRarity('M4A4', 'Howl', 10)).toBe('legendary')
    expect(classifyRarity('Karambit', 'Safari Mesh', 90)).toBe('legendary')
  })
  it('uses value floors for unknown premium items', () => {
    expect(classifyRarity('AWP', 'Unknown Collector', 1500 * 1500)).toBe('legendary')
    expect(classifyRarity('AK-47', 'Unknown Premium', 300 * 1500)).toBe('epic')
  })
})

describe('normalizeGameState', () => {
  const fallback = { balance: 5000, credits: 120, inventory: [], upgrades: 0, promo: [], history: [], multiplier: 1, language: 'en' as const, dailyGift: null, nickname: null, coinFarm: { readySlots: 0, cycleStartedAt: 0 } }
  const validIds = new Set(['skin-a', 'skin-b'])
  it('rejects NaN Infinity and negative values', () => {
    expect(normalizeGameState({ balance: NaN }, fallback, validIds).balance).toBe(fallback.balance)
    expect(normalizeGameState({ balance: Infinity }, fallback, validIds).balance).toBeLessThanOrEqual(MAX_BALANCE)
    expect(normalizeGameState({ balance: -500 }, fallback, validIds).balance).toBe(0)
  })
  it('deduplicates inventory and filters unknown IDs', () => {
    expect(normalizeGameState({ inventory: ['skin-a::1', 'skin-a::1', 'skin-c::3', 'skin-b::2'] }, fallback, validIds).inventory).toEqual(['skin-a::1', 'skin-b::2'])
  })
  it('validates multiplier enum and promo codes', () => {
    expect(normalizeGameState({ multiplier: 7 }, fallback, validIds).multiplier).toBe(1)
    expect(normalizeGameState({ multiplier: 3 }, fallback, validIds).multiplier).toBe(3)
    expect(normalizeGameState({ promo: ['UPGRADE', 'INVALID', 'WELCOME', 'UPGRADE'] }, fallback, validIds).promo).toEqual(['UPGRADE', 'WELCOME'])
  })
  it('clamps future timestamps to present', () => {
    const future = Date.now() + 1_000_000
    expect(normalizeGameState({ coinFarm: { readySlots: 0, cycleStartedAt: future } }, fallback, validIds, Date.now()).coinFarm.cycleStartedAt).toBeLessThanOrEqual(Date.now())
  })
})

describe('smartPrice', () => {
  it('keeps the iconic AWP hierarchy realistic', () => {
    const safari = smartPrice('AWP', 'Safari Mesh', 2)
    const asiimov = smartPrice('AWP', 'Asiimov', 2)
    const medusa = smartPrice('AWP', 'Medusa', 2)
    const dragonLore = smartPrice('AWP', 'Dragon Lore', 2)
    const gungnir = smartPrice('AWP', 'Gungnir', 2)
    expect(safari).toBeLessThan(asiimov)
    expect(asiimov).toBeLessThan(medusa)
    expect(medusa).toBeLessThan(dragonLore)
    expect(gungnir).toBeGreaterThan(5000 * 1500)
  })
  it('prices collectible rifles far above mass-market finishes', () => {
    expect(smartPrice('AK-47', 'Wild Lotus', 4)).toBeGreaterThan(smartPrice('AK-47', 'Safari Mesh', 4) * 1000)
    expect(smartPrice('M4A4', 'Howl', 8)).toBeGreaterThan(smartPrice('M4A4', 'Urban DDPAT', 8) * 1000)
  })
  it('preserves knife model and finish hierarchy', () => {
    expect(smartPrice('Karambit', 'Doppler', 3)).toBeGreaterThan(smartPrice('Gut Knife', 'Safari Mesh', 3) * 5)
  })
  it('adds a StatTrak premium without flattening tiers', () => {
    expect(smartPrice('StatTrak™ AK-47', 'Vulcan', 6)).toBeGreaterThan(smartPrice('AK-47', 'Vulcan', 6))
  })
  it('is deterministic and always positive', () => {
    expect(smartPrice('AWP', 'Dragon Lore', 11)).toBe(smartPrice('AWP', 'Dragon Lore', 11))
    expect(smartPrice('Unknown', 'Unknown', 0)).toBeGreaterThan(0)
  })
})
