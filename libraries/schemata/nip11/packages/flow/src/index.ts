// @flow

// To parse this data:
//
//   const Convert = require("./file");
//
//   const index = Convert.toIndex(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export type Index = {
    contact:         string;
    description:     string;
    fees?:           any[] | boolean | number | number | null | FeesObject | string;
    icon?:           any;
    language_tags?:  string[];
    limitation?:     Limitation;
    name:            string;
    payments_url?:   any;
    posting_policy?: any;
    pubkey:          string;
    relay_country?:  string[];
    retention?:      RetentionElement[];
    software:        string;
    supported_nips:  number[];
    tags?:           string[];
    version:         string;
    [property: string]: any;
};

export type FeesObject = {
    admission?:    AdmissionElement[];
    publication?:  AdmissionElement[];
    subscription?: AdmissionElement[];
    [property: string]: any;
};

export type AdmissionElement = {
    amount?: number;
    kinds?:  number[];
    period?: number;
    unit?:   string;
    [property: string]: any;
};

export type Limitation = {
    auth_required?:          boolean;
    created_at_lower_limit?: number;
    created_at_upper_limit?: number;
    max_content_length?:     number;
    max_event_tags?:         number;
    max_filters?:            number;
    max_limit?:              number;
    max_message_length?:     number;
    max_subid_length?:       number;
    max_subscriptions?:      number;
    min_pow_difficulty?:     number;
    payment_required?:       boolean;
    restricted_writes?:      boolean;
    [property: string]: any;
};

export type RetentionElement = {
    count?: number;
    kinds?: Array<number[] | number>;
    time?:  number;
    [property: string]: any;
};

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
function toIndex(json: string): Index {
    return cast(JSON.parse(json), r("Index"));
}

function indexToJson(value: Index): string {
    return JSON.stringify(uncast(value, r("Index")), null, 2);
}

function invalidValue(typ: any, val: any, key: any, parent: any = '') {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "Index": o([
        { json: "contact", js: "contact", typ: "" },
        { json: "description", js: "description", typ: "" },
        { json: "fees", js: "fees", typ: u(undefined, u(a("any"), true, 3.14, 0, null, r("FeesObject"), "")) },
        { json: "icon", js: "icon", typ: u(undefined, "any") },
        { json: "language_tags", js: "language_tags", typ: u(undefined, a("")) },
        { json: "limitation", js: "limitation", typ: u(undefined, r("Limitation")) },
        { json: "name", js: "name", typ: "" },
        { json: "payments_url", js: "payments_url", typ: u(undefined, "any") },
        { json: "posting_policy", js: "posting_policy", typ: u(undefined, "any") },
        { json: "pubkey", js: "pubkey", typ: "" },
        { json: "relay_country", js: "relay_country", typ: u(undefined, a("")) },
        { json: "retention", js: "retention", typ: u(undefined, a(r("RetentionElement"))) },
        { json: "software", js: "software", typ: "" },
        { json: "supported_nips", js: "supported_nips", typ: a(3.14) },
        { json: "tags", js: "tags", typ: u(undefined, a("")) },
        { json: "version", js: "version", typ: "" },
    ], "any"),
    "FeesObject": o([
        { json: "admission", js: "admission", typ: u(undefined, a(r("AdmissionElement"))) },
        { json: "publication", js: "publication", typ: u(undefined, a(r("AdmissionElement"))) },
        { json: "subscription", js: "subscription", typ: u(undefined, a(r("AdmissionElement"))) },
    ], "any"),
    "AdmissionElement": o([
        { json: "amount", js: "amount", typ: u(undefined, 3.14) },
        { json: "kinds", js: "kinds", typ: u(undefined, a(3.14)) },
        { json: "period", js: "period", typ: u(undefined, 3.14) },
        { json: "unit", js: "unit", typ: u(undefined, "") },
    ], "any"),
    "Limitation": o([
        { json: "auth_required", js: "auth_required", typ: u(undefined, true) },
        { json: "created_at_lower_limit", js: "created_at_lower_limit", typ: u(undefined, 3.14) },
        { json: "created_at_upper_limit", js: "created_at_upper_limit", typ: u(undefined, 3.14) },
        { json: "max_content_length", js: "max_content_length", typ: u(undefined, 3.14) },
        { json: "max_event_tags", js: "max_event_tags", typ: u(undefined, 3.14) },
        { json: "max_filters", js: "max_filters", typ: u(undefined, 3.14) },
        { json: "max_limit", js: "max_limit", typ: u(undefined, 3.14) },
        { json: "max_message_length", js: "max_message_length", typ: u(undefined, 3.14) },
        { json: "max_subid_length", js: "max_subid_length", typ: u(undefined, 3.14) },
        { json: "max_subscriptions", js: "max_subscriptions", typ: u(undefined, 3.14) },
        { json: "min_pow_difficulty", js: "min_pow_difficulty", typ: u(undefined, 3.14) },
        { json: "payment_required", js: "payment_required", typ: u(undefined, true) },
        { json: "restricted_writes", js: "restricted_writes", typ: u(undefined, true) },
    ], "any"),
    "RetentionElement": o([
        { json: "count", js: "count", typ: u(undefined, 3.14) },
        { json: "kinds", js: "kinds", typ: u(undefined, a(u(a(3.14), 3.14))) },
        { json: "time", js: "time", typ: u(undefined, 3.14) },
    ], "any"),
};

module.exports = {
    "indexToJson": indexToJson,
    "toIndex": toIndex,
};
