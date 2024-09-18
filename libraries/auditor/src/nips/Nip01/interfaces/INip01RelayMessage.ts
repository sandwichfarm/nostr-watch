import { RelayClosedMessage } from "./RelayClosedMessage";
import { RelayEoseMessage } from "./RelayEoseMessage";
import { RelayEventMessage } from "./RelayEventMessage";
import { RelayNoticeMessage } from "./RelayNoticeMessage";
import { RelayOkMessage } from "./RelayOkMessage";

export type INip01RelayMessage =
  | RelayEventMessage
  | RelayOkMessage
  | RelayEoseMessage
  | RelayClosedMessage
  | RelayNoticeMessage