import dotenv from 'dotenv'
dotenv.config()

//geo
import { daemons } from '@/config/nwd-geo.yaml'
import { getDistance } from 'geolib';
import { continents } from '../../cache/continents.json'

export const timeSince = function(date) {
  var seconds = Math.floor((new Date() - date) / 1000);
  var interval = seconds / 31536000;
  if (interval > 1) {
    return Math.floor(interval) + " years";
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return Math.floor(interval) + " months";
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return Math.floor(interval) + " days";
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return Math.floor(interval) + " hours";
  }
  interval = seconds / 60;
  if (interval > 1) {
    return Math.floor(interval) + " minutes";
  }
  return Math.floor(seconds) + " seconds";
}

export const getClosest = function(visitorGeo){
  const distances = []
  Object.keys(daemons).forEach( region => {
    // console.log('type', region, daemons, typeof daemons[region].lon, daemons[region].lon)
    const distance = getDistance(
      { latitude: visitorGeo.lat, longitude: visitorGeo.lon },
      { latitude: daemons[region].lat, longitude: daemons[region].lon }
    )
    distances.push({ region: region, distance: distance })
  })
  distances.sort( (a, b) => {
    return a.distance - b.distance
  })
  return distances[0].region
}

export const getGeo = async function(relay){
  let dns, ip, geo
  dns = await getDnsFromRelay(relay).catch()
  ip = await getIPFromDNS(dns).catch()
  geo = await getGeoFromIP(ip).catch()
  if(geo)
    geo = Object.assign(geo, getContinentFromCountryCode(geo.countryCode))
  if(geo && dns)
    geo.dns = dns[dns.length-1]
  if(geo && geo.status == 'success') {
    delete geo.status
  }
  if(!geo)
    console.warn(`no geo result for: ${relay}`)
  return geo
}

export const getVisitorGeo = async function() {
  let geo
  console.log('ip-api key', process.env.VUE_APP_IP_API_KEY)
  const url = process.env.VUE_APP_IP_API_KEY ? `https://pro.ip-api.com/json/?fields=ip,lat,lon&key=${process.env.VUE_APP_IP_API_KEY}` : `http://ip-api.com/json/?fields=ip,lat,lon`
  await fetch(url, { headers: { 'accept': 'application/dns-json' } })
          .then(response => response.json())
          .then((data) => { geo = data })
          .catch(err => console.error('./scripts/geo.js', err))
  return geo;
}

export const getIPFromDNS = async function(dns){
  let ip;
  if(dns)
    ip = dns[dns.length-1].data
  return ip
}

export const getContinentFromCountryCode = function(countryCode) {
  return JSON.parse(continents)
    .filter( c => c.country_code == countryCode )
    .map( cont => {
      return {
        continentCode: cont.continent_code,
        continentName: cont.continent_name
      }
    })[0]
}

export const getGeoFromIP = async function(ip){
  const query = new URL(ip).hostname
  let geo
  // console.log('ip-api key', process.env.VUE_APP_IP_API_KEY)
  const url = process.env.VUE_APP_IP_API_KEY ? `https://pro.ip-api.com/json/${query}?key=${process.env.VUE_APP_IP_API_KEY}` : `http://ip-api.com/json/`
  await fetch(url, { headers: { 'accept': 'application/dns-json' } })
          .then(response => response.json())
          .then((data) => { geo = data })
          .catch(err => console.error('./scripts/geo.js', err))
  return geo;
}

export const getDnsFromRelay = async function(relay){
  const query = new URL(relay).hostname
  let dns
  await fetch(`https://1.1.1.1/dns-query?name=${query}`, { headers: { 'accept': 'application/dns-json' } })
    .then(response => response.json())
    .then((data) => { dns = data.Answer ? data.Answer : false })
    .catch(err => console.error('./scripts/geo.js', err))
  return dns
}