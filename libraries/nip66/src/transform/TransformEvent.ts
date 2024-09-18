import { IEvent } from "@base/models"
import { IEventEncoded } from "@base/models/EventEncoded"
import { decodeByteArrayToJson, encodeJsonToByteArray } from "@base/utils/encoding"

export default ( event: IEvent | IEventEncoded ): IEvent | IEventEncoded => {
  //@ts-ignore
  if(event?.encoded){
    return decode(event as IEventEncoded)
  }
  return encode(event as IEvent)
}

const decode = ( event: IEventEncoded ): IEvent => {
  const json = decodeByteArrayToJson(event.encoded)
  return {...event, ...json}  
}

const encode = ( event: IEvent ): IEventEncoded => {
  const { id, pubkey, kind, created_at } = event
  const encoded = encodeJsonToByteArray({ 
    tags: event.tags,
    content: event.content,
    signature: event.signature
  });
  return { id, pubkey, kind, created_at, encoded }
}