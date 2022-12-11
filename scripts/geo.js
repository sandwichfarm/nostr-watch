const fetch = require('cross-fetch'),
      // relays = require('../relays.yaml'),
      fs = require('fs'),
      YAML = require('yaml')

let object,
    yaml,
    result,
    file = fs.readFileSync('./relays.yaml', 'utf8')

const getDns = async function(relay){
  let dns
  await fetch(`https://1.1.1.1/dns-query?name=${relay.replace('wss://', '')}`, { headers: { 'accept': 'application/dns-json' } })
    .then(response => response.json())
    .then((data) => { dns = data.Answer ? data.Answer : false })
    .catch(err => console.log('./scripts/geo.js', err))
  return dns
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
          .catch(err => console.log('./scripts/geo.js', err))
  return geo;
}

const query = async function(){

  const relays = YAML.parse(file).relays,
        result = {}

  for (const relay of relays) {
    let dns, ip, geo
    dns = await getDns(relay)
    ip = await getIp(dns)
    // console.log(dns, ip)
    geo = await getGeo(ip)

    console.log(geo, ip, dns)

    if(dns)
      geo.dns = dns[dns.length-1]

    if(geo.status == 'success')
      result[relay] = geo
  }

  return result
}

const run = async function(){
  result = await query()
  object = { geo: result }
  yaml = new YAML.Document()
  yaml.contents = object
  // console.log(object)
  fs.writeFile('./geo.yaml', yaml.toString(), (err) => {
    if (err) return console.log('./scripts/geo.js', err);
  });
}

run()
