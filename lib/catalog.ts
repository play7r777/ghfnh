import { classifyRarity, smartPrice, type CatalogSkin } from '@/lib/game-logic'

type RemoteSkin = { id: string; name: string; image: string }

const CATALOG_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json'

export async function loadCatalog(): Promise<CatalogSkin[]> {
  try {
    const response = await fetch(CATALOG_URL, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!response.ok) return []
    const items = await response.json() as RemoteSkin[]
    return items
      .filter((item) => item.image && item.name.includes(' | '))
      .map((item, index) => {
        const [weapon, name] = item.name.split(' | ')
        const price = smartPrice(weapon, name, index)
        return {
          id: `cs2-${item.id}-${index}`,
          weapon,
          name,
          price,
          image: item.image,
          rarity: classifyRarity(weapon, name, price),
        }
      })
      .sort((a, b) => a.price - b.price)
  } catch {
    return []
  }
}
