import { ClientCloseMessage } from "./ClientCloseMessage";
import { ClientEventMessage } from "./ClientEventMessage";
import { ClientReqMessageBase } from "./ClientReqMessage";

export type INip01ClientMessage =
  | ClientEventMessage
  | ClientReqMessageBase
  | ClientCloseMessage