import type { CasinoState } from '@/lib/casino-system'
import { initialCasino } from '@/lib/casino-system'
import type { CoinFarm } from '@/lib/coin-farm'
import type { CatalogSkin } from '@/lib/game-logic'

export type Skin = CatalogSkin
export type History = { id: string; target: string; chance: number; won: boolean; player?: string; createdAt?: string }
export type GameState = {
  balance: number
  credits: number
  inventory: string[]
  upgrades: number
  promo: string[]
  history: History[]
  multiplier: number
  language: 'en' | 'ua'
  dailyGift: string | null
  nickname: string | null
  coinFarm: CoinFarm
  rouletteTurbo?: boolean
  casino: CasinoState
}
export type CatalogState = { ascending: boolean; from: string; to: string }
export type GameMode = 'upgrader' | 'crash' | 'mines' | 'cases' | 'roulette' | 'tower' | 'plinko'

export const initialGameState: GameState = {
  balance: 5000,
  credits: 120,
  inventory: [],
  upgrades: 0,
  promo: [],
  history: [],
  multiplier: 1,
  language: 'en',
  dailyGift: null,
  nickname: null,
  coinFarm: { readySlots: 0, cycleStartedAt: 0 },
  casino: initialCasino,
}

export const money = (value: number) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const secureRandomValue = () => {
  const value = new Uint32Array(1)
  crypto.getRandomValues(value)
  return value[0] / 4294967296
}
