import { normalizeCasino } from '@/lib/casino-system'

export const ECONOMY_SCALE = 1500

export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type CatalogSkin = {
  id: string
  weapon: string
  name: string
  price: number
  image: string
  rarity: SkinRarity
}

export const knifeWords = ['Knife', 'Bayonet', 'Karambit', 'Daggers', 'Kukri']
export const gloveWords = ['Gloves', 'Wraps']
export const premiumWords = ['Dragon Lore', 'Gungnir', 'Howl', 'Wild Lotus', 'Medusa', 'The Prince', 'Welcome to the Jungle', 'Desert Hydra', 'Fire Serpent', 'Gold Arabesque', 'Hydroponic', 'Poseidon', 'Fade', 'Doppler', 'Gamma Doppler', 'Crimson Web']
const epicWords = ['Asiimov', 'Lightning Strike', 'Containment Breach', 'Printstream', 'Vulcan', 'Fuel Injector', 'Case Hardened', 'Bloodsport', 'Neon Rider', 'Kill Confirmed', 'Hyper Beast', 'Golden Coil']

export function classifyRarity(weapon: string, name: string, price: number): SkinRarity {
  const item = `${weapon} ${name}`
  if (knifeWords.some((word) => weapon.includes(word)) || gloveWords.some((word) => weapon.includes(word)) || premiumWords.some((word) => item.includes(word)) || price >= 1000 * ECONOMY_SCALE) return 'legendary'
  if (epicWords.some((word) => item.includes(word)) || price >= 180 * ECONOMY_SCALE) return 'epic'
  if (price >= 25 * ECONOMY_SCALE) return 'rare'
  return 'common'
}

const weaponBase: Record<string, number> = {
  AWP: 22, 'AK-47': 18, M4A4: 15, 'M4A1-S': 16, 'Desert Eagle': 11, 'USP-S': 8,
  'Glock-18': 6, 'SSG 08': 5, AUG: 4.5, 'SG 553': 4.2, FAMAS: 3.8, Galil: 3.4,
  P90: 3.2, MP9: 3, 'MAC-10': 2.8, 'Five-SeveN': 2.5, P250: 2.2, Tec: 2.2,
  Nova: 1.8, XM1014: 1.8, UMP: 1.7, MP7: 1.6, MP5: 1.6, Negev: 1.2,
}

const finishPrices: Record<string, number> = {
  'Dragon Lore': 11800, Gungnir: 10500, Howl: 5600, 'Wild Lotus': 8700, Medusa: 4200,
  'The Prince': 3300, 'Welcome to the Jungle': 2300, 'Desert Hydra': 1850, 'Lightning Strike': 760,
  'Fire Serpent': 1450, 'Gold Arabesque': 2100, 'Hydroponic': 1250, 'X-Ray': 1200,
  'Poseidon': 1050, 'Eye of Horus': 610, 'Vulcan': 540, 'Case Hardened': 520,
  'Printstream': 230, Asiimov: 190, 'Kill Confirmed': 175, 'Golden Koi': 90,
  'Hyper Beast': 85, 'Neo-Noir': 48, 'Crimson Web': 420, Fade: 740, Doppler: 650,
  'Gamma Doppler': 780, Slaughter: 520, Lore: 460, 'Marble Fade': 690,
  'Tiger Tooth': 550, Autotronic: 390, Damascus: 190, Ultraviolet: 170,
  'Safari Mesh': 0.35, 'Forest DDPAT': 0.45, 'Urban DDPAT': 0.5, 'Urban Masked': 0.5, Scorched: 0.45,
  'Boreal Forest': 0.55, 'Sand Dune': 0.35, Groundwater: 0.4, Contractor: 0.4, Colony: 0.45,
}

const knifeBase: Record<string, number> = {
  Karambit: 980, 'M9 Bayonet': 820, 'Butterfly Knife': 1080, Bayonet: 430,
  'Talon Knife': 510, 'Skeleton Knife': 620, 'Classic Knife': 300, 'Stiletto Knife': 280,
  'Flip Knife': 240, 'Huntsman Knife': 220, 'Ursus Knife': 190, 'Bowie Knife': 170,
  'Falchion Knife': 155, 'Paracord Knife': 145, 'Nomad Knife': 200, 'Survival Knife': 135,
  'Gut Knife': 105, 'Navaja Knife': 85, 'Shadow Daggers': 90, Kukri: 170,
}

