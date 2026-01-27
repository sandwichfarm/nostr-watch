import { INip01ClientMessage } from "./INip01ClientMessage";
import { INip01RelayMessage } from "./INip01RelayMessage";

export type INip01Message = INip01ClientMessage | INip01RelayMessage;