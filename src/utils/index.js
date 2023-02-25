import { RelayPool } from 'nostr'
import { continents } from '../../cache/continents.js'
import crypto from 'crypto'
import { daemons } from '@/config/nwd-geo.yaml'
import { getDistance } from 'geolib'

export const timeSince = date => {
  const delta = (Date.now() - date) / 1000
  const seconds = Math.floor(delta)

  if (seconds < 60) {
    return `${Math.floor(seconds)} seconds`
  }

  const intervals = [
    {label: 'years', value: 31536000},
    {label: 'months', value: 2592000},
    {label: 'days', value: 86400},
    {label: 'hours', value: 3600},
    {label: 'minutes', value: 60}
  ]

  for (const {label, value} of intervals) {
    const interval = seconds / value
    if (interval >= 1) {
      return `${Math.floor(interval)} ${label}`
    }
  }

  return `${Math.floor(seconds)} seconds`
}

export const getClosest = visitorGeo => {
  const distances = Object.keys(daemons).map(region => {
    const distance = getDistance(
      {latitude: visitorGeo.lat, longitude: visitorGeo.lon},
      {latitude: daemons[region].lat, longitude: daemons[region].lon}
    )
    return {region: region, distance: distance}
  })
  distances.sort((a, b) => a.distance - b.distance)
  return distances[0].region
}

export const getGeo = async function (relay) {
  let dns, ip, geo
  try {
    dns = await getDnsFromRelay(relay)
    ip = await getIPFromDNS(dns)
    geo = await getGeoFromIP(ip)
  } catch (err) {
    console.warn(`no geo result for: ${relay}`)
    return
  }
  if (geo) {
    geo = {
      ...geo,
      ...getContinentFromCountryCode(geo.countryCode)
    }
  }
  if (geo && dns) {
    geo.dns = dns[dns.length - 1]
  }
  if (geo && geo.status === 'success') {
    delete geo.status
  }
  return geo
}

export const getVisitorGeo = async function () {
  //console.log('ip-api key', process.env.VUE_APP_IP_API_KEY)
  let geo
  const url = process.env.VUE_APP_IP_API_KEY
    ? `https://pro.ip-api.com/json/?fields=ip,lat,lon&key=${process.env.VUE_APP_IP_API_KEY}`
    : `http://ip-api.com/json/?fields=ip,lat,lon`
  await fetch(url, {headers: {accept: 'application/dns-json'}})
    .then(response => response.json())
    .then(data => {
      geo = data
    })
    .catch(err => console.error('./scripts/geo.js', err))
  return geo
}

export const getIPFromDNS = async function (dns) {
  let ip
  if (dns) ip = dns[dns.length - 1].data
  return ip
}

export const getContinentFromCountryCode = function (countryCode) {
  return continents
    .filter(c => c.country_code == countryCode)
    .map(cont => {
      return {
        continentCode: cont.continent_code,
        continentName: cont.continent_name
      }
    })[0]
}

export const getGeoFromIP = async function (ip) {
  const query = ip
  let geo
  const url = process.env.VUE_APP_IP_API_KEY
    ? `https://pro.ip-api.com/json/${query}?key=${process.env.VUE_APP_IP_API_KEY}`
    : `http://ip-api.com/json/`
  await fetch(url, {headers: {accept: 'application/dns-json'}})
    .then(response => response.json())
    .then(data => {
      geo = data
    })
    .catch(err => console.error('./scripts/geo.js', err))
  return geo
}

export const getDnsFromRelay = async function (relay) {
  const query = new URL(relay).hostname
  let dns
  await fetch(`https://1.1.1.1/dns-query?name=${query}`, {
    headers: {accept: 'application/dns-json'}
  })
    .then(response => response.json())
    .then(data => {
      dns = data.Answer ? data.Answer : false
    })
    .catch(err => console.error('./scripts/geo.js', err))
  return dns
}

export const subscribeKind3 = async function (pubkey, relays) {
  const pool = new RelayPool(relays, {reconnect: true})
  const subid = crypto.randomBytes(40).toString('hex')
  const ordered = []
  const total = relays.length
  let eose = 0

  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve({}), 10000)

    pool
      .on('open', r => {
        r.subscribe(subid, {
          limit: 1,
          kinds: [3],
          authors: [pubkey]
        })
      })
      .on('event', (relay, _subid, ev) => {
        if (_subid !== subid) return
        if (!ev.content.length) return
        try {
          ev.content = JSON.parse(ev.content)
        } catch (e) {
          ev.content = {}
        }
        ordered.push(ev)
      })
      .on('eose', () => {
        eose++
        if (eose < total) return
        ordered.sort((a, b) => b.created_at - a.created_at)
        try {
          pool.close()
        } catch (e) {}
        clearTimeout(timeout)
        resolve(ordered[0])
      })
      .on('error', () => {})
  })
}
