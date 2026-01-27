export interface INip11 {
    name: string;
    description: string;
    pubkey: string; // must match the regex pattern "^(?:[0-9a-f]{64})$"
    contact: string;
    supported_nips: number[];
    software: string;
    version: string;
    retention?: Retent[];
    relay_country?: string[];
    icon?: SaneUrl;
    language_tags?: string[];
    tags?: string[];
    posting_policy?: SaneUrl;
    limitation?: Limitation;
    payments_url?: SaneUrl;
    fees?: Fees;
  }
  
  interface SaneUrl {
    url: string; // must match the regex pattern "^https?://"
  }
  
  interface Limitation {
    max_message_length?: number;
    max_subscriptions?: number;
    max_filters?: number;
    max_limit?: number;
    max_subid_length?: number;
    max_event_tags?: number;
    max_content_length?: number;
    min_pow_difficulty?: number;
    auth_required?: boolean;
    payment_required?: boolean;
    restricted_writes?: boolean;
    created_at_lower_limit?: number;
    created_at_upper_limit?: number;
  }
  
  interface Fees {
    admission?: Fee[];
    subscription?: Fee[];
    publication?: Fee[];
  }
  
  interface Fee {
    amount: number;
    unit: string;
    period?: number;
    kinds?: number[];
  }
  
  interface Retent {
    kinds: (number | number[])[];
    count?: number;
    time?: number;
  }
  