const gloveBase: Record<string, number> = {
  'Sport Gloves': 560, 'Specialist Gloves': 420, 'Moto Gloves': 260, 'Driver Gloves': 220,
  'Hand Wraps': 170, 'Hydra Gloves': 120, 'Bloodhound Gloves': 135, 'Broken Fang Gloves': 115,
}

function deterministicVariation(seed: string) {
  let hash = 2166136261
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return 0.94 + ((hash >>> 0) % 1300) / 10000
}

function matchPrice(table: Record<string, number>, value: string) {
  const key = Object.keys(table).sort((a, b) => b.length - a.length).find((entry) => value.toLowerCase().includes(entry.toLowerCase()))
  return key ? table[key] : undefined
}

export function smartPrice(weapon: string, name: string, index = 0) {
  const statTrak = /stattrak/i.test(weapon)
  const souvenir = /souvenir/i.test(weapon)
  const cleanWeapon = weapon.replace(/StatTrak™?\s*|Souvenir\s*/gi, '').trim()
  const specialFinish = matchPrice(finishPrices, name)
  const knife = matchPrice(knifeBase, cleanWeapon)
  const glove = matchPrice(gloveBase, cleanWeapon)
  const base = knife ?? glove ?? weaponBase[cleanWeapon] ?? 1.5

  let price: number
  if (knife) price = knife * (specialFinish ? Math.max(0.72, specialFinish / 360) : 0.92)
  else if (glove) price = glove * (specialFinish ? Math.max(0.76, specialFinish / 500) : 0.9)
  else price = specialFinish ?? base * (1.1 + Math.min(name.length, 28) / 35)

  const premium = price >= 1000
  if (statTrak) price *= premium ? 1.22 : 1.55
  if (souvenir) price *= premium ? 1.35 : 1.18
  price *= deterministicVariation(`${cleanWeapon}|${name}|${index}`)
  return Number((Math.max(0.08, price) * ECONOMY_SCALE).toFixed(2))
}

export const MAX_BALANCE = 1_000_000_000_000_000
export const MAX_INVENTORY = 2_000

export type NormalizableGameState = {
  balance: number; credits: number; inventory: string[]; upgrades: number; promo: string[]
  history: unknown[]; multiplier: number; language: 'en' | 'ua'; dailyGift: string | null
  nickname: string | null; coinFarm: { readySlots: number; cycleStartedAt: number }; rouletteTurbo?: boolean
  casino?: import('@/lib/casino-system').CasinoState
  }

