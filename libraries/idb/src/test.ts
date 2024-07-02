import type { IEvent } from './shared/tables';

const testEvent: IEvent = {
  nid: 'test',
  monitorPubkey: 'pubkey',
  relay: null,
  event: {} as any,
  createdAt: null,
};

console.log('Test import successful:', testEvent);