import dotenv from 'dotenv'
dotenv.config()

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

export const GeoIPGeo = async function(wss){
  let dns
  await fetch(`https://1.1.1.1/dns-query?name=${wss.replace('wss://', '')}`, { headers: { 'accept': 'application/dns-json' } })
    .then(response => response.json())
    .then((data) => { dns = data.Answer ? data.Answer : false })
    .catch(err => console.error('./scripts/geo.js', err))
  return dns
}

export const getDns = async function(relay){
  let dns
  await fetch(`https://1.1.1.1/dns-query?name=${relay.replace('wss://', '')}`, { headers: { 'accept': 'application/dns-json' } })
    .then(response => response.json())
    .then((data) => { dns = data.Answer ? data.Answer : false })
    .catch(err => console.error('./scripts/geo.js', err))
  return dns
}