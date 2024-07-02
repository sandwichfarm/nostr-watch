const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { FastifyAdapter } = require('@bull-board/fastify');
const { Queue: QueueMQ, Worker } = require('bullmq');
const fastify = require('fastify');

const sleep = (t) => new Promise((resolve) => setTimeout(resolve, t * 1000));

const redisOptions = {
  port: 6379,
  host: 'localhost',
  password: '',
  tls: false,
};

const queueMQ = new QueueMQ();

const serverAdapter = new FastifyAdapter()

createBullBoard({
  queues: [new BullMQAdapter(queueMQ)],
  serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'My BOARD',
      boardLogo: {
        path: 'https://cdn.my-domain.com/logo.png',
        width: '100px',
        height: 200,
      },
      miscLinks: [{text: 'Logout', url: '/logout'}],
      favIcon: {
        default: 'static/images/logo.svg',
        alternative: 'static/favicon-32x32.png',
      },
    },
  },
});