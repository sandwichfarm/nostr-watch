import { MigrationFixRelayDuplicates } from './migrations/fix-non-normal-urls.js'
import { FindClosestToRoot } from '@nostrwatch/nwcache/migrations/duplicates.js'
import { AddIgnoreFieldToRelays } from '@nostrwatch/nwcache/migrations/add_ignore_field_to_relays.js'
import { SanitizeRelayUrls } from '@nostrwatch/nwcache/migrations/sanitize.js'

export default async(rcache) => {
  await MigrationFixRelayDuplicates(rcache)
  // await AddIgnoreFieldToRelays(rcache)
  // await SanitizeRelayUrls(rcache)
  await FindClosestToRoot(rcache)
}