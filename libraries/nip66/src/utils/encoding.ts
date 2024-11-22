export const encodeJsonToByteArray = (jsonObject: any): Uint8Array => {
  const jsonString = JSON.stringify(jsonObject);
  const encoder = new TextEncoder();
  return encoder.encode(jsonString);
}

export const decodeByteArrayToJson = (byteArray: Uint8Array): any => {
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(byteArray);
  return JSON.parse(jsonString);
}

export const encodeJsonToUrlSafe = async (json: any) => {
  const JSURL = (await import('jsurl2'))?.default;
  return JSURL.stringify(json);
}