import { UpgraderApp } from '@/components/upgrader-app'
import { loadCatalog } from '@/lib/catalog'

export default async function Page() {
  const catalog = await loadCatalog()
  return <UpgraderApp initialCatalog={catalog} />
}
