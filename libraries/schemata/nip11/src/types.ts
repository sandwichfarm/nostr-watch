export interface Types {
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
}

export interface FeesObject {
    admission?:    AdmissionElement[];
    publication?:  AdmissionElement[];
    subscription?: AdmissionElement[];
    [property: string]: any;
}

export interface AdmissionElement {
    amount?: number;
    kinds?:  number[];
    period?: number;
    unit?:   string;
    [property: string]: any;
}

export interface Limitation {
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
}

export interface RetentionElement {
    count?: number;
    kinds?: Array<number[] | number>;
    time?:  number;
    [property: string]: any;
}
