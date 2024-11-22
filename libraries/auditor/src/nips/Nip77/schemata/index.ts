import NegOpenMessageSchema from './NEG-OPEN.schema.json' with { type: "json" };
import NegMsgMessageSchema from './NEG-MSG.schema.json' with { type: "json" };
import NegErrMessageSchema from './NEG-ERR.schema.json' with { type: "json" };
import NegCloseMessageSchema from './NEG-CLOSE.schema.json' with { type: "json" };

export { 
  NegOpenMessageSchema, 
  NegMsgMessageSchema,
  NegErrMessageSchema,
  NegCloseMessageSchema
};

export default { 
  NegOpenMessage: NegOpenMessageSchema, 
  NegMsgMessage: NegMsgMessageSchema,
  NegErrMessage: NegErrMessageSchema,
  NegCloseMessage: NegCloseMessageSchema
};