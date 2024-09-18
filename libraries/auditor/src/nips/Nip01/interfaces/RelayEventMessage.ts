import { Note } from "./Note";

export type RelayEventMessage = [
  "EVENT",
  string,
  Note
];
