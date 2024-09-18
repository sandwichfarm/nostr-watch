import { MachineReadableStatus } from "./MachineReadableStatus";

export type RelayOkMessage = [
  "OK",
  string,
  boolean,
  MachineReadableStatus
];