import { classifyRarity, RARITY_COLORS, smartPrice, type CatalogSkin, type SkinRarity } from '@/lib/game-logic'

const ECONOMY_SCALE = 1500

// ByMykel's CS2 catalog (images + exact in-game rarity/colors) and his Steam-market
// price tracker (real USD prices). We combine them so every skin's price ratio matches
// real CS2, then scale by ECONOMY_SCALE. Runs server-side in the async page.
const SKINS_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json'
const PRICES_URL = 'https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/latest.json'

type RemoteSkin = {
  id: string
  name: string
  image?: string
  rarity?: { id?: string; name?: string; color?: string }
  wears?: { name: string }[]
}
type PriceFeed = { prices?: Record<string, number> }

// Most-liquid wear first so a thin outlier wear can't distort the price.
const WEAR_PRIORITY = ['Field-Tested', 'Minimal Wear', 'Well-Worn', 'Battle-Scarred', 'Factory New']

// Map the API rarity name to our tier key + the exact CS2 border color.
// Knives/gloves ("Extraordinary") use the gold star tone rather than the API's red.
const RARITY_BY_NAME: Record<string, { tier: SkinRarity; color: string }> = {
  'Consumer Grade':   { tier: 'consumer',   color: '#b0c3d9' },
  'Industrial Grade': { tier: 'industrial', color: '#5e98d9' },
  'Mil-Spec Grade':   { tier: 'milspec',    color: '#4b69ff' },
  'Restricted':       { tier: 'restricted', color: '#8847ff' },
  'Classified':       { tier: 'classified', color: '#d32ce6' },
  'Covert':           { tier: 'covert',     color: '#eb4b4b' },
  'Contraband':       { tier: 'contraband', color: '#e4ae39' },
  'Extraordinary':    { tier: 'exotic',     color: '#e4ae39' },
}

// Real USD price (already scaled) for a skin, using the most representative wear.
function realPrice(skin: RemoteSkin, prices: Record<string, number>): number | null {
  const wears = (skin.wears ?? []).map((wear) => wear.name)
  const ordered = wears.length
    ? [...WEAR_PRIORITY.filter((wear) => wears.includes(wear)), ...wears.filter((wear) => !WEAR_PRIORITY.includes(wear))]
    : []
  const keys = [...ordered.map((wear) => `${skin.name} (${wear})`), skin.name]
  for (const key of keys) {
    const cents = prices[key]
    if (typeof cents === 'number' && cents > 0) return Number(((cents / 100) * ECONOMY_SCALE).toFixed(2))
  }
  return null
}

export async function loadCatalog(): Promise<CatalogSkin[]> {
  try {
    // Cache both feeds and refresh a few times a day so page loads stay fast.
    const [skinsResponse, pricesResponse] = await Promise.all([
      fetch(SKINS_URL, { next: { revalidate: 21600 }, signal: AbortSignal.timeout(10000) }),
      fetch(PRICES_URL, { next: { revalidate: 21600 }, signal: AbortSignal.timeout(12000) }).catch(() => null),
    ])
    if (!skinsResponse.ok) return []
    const items = await skinsResponse.json() as RemoteSkin[]
    let prices: Record<string, number> = {}
    if (pricesResponse && pricesResponse.ok) {
      const feed = await pricesResponse.json() as PriceFeed
      prices = feed.prices ?? {}
    }

    return items
      .filter((item) => item.image && item.name.includes(' | '))
      .map((item, index) => {
        const [weapon, name] = item.name.split(' | ')
        const mapped = item.rarity?.name ? RARITY_BY_NAME[item.rarity.name] : undefined
        // Real market price when available; otherwise fall back to the curated model
        // (which already knows famous finishes like Dragon Lore / Gungnir).
        const price = realPrice(item, prices) ?? smartPrice(weapon, name, index)
        const rarity: SkinRarity = mapped?.tier ?? classifyRarity(weapon, name, price)
        const rarityColor = mapped?.color ?? item.rarity?.color ?? RARITY_COLORS[rarity]
        return { id: `cs2-${item.id}-${index}`, weapon, name, price, image: item.image!, rarity, rarityColor }
      })
      .sort((a, b) => a.price - b.price)
  } catch {
    return []
  }
}
