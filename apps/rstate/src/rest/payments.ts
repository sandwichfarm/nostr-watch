import type { FastifyReply, FastifyRequest } from 'fastify'
import { readFileSync } from 'node:fs'

export function isFeatureEnabled(name: string): boolean {
  const v = process.env[name]
  if (!v) return false
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'on'
}

let helper: any | null = null

async function initGateway(): Promise<any | null> {
  if (helper) return helper
  if (!isFeatureEnabled('FEATURE_402')) return null

  // Load policy
  const policyPath = process.env.PAY_PRICES_JSON
  if (!policyPath) return null
  const json = JSON.parse(readFileSync(policyPath, 'utf8'))
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
  const cashu = enableP2PK && mintUrl ? new CashuNutshellProvider({ mintUrl, p2pkPrivateKeyHex: cashuPriv }) : undefined

  const l402RootKeyHex = process.env.L402_ROOT_KEY

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
      const url = req.raw.url || req.url
      const routeKey = url.split('?')[0] || ''

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
