import nostrings from '@nostrwatch/nostrings'

export const SanitizeRelayUrls = async (cache) => {

  const relays = (await cache.relay.get.all()).map(r => r.url)

  if(!relays?.length) return console.log(`Migrate: SanitizeRelayUrls: No relays found.`)

  // const relays = [
  //   'wss://filter.nostr.wine/?broadcast=true',
  //   'wss://filter.nostr.wine/',
  //   'wss://filter.nostr.wine/?global=all&broadcast=true',
  //   'wss://filter.nostr.wine/?broadcast=true&global=all',
  //   'wss://filter.nostr.wine/?global=all',
  //   'wss://filter.nostr.wine/1234',
  //   'wss://filter.nostr.wine/@pupa',
  //   'wss://filter.nostr.wine/@chris',
  //   'wss://filter.nostr.wine/classification',
  //   'wss://filter.nostr.wine/replacewithyourpubkey',
  //   'wss://filter.nostr.wine/replacewithyourpubkey?broadcast=true',
  //   'wss://filter.nostr.wine/3ba9b8cf58082bd37eec18455b26bb04a47f4a8e835ac18c7ea4348673ee1623?broadcast=true',
  //   'wss://filter.nostr.wine/3ba9b8cf58082bd37eec18455b26bb04a47f4a8e835ac18c7ea4348673ee1623',
  //   'wss://filter.nostr.wine/78b3c1ed0a53b072fcfb8cc2e2e09cad31c9bfec869d1c8745c343d55033eea9?broadcast=true',
  //   'wss://filter.nostr.wine/b6736a8a3b3b6a57cd403790dcf999ba3933fc57d30f60c2b45cd35cc3ce767b',
  //   'wss://filter.nostr.wine/f57d8cf57ba293a764cd30f3461ce21b0a3849c5c03533391a1074412602f7c9',
  //   'wss://filter.nostr.wine/07eced8b63b883cedbd8520bdb3303bf9c2b37c2c7921ca5c59f64e0f79ad2a6',
  //   'wss://filter.nostr.wine/4c800257a588a82849d049817c2bdaad984b25a45ad9f6dad66e47d3b47e3b2f?broadcast=true',
  //   'wss://filter.nostr.wine/4c800257a588a82849d049817c2bdaad984b25a45ad9f6dad66e47d3b47e3b2f',
  //   'wss://filter.nostr.wine/78b3c1ed0a53b072fcfb8cc2e2e09cad31c9bfec869d1c8745c343d55033eea9',
  //   'wss://filter.nostr.wine/nprofile1qqsf7dlju0m0nfcwrdl0f9upt5ktp6uuqaxtmmwykgd3c66wwlzj9kspzpmhxue69uhkummnw3ezuamfdejsacy5p8?broadcast=true',
  //   'wss://filter.nostr.wine/lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctttdehhwm30d3h82unvwqhkwunpw35hxcnfwf6xsv3nlmld66',
  //   'wss://filter.nostr.wine/lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctttdehhwm30d3h82unvwqhkwunpw35hxcnfwf6xsv3nlmld66?broadcast=true',
  //   'wss://filter.nostr.wine/lnbc88880n1p370fe9pp5gkpjt4pvgeu8054c5f2m5qc7luwqagpvvrup6ew24x9hjsewtm7qdy5dehhxarj9emkjmn9ypqkgmtfwdekjmmwyprx2efqvehhygrwwp6kyvtkwf6njuf5dc6xu7tw8qc8wwt8x34rw6m9dearxdmsdp58xdn60p6rymnvx3hxkumkxeunswrsv9ur2umnwdnhj6mwwfkqcqzpgxqzjcsp5fw6m7ccjp4xqcyjts37u36svk0yly855f9qm8e67g7f6zcskvxjq9qyyssqhzng9vtlm39yqcuh0ynzk9aq3p4wsyd2z8hpaymjue0fyr3mfjmrcvd4ef68pntujgftjxyhcvunhtu2fsdhcudtwt9vu9ynyt7segcps4za54'
  // ]

  let sanitized = []

  function diffBetweenArrays(array1, array2) {
    const set1 = new Set(array1);
    const set2 = new Set(array2);
  
    const diff1 = array1.filter(item => !set2.has(item)); // In array1 but not in array2
    const diff2 = array2.filter(item => !set1.has(item)); // In array2 but not in array1
  
    return {
      onlyInFirstArray: diff1,
      onlyInSecondArray: diff2
    };
  }
  

  try {
    sanitized = nostrings.sanitize.relayUrls(relays)
  }
  catch(e){""}

  const toBeRemoved = diffBetweenArrays(relays, sanitized).onlyInFirstArray

  console.log('sanitized counts', relays.length, sanitized.length)

  const removed = []
  toBeRemoved.forEach( async (relay) => {
    removed.push(await cache.relay.delete(relay))
  })
  console.log('relays removed', removed.length)
}