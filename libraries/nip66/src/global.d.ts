declare module '*.worker.ts' {
  class WebpackWorker extends SharedWorker {
    constructor();
  }

  export default WebpackWorker;
}

declare module 'jwt-encode';