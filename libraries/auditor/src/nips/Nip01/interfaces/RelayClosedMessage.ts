import { MachineReadableStatus } from "./MachineReadableStatus";

export type RelayClosedMessage = [
  "CLOSED",
  string,
  MachineReadableStatus
];
