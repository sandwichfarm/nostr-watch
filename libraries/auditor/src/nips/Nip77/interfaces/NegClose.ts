import { SubscriptionID } from './GenericTypes.js';

export type NegCloseMessage = [
  type: 'NEG-CLOSE',
  subscriptionId: SubscriptionID
]