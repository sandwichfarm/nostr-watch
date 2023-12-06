import { RelayCheck } from './headers.js'

export class RelayCheckWebsocket extends RelayCheck {

  constructor(data) {
    super(data);
      /**
       * @type {boolean|null} Data indicating whether connect operation was successful
       */
      this.connect = null;

      /**
       * @type {boolean|null} Data indicating whether read operation was successful
       */
      this.read = null;

      /**
       * @type {boolean|null} Data indicating whether write operation was successful
       */
      this.write = null;

      /**
       * @type {number} Duration of the connect operation
       */
      this.connectDuration = -1;

      /**
       * @type {number} Duration of the read operation
       */
      this.readDuration = -1;

      /**
       * @type {number} Duration of the write operation
       */
      this.writeDuration = -1;
  }

  toNocap() {
    const nocapResult = this.setHeadersToNocap({});
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