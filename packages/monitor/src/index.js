const fs = require('fs');
const path = require('path');

import { generatePrivateKey, getPublicKey } from 'nostr-tools'
import { setEnvValue } from '@nostrwatch/utils'

class Monitor {
    
  constructor( slug, id, opts ){
    if(!slug || !id ) throw new Error(`Both slug and id are required`)

    this.slug = slug
    this.id = id

    this.keys = new Object()

    this.setup(opts)
  }

  init(){
    
  }

  setup(opts){
    this.config_dir = opts?.config_dir? this.sanitizePath(opts.config_dir): `~/.nostrwatch`
    this.monitor_config = this.getConfigFile()
  }

  createConfig( conf ){

  }

  parseConfig(){

  }

  wasInit(){
    if()
  }

  generateKeys(){
    this.keys.private = generatePrivateKey()
    this.keys.public = getPublicKey(this.keys.private
  }

  memoryWipeKeys(){
    this.keys = new Object()
  }
  
  configWipe(){
    this.deleteMonitorConfig()
  }

  getConfigFile(){
    return `${config_dir}/@${this.slug}_${this.id}`
  }

  setKeysToEnv(){
    setEnvValue('DAEMON_PUBKEY', this.keys.public)
    setEnvValue('DAEMON_PRIVKEY', this.keys.private)
  }

  sanitizePath(path) {
    if (path.endsWith('/')) {
      return path.slice(0, -1);
    }
    return path;
  }

  // Check if the config directory exists
  configDirExists() {
    return fs.existsSync(this.config_dir);
  }

  // Create the config directory
  createConfigDir() {
    if (!this.configDirExists()) {
      fs.mkdirSync(this.config_dir, { recursive: true });
    }
  }

  // Check if the monitor_config file exists
  monitorConfigExists() {
    return fs.existsSync(this.monitor_config);
  }

  // Delete the monitor_config file
  deleteMonitorConfig() {
    if (this.monitorConfigExists()) {
      fs.unlinkSync(this.monitor_config);
    }
  }

  // Create the monitor_config file with provided JSON object
  createMonitorConfig( jsonObj ) {
    const formattedJson = JSON.stringify(jsonObj, null, 4); // Prettify with 4 spaces indentation
    fs.writeFileSync(this.monitor_config, formattedJson);
  }

}


const monitor = new Monitor( 
  'nocapd',  
  'us-east',
  {
    publicKey: '',
    relays: [], 
    checks: [],
    interval: {},
    timeout: {},
    
  }
)