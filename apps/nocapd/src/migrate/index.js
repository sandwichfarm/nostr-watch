import { MigrationFixRelayDuplicates } from './migrations/fix-non-normal-urls.js'

export default async(rcache) => {
  await MigrationFixRelayDuplicates(rcache)
}