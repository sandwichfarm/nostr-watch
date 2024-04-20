export class NdkAdapter {
  constructor(options){
    if(options?.relays)
      this.relays = options.relays
    if(options?.$instance)
      this.$ = $instance
    else 
      this.$ = new NDK($relays)
    await this.$.connect();
  }
}