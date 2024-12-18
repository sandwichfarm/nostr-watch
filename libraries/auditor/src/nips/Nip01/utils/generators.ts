import type { 
    Note,
    INip01Filter, 
    ClientEventMessage, 
    ClientReqMessageBase, 
    ClientCloseMessage, 
    RelayEventMessage, 
    RelayEoseMessage, 
    RelayOkMessage,
    RelayNoticeMessage,
    RelayClosedMessage,
    HumanReadableStatus,
    MachineReadableStatus
} from '../interfaces/index.js';

export type StringifiedMessage = string;

export class Nip01ClientMessageGenerator {
    static EVENT(note: Note): ClientEventMessage {
      return ['EVENT', note];
    }
  
    static REQ<T extends INip01Filter>(subscriptionId: string, filters: T[]): ClientReqMessageBase {
      return ['REQ', subscriptionId, ...filters];
    }
  
    static CLOSE(subId: string): ClientCloseMessage {
      return ['CLOSE', subId];
    }
  }
  
  export class Nip01RelayMessageGenerator { 
    static EVENT(subId: string, note: Note): RelayEventMessage {
      return ['EVENT', subId, note];
    }
  
    static OK(subId: string, status: boolean, message: MachineReadableStatus): RelayOkMessage {
      return ['OK', subId, status, message];
    }
  
    static EOSE(subId: string): RelayEoseMessage {
      return ['EOSE', subId];
    }
  
    static NOTICE(subId: string, message: HumanReadableStatus): RelayNoticeMessage {
      return ['NOTICE', message];
    }
  
    static CLOSED(subId: string, message: MachineReadableStatus): RelayClosedMessage {
      return ['CLOSED', subId, message];
    }
  }