const finiteInt = (value: unknown, fallback: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : fallback

export function normalizeGameState(value: unknown, fallback: NormalizableGameState, validSkinIds: Set<string>, now = Date.now()): NormalizableGameState & { casino: import('@/lib/casino-system').CasinoState } {
  const raw = value && typeof value === 'object' ? value as Partial<NormalizableGameState> : {}
  const inventory = Array.isArray(raw.inventory) ? [...new Set(raw.inventory.filter((id): id is string => {
    if (typeof id !== 'string' || id.length > 160) return false
    const [skinId, instance] = id.split('::')
    return Boolean(instance && validSkinIds.has(skinId))
  }))].slice(0, MAX_INVENTORY) : []
  const promo = Array.isArray(raw.promo) ? [...new Set(raw.promo.filter((code): code is string => code === 'UPGRADE' || code === 'WELCOME'))] : []
  const nickname = typeof raw.nickname === 'string' ? raw.nickname.trim().replace(/\s+/g, ' ').slice(0, 20) || null : null
  const farm = raw.coinFarm && typeof raw.coinFarm === 'object' ? raw.coinFarm : fallback.coinFarm
  return {
    ...fallback,
    balance: finiteInt(raw.balance, fallback.balance, MAX_BALANCE), credits: finiteInt(raw.credits, fallback.credits, 1_000_000),
    inventory, upgrades: finiteInt(raw.upgrades, fallback.upgrades, 1_000_000_000), promo,
    history: Array.isArray(raw.history) ? raw.history.filter(item => item && typeof item === 'object').slice(0, 50) : [],
    multiplier: raw.multiplier === 3 ? 3 : 1, language: raw.language === 'ua' ? 'ua' : 'en',
    dailyGift: typeof raw.dailyGift === 'string' && raw.dailyGift.length <= 40 ? raw.dailyGift : null, nickname,
    coinFarm: { readySlots: finiteInt(farm.readySlots, 0, 3), cycleStartedAt: typeof farm.cycleStartedAt === 'number' && Number.isFinite(farm.cycleStartedAt) ? Math.min(now, Math.max(0, farm.cycleStartedAt)) : now },
  rouletteTurbo: raw.rouletteTurbo === true,
  casino: normalizeCasino(raw.casino),
  }
}

export function findAffordableCatalogPrice(items: CatalogSkin[], balance: number, quantity: number) {
  if (!Number.isFinite(balance) || balance <= 0 || !Number.isInteger(quantity) || quantity < 1) return null
  const budgetPerItem = balance / quantity
  const affordable = items.filter((item) => Number.isFinite(item.price) && item.price > 0 && item.price <= budgetPerItem)
  if (!affordable.length) return null
  return affordable.reduce((highest, item) => item.price > highest ? item.price : highest, 0)
}

export function validateUpgradeStake(inventory: string[], sourceIds: string[], cash: number, balance: number) {
  if (!Number.isFinite(cash) || cash < 0 || !Number.isFinite(balance) || balance < 0 || cash > balance) return false
  if (new Set(sourceIds).size !== sourceIds.length) return false
  const owned = new Set(inventory)
  return sourceIds.every((id) => owned.has(id))
}

export function calculateChance(sourceValue: number, targetPrice: number) {
  if (!Number.isFinite(sourceValue) || !Number.isFinite(targetPrice) || sourceValue <= 0 || targetPrice <= 0) return 0
  return Math.min(75, (sourceValue / targetPrice) * 100)
}

export function isWinningRoll(randomValue: number, chance: number) {
  const normalizedChance = Math.max(0, Math.min(100, chance))
  return randomValue * 100 < normalizedChance
}

// Hidden anti-frustration boost: after 4+ consecutive losses the real roll chance
// quietly grows (+1.5% per loss, capped at +12%). The displayed chance never changes.
export function applyPity(chance: number, lossStreak: number) {
  const boost = Math.min(12, Math.max(0, lossStreak - 3) * 1.5)
  return Math.min(82, chance + boost)
}

// Natural landing: the pointer stops uniformly within the decided zone.
// Where it lands is exactly proportional to the odds — no engineered drama.
export function upgradeLanding(won: boolean, chance: number, random: () => number) {
  const halfArc = Math.max(0.5, chance * 1.8)
  if (won) return (random() * halfArc * 2 - halfArc + 360) % 360
  return halfArc + random() * (360 - halfArc * 2)
}

export function crashPoint(randomValue: number) {
  const roll = Math.min(0.999999, Math.max(0, randomValue))
  return Math.min(100, Math.max(1, Math.floor((0.96 / (1 - roll)) * 100) / 100))
}

export function crashMultiplier(elapsedMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 1
  // Keep full precision so requestAnimationFrame can render smoothly on displays up to 240 Hz.
  return Math.min(100, Math.exp(elapsedMs / 2720))
}

export function uniqueRandomCells(count: number, total: number, random: () => number) {
  const cells = new Set<number>()
  while (cells.size < Math.min(Math.max(0, count), total)) cells.add(Math.floor(random() * total))
  return [...cells]
}

export function minesMultiplier(safePicks: number, mines: number, cells = 25) {
  if (safePicks <= 0) return 1
  let probability = 1
  for (let pick = 0; pick < safePicks; pick += 1) probability *= (cells - mines - pick) / (cells - pick)
  return Number((0.96 / probability).toFixed(2))
}

export function towerMultiplier(level: number, difficulty: number) {
  return Number(Math.pow(1 / (1 - difficulty / 4), level).toFixed(2))
}

export function rouletteResult(randomValue: number) {
  const slot = Math.floor(Math.min(0.999999, Math.max(0, randomValue)) * 15)
  return slot === 0 ? 'gold' : slot % 2 ? 'red' : 'black'
}

// Real-casino weighted drop table (~96% RTP): a razor-thin jackpot tier players chase,
// a fat "break-even" band of losses disguised as wins, and scrap filler.
// `lossStreak` feeds a small hidden pity boost into the jackpot/big tiers.
export type CaseTier = 'jackpot' | 'big' | 'profit' | 'break-even' | 'scrap'
export type CaseDrop = { item: CatalogSkin; tier: CaseTier; multiplier: number }

export function caseReward(items: CatalogSkin[], price: number, random: () => number, lossStreak = 0): CaseDrop | null {
  if (!items.length || price <= 0) return null
  const pity = Math.min(0.02, Math.max(0, lossStreak - 4) * 0.004)
  const roll = random()
  let tier: CaseTier
  let multiplier: number
  if (roll < 0.004 + pity * 0.25) { tier = 'jackpot'; multiplier = 10 + random() * 25 }
  else if (roll < 0.044 + pity) { tier = 'big'; multiplier = 3 + random() * 5 }
  else if (roll < 0.2 + pity) { tier = 'profit'; multiplier = 1.15 + random() * 1.05 }
  else if (roll < 0.52) { tier = 'break-even'; multiplier = 0.6 + random() * 0.35 }
  else { tier = 'scrap'; multiplier = 0.15 + random() * 0.3 }
  const desired = price * multiplier
  const item = items.reduce<CatalogSkin | null>((best, candidate) => !best || Math.abs(candidate.price - desired) < Math.abs(best.price - desired) ? candidate : best, null)
  return item ? { item, tier, multiplier } : null
}

export type PlinkoRisk = 'low' | 'medium' | 'high'
export type PlinkoStep = -1 | 1

export const PLINKO_ROWS = 16
export const PLINKO_MULTIPLIERS: Record<PlinkoRisk, readonly number[]> = {
  low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
}

export function plinkoTheoreticalReturn(risk: PlinkoRisk) {
  const table = PLINKO_MULTIPLIERS[risk]
  const combinations = (n: number, k: number) => {
    let result = 1
    for (let index = 1; index <= k; index += 1) result = result * (n - index + 1) / index
    return result
  }
  return table.reduce((total, multiplier, slot) => total + multiplier * combinations(PLINKO_ROWS, slot) / 2 ** PLINKO_ROWS, 0)
}

export function createPlinkoPath(random: () => number, rows = PLINKO_ROWS): PlinkoStep[] {
  const safeRows = Math.min(32, Math.max(1, Math.floor(rows)))
  return Array.from({ length: safeRows }, () => random() < 0.5 ? -1 : 1)
}

export function plinkoSlotFromPath(path: readonly PlinkoStep[]) {
  return path.reduce((slot, step) => slot + (step === 1 ? 1 : 0), 0)
}

export function plinkoMultiplier(risk: PlinkoRisk, slot: number) {
  const table = PLINKO_MULTIPLIERS[risk] ?? PLINKO_MULTIPLIERS.low
  return table[Math.min(table.length - 1, Math.max(0, Math.floor(slot)))]
}

export type CoinSide = 'heads' | 'tails'
export const resolveCoinflip = (value: number): CoinSide => value < 0.5 ? 'heads' : 'tails'
export function findCoinflipReward(items: CatalogSkin[], stake: number) {
  if (!items.length || stake <= 0) return null
  return items.reduce<CatalogSkin | null>((best, item) => !best || Math.abs(item.price - stake * 2) < Math.abs(best.price - stake * 2) ? item : best, null)
}

export function filterCatalog(items: CatalogSkin[], query: string, from: string, to: string, ascending: boolean) {
  const normalizedQuery = query.trim().toLowerCase()
  const minimum = Math.max(0, Number(from) || 0)
  const maximum = Math.max(0, Number(to) || Number.POSITIVE_INFINITY)
  return items
    .filter((item) => `${item.weapon} ${item.name}`.toLowerCase().includes(normalizedQuery) && item.price >= minimum && item.price <= maximum)
    .sort((a, b) => ascending ? a.price - b.price : b.price - a.price)
}
