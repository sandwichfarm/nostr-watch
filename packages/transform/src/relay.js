export class RelayRecord {
  /**
   * @type {string} Data indicating whether connect operation was successful
   */
  url = "";

  /**
   * @type {string} Data indicating whether read operation was successful
   */
  network = "";

  /**
   * @type {string} Data indicating whether write operation was successful
   */
  websocket = "";

  /**
   * @type {string} Duration of the connect operation
   */
  info = "";

  /**
   * @type {string} Duration of the read operation
   */
  geo = "";

  /**
   * @type {string} Duration of the write operation
   */
  dns = "";

  /**
   * @type {string} Identifier of the entity that checked the data
   */
  ssl = "";

  /**
   * @type {EpochTimeStamp} 
  */ 
  first_seen = -1; 
  
  /**
   * @type {EpochTimeStamp} 
  */ 
  last_seen = -1; 

  constructor(data) {
    this.url = data.url || "";
    this.network = data.network || "";
    this.websocket = data.websocket || "";
    this.info = data.info || "";
    this.geo = data.geo || "";
    this.dns = data.dns || "";
    this.ssl = data.ssl || "";
    this.first_seen = data.first_seen || -1;
    this.last_seen = data.last_seen || -1;
  }
}