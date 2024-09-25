import { MigrationFixUsernamesInUrls } from '@nostrwatch/nwcache/migrations/fix_usernames_in_urls.js'

export default async(rcache) => {
  await MigrationFixUsernamesInUrls(rcache)
}