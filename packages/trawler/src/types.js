/**
 * @typedef {Object} Relay
 * @property {number} age
 */

/** @type {Relay} */
const Relay = { 
  url: '', 
  online: false, 
  read: false, 
  write: false,
  info: {},
  found: new Date().getTime(),
  last_online: null,
  first_online: new Date().getTime(),
  network: 'clearnet',
};


/**
 * @typedef {Object} RelayInfo
 * @property {number} age
 */

/** @type {RelayInfo} */
const RelayInfo = {}