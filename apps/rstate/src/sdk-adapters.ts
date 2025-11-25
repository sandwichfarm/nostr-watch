/**
 * SDK Adapters
 *
 * Adapts @contextvm/sdk interfaces to our internal interfaces
 */

import type { ApplesauceRelayPool as SDKRelayPool } from '@contextvm/sdk'
import type { RelayPool } from './sdk-stubs.js'

/**
 * Adapter that wraps ApplesauceRelayPool to match our RelayPool interface
 *
 * The SDK's subscribe() returns Promise<void> and tracks subscriptions internally,
 * while our code expects { unsubscribe: () => void } to be returned.
 */
export class RelayPoolAdapter implements RelayPool {
  constructor(private sdkPool: SDKRelayPool) {}

  async connect(): Promise<void> {
    await this.sdkPool.connect()
  }

  async disconnect(): Promise<void> {
    await this.sdkPool.disconnect()
  }

  /**
   * Subscribe to events
   *
   * Note: The SDK's ApplesauceRelayPool.subscribe() returns Promise<void>
   * and manages subscriptions internally via unsubscribe(). We adapt this
   * by returning an object with unsubscribe that calls the pool's global
   * unsubscribe method.
   */
  subscribe(filters: any[], onEvent: (event: any) => void, onEose?: () => void): { unsubscribe: () => void } {
    // Start the subscription (fire and forget)
    void this.sdkPool.subscribe(filters, onEvent, onEose)

    // Return unsubscribe handle that calls the pool's unsubscribe
    return {
      unsubscribe: () => {
        this.sdkPool.unsubscribe()
      },
    }
  }

  async publish(event: any): Promise<void> {
    await this.sdkPool.publish(event)
  }
}
