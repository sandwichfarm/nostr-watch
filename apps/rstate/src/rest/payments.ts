import type { FastifyReply, FastifyRequest } from 'fastify'
import { readFileSync } from 'node:fs'
import { loadPricing, type PricingEntry } from '../payments/pricing-loader.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'payments' })

export function isFeatureEnabled(name: string): boolean {
  const v = process.env[name]
  if (!v) return false
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'on'
}

/** Map canonical config names → REST route paths (only where they differ from /<name>) */
export const NAME_TO_ROUTE: Record<string, string> = {
  'relays/list':        '/relays',
  'monitors/get':       '/monitors/:pubkey',
  'monitors/list':      '/monitors',
}

function buildPolicyJson(entries: PricingEntry[]): any {
  const methods = (process.env.PAY_METHODS || 'L402,P2PK').split(',').map(s => s.trim())
  const ttlSeconds = parseInt(process.env.PAY_TTL_SECONDS || '3600', 10)

  const routes: Record<string, any> = {}
  for (const e of entries) {
    if (e.amount <= 0) continue
    const routePath = NAME_TO_ROUTE[e.name] ?? `/${e.name}`
    routes[routePath] = {
      priceMsat: e.amount * 1000,
      methods,
    }
  }

  return {
    defaults: { priceMsat: 0, methods, ttlSeconds },
    routes,
  }
}

let helper: any | null = null

async function initGateway(): Promise<any | null> {
  if (helper) return helper
  if (!isFeatureEnabled('FEATURE_402')) return null

  // Load policy from unified pricing config, or fall back to legacy JSON
  let json: any
  const basePath = process.env.PRICING_YAML
  if (basePath) {
    const overridePath = process.env.REST_PRICING_YAML
    const entries = loadPricing(basePath, overridePath)
    json = buildPolicyJson(entries)
  } else {
    // Legacy: direct JSON policy file
    const legacyPath = process.env.PAY_PRICES_JSON
    if (!legacyPath) return null
    json = JSON.parse(readFileSync(legacyPath, 'utf8'))
  }

  let mod: any
  try {
    mod = await import('nostrwatch-payments-gateway')
  } catch (e) {
    // payments-gateway not installed; disable gating
    return null
  }
  const { RestGatewayHelper, PaymentPolicyStore, LndRestProvider, LndGrpcProvider, RedisReceiptStore, CashuNutshellProvider, RedisPriceOverrides, PromMetrics } = mod
  const priceOverrides = process.env.REDIS_URL ? new RedisPriceOverrides(process.env.REDIS_URL, 'payments') : undefined
  const policy = priceOverrides ? PaymentPolicyStore.fromJson(json, priceOverrides) : new PaymentPolicyStore(json)

  // LND REST provider if configured and enabled
  const enableL402 = isFeatureEnabled('FEATURE_402_L402')
  let lnd: any = undefined
  if (enableL402) {
    const lndGrpcHost = process.env.LND_GRPC_HOST
    const lndProtoDir = process.env.LND_PROTO_DIR
    const lndTlsCert = process.env.LND_TLS_CERT_PATH
    const lndMac = process.env.LND_MACAROON_HEX
    const lndProtoJsonPath = process.env.LND_PROTO_JSON_PATH
    let descriptorJson: any | undefined
    if (lndProtoJsonPath) {
      try {
        descriptorJson = JSON.parse(readFileSync(lndProtoJsonPath, 'utf8'))
      } catch {
        // ignore
      }
    }
    // Use bundled proto descriptor as fallback when no proto dir/json path is configured
    if (!descriptorJson && !lndProtoDir) {
      try {
        descriptorJson = mod.LND_LIGHTNING_MIN
      } catch { /* ignore */ }
    }
    if (lndGrpcHost && lndMac && (descriptorJson || lndProtoDir)) {
      lnd = new LndGrpcProvider({ host: lndGrpcHost, protoDir: lndProtoDir, tlsCertPath: lndTlsCert, macaroonHex: lndMac, descriptorJson })
    } else {
      const lndUrl = process.env.LND_REST_URL
      if (lndUrl && lndMac) {
        lnd = new LndRestProvider({ baseUrl: lndUrl, macaroonHex: lndMac })
      }
    }
  }

  // Redis receipts if configured
  const receipts = process.env.REDIS_URL ? new RedisReceiptStore(process.env.REDIS_URL, { prefix: 'payments', ttlSeconds: 86400 }) : undefined

  // Cashu/Nutshell provider if configured and enabled
  const enableP2PK = isFeatureEnabled('FEATURE_402_P2PK')
  const mintUrl = process.env.CASHU_MINT_URL
  const cashuP2pkPubkey = process.env.CASHU_P2PK_PUBKEY
  const cashuPriv = process.env.CASHU_P2PK_PRIVATE_KEY
  let cashu: any = undefined
  if (enableP2PK && mintUrl) {
    const accepted = (process.env.CASHU_ACCEPTED_MINTS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    cashu = new CashuNutshellProvider({ mintUrl, p2pkPrivateKeyHex: cashuPriv, acceptedMints: accepted })
  }

  const l402RootKeyHex = process.env.L402_ROOT_KEY
  if (enableL402 && l402RootKeyHex) {
    if (!/^[0-9a-fA-F]{64}$/.test(l402RootKeyHex)) {
      logger.error('L402_ROOT_KEY is not a valid 64-character hex string; disabling L402')
      lnd = undefined
    }
  } else if (enableL402 && !l402RootKeyHex) {
    logger.error('L402_ROOT_KEY is not set; disabling L402')
    lnd = undefined
  }

  const metrics = new PromMetrics({ collectDefaults: true })
  const breaker = { l402: { failureThreshold: 3, cooldownMs: 30000 }, p2pk: { failureThreshold: 3, cooldownMs: 30000 } }
  const rateLimit = { windowMs: 60_000, max: 5 }
  helper = new RestGatewayHelper({ policy, lightning: lnd, receipts, l402RootKeyHex, cashu, cashuP2pkPubkey, metrics, breaker, rateLimit })
  return helper
}

export async function getPaymentsPreHandler() {
  const gw = await initGateway()
  if (!gw) return undefined

  return async function preHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
      // Resolve route key by path
      const routeKey = (req as any).routeOptions?.url || (req as any).routerPath || req.url.split('?')[0] || ''

      // If the route is free, do nothing
      const clientId = req.ip || (req.socket && (req.socket as any).remoteAddress) || 'unknown'
      const challenge = await gw.buildChallenge(routeKey, clientId)
      if (!challenge) return

      // Authorization path
      const auth = req.headers['authorization']
      if (auth) {
        const sp = auth.split(' ')
        if (sp.length >= 2) {
          const scheme = sp[0] as any
          const credentials = sp.slice(1).join(' ')
          const result = await gw.verify(routeKey, { scheme, credentials })
          if (result.allowed) return
        }
      }

      // No/invalid Authorization → emit challenge
      Object.entries(challenge.headers).forEach(([k, v]) => reply.header(k, v))
      return reply.code(402).send({ error: 'Payment Required' })
    } catch (e) {
      // Fail closed: require payment if configured
      return reply.code(402).send({ error: 'Payment Required' })
    }
  }
}
