export class Relay {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class Check {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class Info {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class CacheTime {
    constructor(config={}) {
        Object.assign(this,config);
    }
}

export class Stat {
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

export default ($db) => {
    $db.defineSchema(Relay);
    $db.defineSchema(Check);
    $db.defineSchema(Info);
    $db.defineSchema(CacheTime);
    $db.defineSchema(Stat);
    $db.defineSchema(Note);
    return $db
}