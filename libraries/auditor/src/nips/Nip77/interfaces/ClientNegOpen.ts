import { SubscriptionID, Filter, HexString } from "./GenericTypes.js";

export type ClientNegOpenMessage = [
  type: 'NEG-OPEN',
  subscriptionId: SubscriptionID,
  filter: Filter,
  initialMessage: HexString
]
