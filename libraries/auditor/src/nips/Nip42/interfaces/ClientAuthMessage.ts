import { Note } from "#src/nips/Nip01/interfaces";

export type ClientAuthMessage = [
  type: "AUTH",
  signedEvent: Note
]