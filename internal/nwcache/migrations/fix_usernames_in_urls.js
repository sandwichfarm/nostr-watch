export const MigrationFixUsernamesInUrls = async (rcache) => {
  const allRelays = await rcache.relay.get.all(['url']).map( relay => relay.url )
  const deleted = []
  for(const relay of allRelays) {
    const url = new URL(relay)
    if(url.username !== '') {
      deleted.push(await rcache.relay.delete(relay))
      // deleted.push(relay)
    }
  }
  console.log(`deleted ${deleted.length} usernames from urls`)
  console.log(deleted)
}