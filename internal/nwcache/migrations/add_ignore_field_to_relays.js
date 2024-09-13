export const AddIgnoreFieldToRelays = async(rcache) => {
  let relays = await rcache.relay.get.all()
      relays = relays.filter( relay => 'ignore' in relay )
      relays = relays.map(r => r.url)

  if(!relays?.length) return console.log(`Migrate: AddIgnoreFieldToRelays: Migrate has already been completed, no additional fields found.`) 
    
  const patched = []
  for(const relay of relays) {
    console.log(`patching: ${relay}`)
    patched.push(await rcache.relay.patch({ url: relay, ignore: false }).catch(e => console.error(`Failed to patch ${relay}`, e)))
  }
  console.log(`${patched.length} relays patched with ignore field`)
  process.exit()
}