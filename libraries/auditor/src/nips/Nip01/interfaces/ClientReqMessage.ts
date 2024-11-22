import { INip01Filter } from "./Filter";

export type ClientReqMessage<T extends INip01Filter> = ["REQ", string, ...T[]];
export type ClientReqMessageBase = ClientReqMessage<INip01Filter>;
