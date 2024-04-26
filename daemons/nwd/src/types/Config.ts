import type { IdentityConfig } from './Identity'

export type Config = {
  daemon?: {
    identity?: IdentityConfig,
  },
  plugins?: {
    cache?: any,
    worker?: any,
    queue?: any,
    sync?: any
  }
}