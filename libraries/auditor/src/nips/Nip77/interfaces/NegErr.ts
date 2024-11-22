import { SubscriptionID } from './GenericTypes.js';
export type ReasonCode = 'RESULTS_TOO_BIG' | 'CLOSED';

export type NegErrMessage = [
  type: 'NEG-ERR',
  subscriptionId: SubscriptionID,
  reasonCode: ReasonCode,
  maxRecords?: number
]