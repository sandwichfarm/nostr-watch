import RelayAuthMessageSchema from './relay-auth-event.schema.json' with { type: "json" };
import ClientAuthMessageSchema from './client-auth-event.schema.json' with { type: "json" };

export { 
  RelayAuthMessageSchema, 
  ClientAuthMessageSchema
};

export default { 
  RelayAuthMessage: RelayAuthMessageSchema, 
  ClientAuthMessage: ClientAuthMessageSchema
};