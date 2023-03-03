// THIS IS A PREBUILD SCRIPT, IT IS USED FOR EDGE CASES LIKE AD-BLOCKERS AND BRAVE BROWSER.

const fetch = require('cross-fetch'),
      fs = require('fs'),
      YAML = require('yaml'),
      outFile = './public/geo.json',
      dotenv = require('dotenv')

let object,
    yaml,
    relayUrls = fs.readFileSync('./relays.yaml', 'utf8'),
    continents = fs.readFileSync('./cache/continents.json', 'utf8')

dotenv.config()

const getDns = async function(relay){
  let dns
  await fetch(`https://1.1.1.1/dns-query?name=${relay.replace('wss://', '')}`, { headers: { 'accept': 'application/dns-json' } })
    .then(response => response.json())
    .then((data) => { dns = data.Answer ? data.Answer : false })
    .catch(err => console.error('./scripts/geo.js', err))
  return dns
}

const delay = async function(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const getIp = async function(dns){
  let ip;
  if(dns)
    ip = dns[dns.length-1].data
  return ip
}

const getGeo = async function(ip) {
  let geo,
      endpoint

  if(process.env.VUE_APP_IP_API_KEY)
    endpoint = `https://pro.ip-api.com/json/${ip}?key=${process.env.VUE_APP_IP_API_KEY}`
  else 
    endpoint = `http://ip-api.com/json/${ip}`

  await fetch(endpoint, { headers: { 'accept': 'application/json' } })
          .then(response => response.json())
          .then((data) => { geo = data })
          .catch(err => console.error('./scripts/geo.js', err))
  return geo;
}

const getContinent = function(countryCode) {
  return JSON.parse(continents)
    .filter( c => c.country_code == countryCode )
    .map( cont => {
      return {
        continentCode: cont.continent_code,
        continentName: cont.continent_name
      }
    })[0]
}

const getRelays = async function(){
  let relays,
      relaysCache = YAML.parse(relayUrls).relays.reverse()
      
  response = await fetch(`https://api.nostr.watch/v1/online`)

  console.log('retrieved online relays via api')
  let relaysArr = await response.json()

  if(!relaysArr && !relaysArr?.length)
    return relaysCache

  relays = Array.from(new Set([...relaysArr, ...relaysCache]))
  return relays
}

const query = async function(){
  const relays = await getRelays()
  console.log(`getRelays(): ${relays.length} relays`)
  console.log('using api key:', process.env.VUE_APP_IP_API_KEY)
  
  let result = {}

  let count = 1

  for (const relay of relays) {
    if(!process.env.VUE_APP_IP_API_KEY)
      await delay(1501) //free version of ip-api is rated limited to 45 reqs/m

    let dns, ip, geo

    dns = await getDns(relay).catch( err => console.error(err))
    ip = await getIp(dns).catch( err => console.error(err))
    geo = await getGeo(ip).catch( err => console.error(err))

    // console.log('relay', dns, ip, geo)

    if(geo)
      geo = Object.assign(geo, getContinent(geo.countryCode))

    if(geo && dns)
      geo.dns = dns[dns.length-1]

    if(geo && geo.status == 'success') {
      delete geo.status
      result[relay] = geo
    }

    console.log(`#${count++}`, ip, 'done')

    if(!geo)
      console.warn('api was mean, no geo for', relay)

  }
  return result
}

const run = async function(){
  geo = await query()
  //console.log(object)
  fs.writeFile(outFile, JSON.stringify(geo), (err) => {
    if (err) return console.error('./scripts/geo.js', err);
  });
}

run()

