const fetch = require('cross-fetch'),
      fs = require('fs'),
      YAML = require('yaml')

let object,
    yaml,
    result,
    relayUrls = fs.readFileSync('./relays.yaml', 'utf8'),
    geoCache = fs.readFileSync('./cache/geo.yaml', 'utf8'),
    continents = fs.readFileSync('./cache/continents.json', 'utf8')

const getDns = async function(relay){
  let dns
  await fetch(`https://1.1.1.1/dns-query?name=${relay.replace('wss://', '')}`, { headers: { 'accept': 'application/dns-json' } })
    .then(response => response.json())
    .then((data) => { dns = data.Answer ? data.Answer : false })
    .catch(err => console.log('./scripts/geo.js', err))
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
  let geo
  await fetch(`http://ip-api.com/json/${ip}`, { headers: { 'accept': 'application/dns-json' } })
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

const query = async function(){

  const relays = YAML.parse(relayUrls).relays.reverse(),
        result = YAML.parse(geoCache).geo || {}

  for (const relay of relays) {
    await delay(1000).then(async () => {
      console.log('getting relay geo', relay)

      let dns, ip, geo

      dns = await getDns(relay).catch()
      ip = await getIp(dns).catch()
      geo = await getGeo(ip).catch()

      if(geo)
        geo = Object.assign(geo, getContinent(geo.countryCode))

      if(geo && dns){
        geo.dns = dns[dns.length-1]
        delete geo.status
      }
  
      if(geo && geo.status == 'success')
        result[relay] = geo

      if(!geo)
        console.warn('api was mean, no geo for', relay)
    })
    
  }

  return result
}

const run = async function(){
  result = await query()
  object = { geo: result }
  yaml = new YAML.Document()
  yaml.contents = object
  // console.log(object)
  fs.writeFile('./cache/geo.yaml', yaml.toString(), (err) => {
    if (err) return console.error('./scripts/geo.js', err);
  });
}

run()

