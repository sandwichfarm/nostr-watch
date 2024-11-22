// import { MigrationFixRelayDuplicates } from './migrations/fix-non-normal-urls.js'
// import { FindClosestToRoot } from '@nostrwatch/nwcache/migrations/duplicates.js'
import { MigrationFixUsernamesInUrls } from '@nostrwatch/nwcache/migrations/fix_usernames_in_urls.js'
// import { AddIgnoreFieldToRelays } from '@nostrwatch/nwcache/migrations/add_ignore_field_to_relays.js'
// import { SanitizeRelayUrls } from '@nostrwatch/nwcache/migrations/sanitize.js'

export default async(rcache) => {
  // await MigrationFixRelayDuplicates(rcache)
  // await AddIgnoreFieldToRelays(rcache)
  // await SanitizeRelayUrls(rcache)
  await MigrationFixUsernamesInUrls(rcache)
  // await FindClosestToRoot(rcache)
}