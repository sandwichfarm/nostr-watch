import { Nip01Filter } from "./Filter";

export type ClientReqMessage<T extends Nip01Filter> = ["REQ", string, ...T[]];
export type ClientReqMessageBase = ClientReqMessage<Nip01Filter>;
