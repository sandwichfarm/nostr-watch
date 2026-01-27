/**
 * ContextVM SDK Type Stubs
 *
 * TEMPORARY: These are placeholder types until @contextvm/sdk is available.
 * Once the SDK is published, replace these imports with:
 * - import { NostrServerTransport } from '@contextvm/sdk/transport'
 * - import { ApplesauceRelayPool } from '@contextvm/sdk/relay'
 * - import { PrivateKeySigner } from '@contextvm/sdk/signer'
 */

/**
 * Encryption mode for CVM server
 */
export enum EncryptionMode {
  OPTIONAL = 'OPTIONAL',
  REQUIRED = 'REQUIRED',
  DISABLED = 'DISABLED',
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, any>
  outputSchema?: Record<string, any>
  handler: (params: any) => Promise<any>
}

/**
 * Nostr relay pool interface
 * TODO: Replace with ApplesauceRelayPool from @contextvm/sdk/relay
 */
export interface RelayPool {
  connect(): Promise<void>
  disconnect(): Promise<void>
  subscribe(filters: any[], onEvent: (event: any) => void, onEose?: () => void): { unsubscribe: () => void }
  publish(event: any): Promise<void>
}

/**
 * Private key signer interface
 * TODO: Replace with PrivateKeySigner from @contextvm/sdk/signer
 */
export interface Signer {
  getPublicKey(): string
  sign(event: any): Promise<any>
}

/**
 * Nostr Server Transport configuration
 */
export interface NostrServerTransportConfig {
  relayPool: RelayPool
  signer: Signer
  encryptionMode: EncryptionMode
  serverInfo?: {
    name?: string
    description?: string
    version?: string
  }
  allowedPubkeys?: string[]
}

/**
 * Nostr Server Transport class
 * TODO: Replace with NostrServerTransport from @contextvm/sdk/transport
 */
export class NostrServerTransport {
  private config: NostrServerTransportConfig
  private tools: Map<string, MCPTool> = new Map()
  private startTime: number = Date.now()

  constructor(config: NostrServerTransportConfig) {
    this.config = config
  }

  /**
   * Register an MCP tool
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    await this.config.relayPool.connect()
    // TODO: Set up Nostr event subscriptions for MCP requests (kind 25910)
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this.config.relayPool.disconnect()
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): any {
    return {
      tools: Array.from(this.tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
      serverInfo: this.config.serverInfo,
      encryptionMode: this.config.encryptionMode,
    }
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000)
  }
}

/**
 * Create a mock relay pool (for development)
 * TODO: Replace with real ApplesauceRelayPool
 */
export class MockRelayPool implements RelayPool {
  private relays: string[]

  constructor(relays: string[]) {
    this.relays = relays
    console.log(`[MockRelayPool] Initialized with ${relays.length} relays`)
  }

  async connect(): Promise<void> {
    console.log(`[MockRelayPool] Connected to ${this.relays.length} relays`)
  }

  async disconnect(): Promise<void> {
    console.log('[MockRelayPool] Disconnected')
  }

  subscribe(filters: any[], onEvent: (event: any) => void): { unsubscribe: () => void } {
    console.log('[MockRelayPool] Subscribed with filters:', filters)
    void onEvent
    return {
      unsubscribe: () => {
        console.log('[MockRelayPool] Unsubscribed')
      },
    }
  }

  async publish(event: any): Promise<void> {
    console.log('[MockRelayPool] Published event:', event.kind)
  }
}

/**
 * Create a mock signer (for development)
 * TODO: Replace with real PrivateKeySigner
 */
export class MockSigner implements Signer {
  private privateKey: string

  constructor(privateKey: string) {
    this.privateKey = privateKey
  }

  getPublicKey(): string {
    // TODO: Derive actual public key from private key
    return 'mock_pubkey_' + this.privateKey.slice(0, 8)
  }

  async sign(event: any): Promise<any> {
    // TODO: Actually sign the event
    return {
      ...event,
      sig: 'mock_signature',
    }
  }
}
