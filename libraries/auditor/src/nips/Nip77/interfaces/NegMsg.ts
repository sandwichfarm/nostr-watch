import { SubscriptionID, HexString } from './GenericTypes.js';

export type NegMsgMessage = [
  type: 'NEG-MSG',
  subscriptionId: SubscriptionID,
  message: HexString
]