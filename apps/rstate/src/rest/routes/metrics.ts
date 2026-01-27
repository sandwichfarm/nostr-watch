import type { FastifyInstance } from 'fastify'
import type { RestContext } from '../server.js'

export async function registerMetricsRoutes(app: FastifyInstance, _context: RestContext): Promise<void> {
  app.get('/metrics', {
    schema: {
      tags: ['health'],
      description: 'Prometheus metrics (if payments-gateway metrics are available)'
    }
  }, async (_req, reply) => {
    try {
      const mod: any = await import('nostrwatch-payments-gateway');
      if (mod && mod.promRegister && typeof mod.promRegister.metrics === 'function') {
        const text = await mod.promRegister.metrics();
        reply.header('Content-Type', 'text/plain; version=0.0.4');
        reply.header('Cache-Control', 'no-cache');
        return reply.send(text);
      }
    } catch {
      // payments-gateway not installed; fall through
    }
    return reply.code(404).send({ error: 'Metrics not available' });
  })
}

