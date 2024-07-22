export class Relay {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class Retry {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class CacheTime {
    constructor(config={}) {
        Object.assign(this,config);
    }
}


export class Service {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class Note {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class RelayCheckWebsocket {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class RelayCheckInfo {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class RelayCheckDns {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class RelayCheckGeo {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class RelayCheckSsl {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export const defineSchemas = ($db) => {
    //relay record 
    $db.defineSchema(Relay);

    //note cache 
    $db.defineSchema(Note);

    //relay checks
    $db.defineSchema(RelayCheckWebsocket);
    $db.defineSchema(RelayCheckInfo);
    $db.defineSchema(RelayCheckDns);
    $db.defineSchema(RelayCheckGeo);
    $db.defineSchema(RelayCheckSsl);

    $db.defineSchema(Retry);

    //app meta 
    $db.defineSchema(CacheTime);
    return $db
}

export const schemas = {
    Relay, CacheTime, Note, RelayCheckWebsocket, RelayCheckInfo, RelayCheckDns, RelayCheckGeo, RelayCheckSsl
}