const fetch = require('cross-fetch'),
      fs = require('fs'),
      YAML = require('yaml'),

      outFile = './cache/geo.yaml'

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
  let geo;
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}`, { headers: { 'accept': 'application/dns-json' } });
    geo = await response.json();
  } catch (err) {
    console.error('./scripts/geo.js', err);
  }
  return geo;
}

const getContinent = function(countryCode) {
  const continent = JSON.parse(continents).find(c => c.country_code == countryCode);
  return {
    continentCode: continent.continent_code,
    continentName: continent.continent_name
  };
}

const query = async function(){
  const relays = YAML.parse(relayUrls).relays.reverse(),
        result = YAML.parse(geoCache).geo || {};

  for (const relay of relays) {
    await delay(1000).then(async () => {
      let dns, ip, geo;

      try {
        dns = await getDns(relay);
        ip = await getIp(dns);
        geo = await getGeo(ip);
      } catch (err) {
        console.warn('api was mean, no geo for', relay);
      }

      if(geo) {
        geo = Object.assign(geo, getContinent(geo.countryCode));
        geo.dns = dns[dns.length-1];
      }

      if(geo && geo.status == 'success') {
        delete geo.status;
        result[relay] = geo;
      }
    });
  }
  return result;
}

const run = async function(){
  result = await query()
  object = { geo: result }
  yaml = new YAML.Document()
  yaml.contents = object
  //console.log(object)
  fs.writeFile(outFile, yaml.toString(), (err) => {
    if (err) return console.error('./scripts/geo.js', err);
  });
}

run()

