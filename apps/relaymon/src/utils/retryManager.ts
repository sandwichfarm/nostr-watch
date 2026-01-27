export interface RetryConfig {
    max: number;
    delay: number;
  }
  
  export class RetryManager {
    config: RetryConfig[];
  
    constructor(config: RetryConfig[]) {
      this.config = config.sort((a, b) => a.max - b.max);
    }
  
    getDelay(retries: number): number {
      for (const entry of this.config) {
        if (retries <= entry.max) {
          return entry.delay;
        }
      }
      return this.config[this.config.length - 1].delay;
    }
  }
  