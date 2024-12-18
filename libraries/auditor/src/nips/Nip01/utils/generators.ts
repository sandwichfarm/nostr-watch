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

export class Nip01ClientMessageGenerator {
    static EVENT(note: Note): Buffer {
      return Buffer.from(JSON.stringify(['EVENT', note] as ClientEventMessage));
    }
  
    static REQ<T extends INip01Filter>(subscriptionId: string, filters: T[]): Buffer {
      return Buffer.from(JSON.stringify(['REQ', subscriptionId, ...filters] as ClientReqMessageBase));
    }
  
    static CLOSE(subId: string): Buffer {
      return Buffer.from(JSON.stringify(['CLOSE', subId] as ClientCloseMessage));
    }
  }
  
  export class Nip01RelayMessageGenerator { 
    static EVENT(subId: string, note: Note): Buffer {
      return Buffer.from(JSON.stringify(['EVENT', subId, note] as RelayEventMessage));
    }
  
    static OK(subId: string, status: boolean, message: MachineReadableStatus): Buffer {
      return Buffer.from(JSON.stringify(['OK', subId, status, message] as RelayOkMessage));
    }
  
    static EOSE(subId: string): Buffer {
      return Buffer.from(JSON.stringify(['EOSE', subId] as RelayEoseMessage));
    }
  
    static NOTICE(subId: string, message: HumanReadableStatus): Buffer {
      return Buffer.from(JSON.stringify(['NOTICE', message] as RelayNoticeMessage));
    }
  
    static CLOSED(subId: string, message: MachineReadableStatus): Buffer {
      return Buffer.from(JSON.stringify(['CLOSED', subId, message] as RelayClosedMessage));
    }
  }