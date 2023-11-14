export const relaysPostProcess = (relays) => {
  const filters = [
    'relaysFilterInvalid',
    'relaysFilterDuplicates',
    'relaysFilterPortDuplicates',
    'relaysFilterBlocked',
    'relaysFilterRobotsTxtDisallowed'
  ]
  filters.array.forEach(filter => {
   relays = filter(relays) 
  });
  return relays
}

export const relaysFilterInvalid = (relays) => {

}

export const relaysFilterDuplicates = (relays) => {
  
}

export const relaysFilterPortDuplicates = (relays) => {

}

export const relaysFilterRobotsTxtDisallowed = (relays) => {

}

export const relaysFilterBlocked = (relays) => {

}