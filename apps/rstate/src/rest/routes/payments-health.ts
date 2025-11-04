import type { FastifyInstance } from 'fastify'
import type { RestContext } from '../server.js'

export async function registerPaymentsHealthRoutes(app: FastifyInstance, _context: RestContext): Promise<void> {
  app.get('/health/payments', {
    schema: {
      tags: ['health'],
      description: 'Payments gateway health (LND and Cashu backends)',
      response: {
        200: {
          type: 'object',
          properties: {
            featureEnabled: { type: 'boolean' },
            lnd: {
              type: 'object',
              properties: {
                grpc: { type: 'object', properties: { configured: { type: 'boolean' }, ok: { type: 'boolean' }, reason: { type: 'string' } } },
                rest: { type: 'object', properties: { configured: { type: 'boolean' }, ok: { type: 'boolean' }, reason: { type: 'string' } } },
              },
            },
            p2pk: { type: 'object', properties: { configured: { type: 'boolean' } } },
            metrics: {
              type: 'object',
              properties: {
                challenges: { type: 'object', additionalProperties: { type: 'number' } },
                successes: { type: 'object', additionalProperties: { type: 'number' } },
                failures: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    byMethod: { type: 'object', additionalProperties: { type: 'number' } },
                    byReason: { type: 'object', additionalProperties: { type: 'number' } }
                  }
                }
              }
            }
          },
        },
      },
    },
  }, async (_req, _reply) => {
    const feature = process.env.FEATURE_402 === 'true' || process.env.FEATURE_402 === '1';
    const res: any = { featureEnabled: feature, lnd: { grpc: { configured: false }, rest: { configured: false } }, p2pk: { configured: false } };
    if (!feature) return res;
    try {
      const gw = await import('nostrwatch-payments-gateway');
      const { checkLndGrpc, checkLndRest, promRegister } = gw as any;
      // gRPC
      const host = process.env.LND_GRPC_HOST;
      const macaroonHex = process.env.LND_MACAROON_HEX;
      const tls = process.env.LND_TLS_CERT_PATH;
      const protoDir = process.env.LND_PROTO_DIR;
      const protoJsonPath = process.env.LND_PROTO_JSON_PATH;
      if (host && macaroonHex && (protoDir || protoJsonPath)) {
        res.lnd.grpc.configured = true;
        let descriptorJson: any | undefined;
        if (protoJsonPath) {
          try {
            const fs = await import('node:fs');
            descriptorJson = JSON.parse(fs.readFileSync(protoJsonPath, 'utf8'));
          } catch {}
        }
        const r = await checkLndGrpc({ host, macaroonHex, tlsCertPath: tls, protoDir, descriptorJson });
        res.lnd.grpc.ok = r.ok; res.lnd.grpc.reason = r.reason;
      }
      // REST
      const restUrl = process.env.LND_REST_URL;
      if (restUrl && macaroonHex) {
        res.lnd.rest.configured = true;
        const r = await checkLndRest(restUrl, macaroonHex);
        res.lnd.rest.ok = r.ok; res.lnd.rest.reason = r.reason;
      }
      // P2PK configured
      res.p2pk.configured = !!process.env.CASHU_MINT_URL;
      // Metrics summary
      if (promRegister && typeof promRegister.getMetricsAsJSON === 'function') {
        const arr = await promRegister.getMetricsAsJSON();
        const sumBy = (name: string, labelKey?: string) => {
          const m = arr.find((x: any) => x.name === name);
          const out: Record<string, number> = {};
          if (m && Array.isArray(m.values)) {
            for (const v of m.values) {
              const key = labelKey ? (v.labels?.[labelKey] ?? 'unknown') : 'total';
              out[key] = (out[key] ?? 0) + (v.value ?? 0);
            }
          }
          return out;
        };
        const ch = sumBy('payments_challenge_issued_total', 'method');
        const ok = sumBy('payments_verify_success_total', 'method');
        const failByMethod = sumBy('payments_verify_fail_total', 'method');
        const failByReason = sumBy('payments_verify_fail_total', 'reason');
        const totalFail = Object.values(failByMethod).reduce((a: number, b: number) => a + b, 0);
        res.metrics = { challenges: ch, successes: ok, failures: { total: totalFail, byMethod: failByMethod, byReason: failByReason } };
      }
    } catch {
      // gateway not available
    }
    return res;
  })
}
