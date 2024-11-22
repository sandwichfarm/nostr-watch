import { StateManager } from "./StateManager";

export enum StageSubject {
    Monitors = 'MONITORS',
    Monitor = 'MONITOR',
    Relays = 'RELAYS',
    Relay = 'RELAY',
    User = 'USER',
    AuthedUser = 'AUTHED_USER'
}

export enum Stage {
    Bootstrap = 0,
    Resync = 1,
    Idle = 2
}

export enum StageStatus {
    Begin = 0,
    Processing = 1,
    End = 2
}


export class LoadStage {
    private _subject: StageSubject;
    private _status: StageStatus;
    private _stage: Stage;
    
    constructor(subject: StageSubject, stage: Stage, status: StageStatus) {
        this._subject = subject;
        this._stage = stage;
        this._status = status;
    }

    get subject(): StageSubject {
        return this._subject;
    }

    get stage(): Stage {
        return this._stage;
    }

    get status(): StageStatus {
        return this._status;
    }
}


export class LoadStageManager {
    private subjects: Record<StageSubject, LoadStage | null> = {
        [StageSubject.Monitors]: null,
        [StageSubject.Monitor]: null,
        [StageSubject.Relays]: null,
        [StageSubject.Relay]: null,
        [StageSubject.User]: null,
        [StageSubject.AuthedUser]: null
    };
    
    begin(stage: LoadStage) {
        this.subjects[stage.subject] = stage;  
    }

    update(stage: LoadStage) {
        
    }
}