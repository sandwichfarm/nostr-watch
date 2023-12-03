import { RelayCheck } from './headers.js'

export class RelayCheckWebsocket extends RelayCheck {
  /**
   * @type {boolean|null} Data indicating whether connect operation was successful
   */
  connect = null;

  /**
   * @type {boolean|null} Data indicating whether read operation was successful
   */
  read = null;

  /**
   * @type {boolean|null} Data indicating whether write operation was successful
   */
  write = null;

  /**
   * @type {number} Duration of the connect operation
   */
  connectDuration = -1;

  /**
   * @type {number} Duration of the read operation
   */
  readDuration = -1;

  /**
   * @type {number} Duration of the write operation
   */
  writeDuration = -1;

  /**
   * @type {string} Identifier of the entity that checked the data
   */
  checked_by = '';

  constructor(data) {
    super(data);
    this.checked_by = data.checked_by || '';
  }

  out() {
    const nocapResult = this.setHeadersToNocap(nocapResult);
    nocapResult.connect = { data: this.connect, duration: this.connectDuration };
    nocapResult.read = { data: this.read, duration: this.readDuration };
    nocapResult.write = { data: this.write, duration: this.writeDuration };
    return nocapResult;
  }

  fromNocap(nocapResult) {
    this.setHeadersFromNocap(nocapResult);

    this.connect = nocapResult.connect ? nocapResult.connect.data : null;
    this.read = nocapResult.read ? nocapResult.read.data : null;
    this.write = nocapResult.write ? nocapResult.write.data : null;
    this.connectDuration = nocapResult.connect ? nocapResult.connect.duration : -1;
    this.readDuration = nocapResult.read ? nocapResult.read.duration : -1;
    this.writeDuration = nocapResult.write ? nocapResult.write.duration : -1;
    
    return this
  }
}