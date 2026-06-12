import type { FastifyInstance } from 'fastify'
import type { RestContext } from '../server.js'

export async function registerPaymentsHealthRoutes(app: FastifyInstance, _context: RestContext): Promise<void> {
  app.get('/health/payments', {
    schema: {
      tags: ['health'],
      description: 'Payments gateway health status',
      response: {
        200: {
          type: 'object',
          properties: {
            featureEnabled: { type: 'boolean' },
            healthy: { type: 'boolean' },
            methods: {
              type: 'object',
              properties: {
                l402: { type: 'boolean' },
                p2pk: { type: 'boolean' },
              },
            },
            lnd: {
              type: 'object',
              properties: {
                grpc: {
                  type: 'object',
                  properties: {
                    configured: { type: 'boolean' },
                    healthy: { type: 'boolean' },
                  },
                },
                rest: {
                  type: 'object',
                  properties: {
                    configured: { type: 'boolean' },
                    healthy: { type: 'boolean' },
                  },
                },
              },
            },
            p2pk: {
              type: 'object',
              properties: {
                configured: { type: 'boolean' },
                healthy: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (_req, _reply) => {
    const feature = process.env.FEATURE_402 === 'true' || process.env.FEATURE_402 === '1';
    const res: any = {
      featureEnabled: feature,
      healthy: false,
      methods: { l402: false, p2pk: false },
      lnd: {
        grpc: { configured: false, healthy: false },
        rest: { configured: false, healthy: false },
      },
      p2pk: { configured: false, healthy: false },
    };
    if (!feature) return res;
    try {
      // @ts-expect-error optional dependency — not always installed
      const gw = await import('nostrwatch-payments-gateway');
      const { checkLndGrpc, checkLndRest } = gw as any;
      // Check L402 (LND) availability
      const host = process.env.LND_GRPC_HOST;
      const macaroonHex = process.env.LND_MACAROON_HEX;
      const tls = process.env.LND_TLS_CERT_PATH;
      const protoDir = process.env.LND_PROTO_DIR;
      const protoJsonPath = process.env.LND_PROTO_JSON_PATH;
      let lndOk = false;
      res.lnd.grpc.configured = !!(host && macaroonHex && (protoDir || protoJsonPath));
      if (host && macaroonHex && (protoDir || protoJsonPath)) {
        let descriptorJson: any | undefined;
        if (protoJsonPath) {
          try {
            const fs = await import('node:fs');
            descriptorJson = JSON.parse(fs.readFileSync(protoJsonPath, 'utf8'));
          } catch {}
        }
        const r = await checkLndGrpc({ host, macaroonHex, tlsCertPath: tls, protoDir, descriptorJson });
        lndOk = r.ok;
        res.lnd.grpc.healthy = lndOk;
      }
      if (!lndOk) {
        const restUrl = process.env.LND_REST_URL;
        res.lnd.rest.configured = !!(restUrl && macaroonHex);
        if (restUrl && macaroonHex) {
          const r = await checkLndRest(restUrl, macaroonHex);
          lndOk = r.ok;
          res.lnd.rest.healthy = lndOk;
        }
      }
      res.methods.l402 = lndOk;
      res.p2pk.configured = !!process.env.CASHU_MINT_URL;
      res.p2pk.healthy = res.p2pk.configured;
      res.methods.p2pk = res.p2pk.healthy;
      res.healthy = lndOk || res.methods.p2pk;
    } catch {
      // gateway not available
    }
    return res;
  })
}
