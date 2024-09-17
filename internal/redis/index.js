import dotenv from 'dotenv';

import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter.js';
import { FastifyAdapter } from '@bull-board/fastify';
import fastify from 'fastify';

import { NocapdQueue } from '@nostrwatch/controlflow'

dotenv.config();

const host = '0.0.0.0',
      port = 3030,
      path = '/f'

const redisOptions = {
  port: process.env.REDIS_PORT || 6379,
  host: process.env.REDIS_HOST || 'localhost',
  username: process.env.REDIS_USER || '',
  password: process.env.REDIS_PASS || '',
  tls: process.env.REDIS_TLS || false,
};

const regions = () => {
  let r = process.env.REGIONS
  try {
    r = r.split(',')
    return r.map(q => q.trim())
  } catch (e) {
    return []
  }
}

const run = async () => {
  const queues = regions().map(region => {
    const queue = NocapdQueue(`nocapd/${region}`).$Queue
    return new BullAdapter(queue)
  })

  console.log(queues)

  const app = fastify();

  const serverAdapter = new FastifyAdapter();

  createBullBoard({
    queues,
    serverAdapter,
  });

  serverAdapter.setBasePath(path);
  app.register(serverAdapter.registerPlugin(), { prefix: path });
  
  console.log(`listening on http://${host}:${port}${path}`)
  return app.listen({  host, port })
};

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});