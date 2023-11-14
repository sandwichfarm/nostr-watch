import 'dotenv/config'
import { appendFile } from 'fs/promises'
import config from './config.js'
import createLogger from 'logging';

//wrapper for logging: https://www.npmjs.com/package/logging
export default class Logger {

  constructor(name, log_level, split_logs=false) {
    // this.logger = createLogger?.default? createLogger.default(name): createLogger()
    this.log_level = log_level || config?.log_level || 'INFO';
    this.split_logs = split_logs || false
  }

  fatal(message) {
    if (['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].includes(this.log_level)) {
        // this.logger?.err(`FATAL: ${message}`);
        this.write(message)
    }
  }
  
  err(message) {
    if (['ERROR', 'WARN', 'INFO', 'DEBUG'].includes(this.log_level)) {
        // this.logger.err(message);
        this.write(message)
    }
  }
  
  warn(message) {
    if (['WARN', 'INFO', 'DEBUG'].includes(this.log_level)) {
        // this.logger.warn(message);
        this.write(message)
    }
  }
  
  info(message) {
    if (['INFO', 'DEBUG'].includes(this.log_level)) {
        // this.logger.info(message);
        this.write(message)
    }
  }
  
  debug(message) {
    if (['DEBUG'].includes(this.log_level)) {
        // this.logger.debug(message);
        this.write(message)
    }
  }
  
  async write(message){
    const dir = config?.write_logs
    if(!dir?.length) return
    let filepath
    if(this.name && this.split_logs)
      filepath = `${dir}/${id}.log`
    else 
      filepath = `${dir}/debug.log`
    await appendFile(filepath, `${this.log_level}: ${message}\n`)
  }
}
