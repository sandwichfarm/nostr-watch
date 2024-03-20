import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter.js';
import { ExpressAdapter } from '@bull-board/express';

import { RedisConnectionDetails } from '@nostrwatch/utils';
import { NocapdQueue } from '@nostrwatch/controlflow';


const connection = RedisConnectionDetails()

const queues = [
  'nocapd/amsterdam',
  'nocapd/newyork',
  'nocapd/siliconvalley',
  'nocapd/seoul',
  'nocapd/mumbai',
  'nocapd/saopaulo',
  'nocapd/sydney',
  'nocapd/johannesburg',
  'nocapd/frankfurt',
  'nocapd/budapest'
]
.map( q => NocapdQueue(q, { connection }).$Queue ) 
.map( $q => new BullAdapter($q) )

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/');

const options = {
  uiConfig: {
    boardTitle: '@nostrwatch',
    // boardLogo: {
    //   path: 'https://cdn.my-domain.com/logo.png',
    //   width: '100px',
    //   height: 200,
    // },
    // miscLinks: [{text: 'Logout', url: '/logout'}],
    // favIcon: {
    //   default: 'static/images/logo.svg',
    //   alternative: 'static/favicon-32x32.png',
    // },
  }
}

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({ queues, serverAdapter, options });

const app = express();

app.use('/', serverAdapter.getRouter());

// other configurations of your server

app.listen(3000, () => {
  console.log('Running on 3000...');
  console.log('For the UI, open http://localhost:3000/');
  console.log('Make sure Redis is running on port 6379 by default');
});