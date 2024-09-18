import RelayClosedMessageSchema from './relay-closed.schema.json' with { type: "json" };
import RelayEventMessageSchema from './relay-event.schema.json' with { type: "json" };
import RelayEoseMessageSchema from './relay-eose.schema.json' with { type: "json" };
import RelayOkMessageSchema from './relay-ok.schema.json' with { type: "json" };
import RelayNoticeMessageSchema from './relay-notice.schema.json' with { type: "json" };

import ClientCloseMessageSchema from './client-close.schema.json' with { type: "json" };
import ClientEventMessageSchema from './client-event.schema.json' with { type: "json" };
import ClientReqMessageSchema from './client-event.schema.json' with { type: "json" };

import Note from './note.schema.json' with { type: "json" };
import Filter from './filter.schema.json' with { type: "json" };

export { 
  Note,
  Filter,

  RelayClosedMessageSchema, 
  RelayEventMessageSchema, 
  RelayEoseMessageSchema, 
  RelayOkMessageSchema, 
  RelayNoticeMessageSchema, 
  
  ClientCloseMessageSchema, 
  ClientEventMessageSchema, 
  ClientReqMessageSchema 
};

export default {
  Note,
  Filter,

  RelayClosedMessage: RelayClosedMessageSchema,
  RelayEventMessage: RelayEventMessageSchema,
  RelayEoseMessage: RelayEoseMessageSchema,
  RelayOkMessage: RelayOkMessageSchema,
  RelayNoticeMessage: RelayNoticeMessageSchema,

  ClientCloseMessage: ClientCloseMessageSchema,
  ClientEventMessage: ClientEventMessageSchema,
  ClientReqMessage: ClientReqMessageSchema
}