import { deterministicHash } from "@base/utils";
import { nip11 } from "nostr-tools";

export type Nip11PaymentsUrl = `https://${string}` | `http://${string}`
export type Nip11Fee = { amount: number; unit: string; period: number }
export type Nip11Fees = {
  admission?: Nip11Fee[];
  publication?: Nip11Fee[];
  subscription?: Nip11Fee[];
}

export interface Limitations extends nip11.Limitations {}

export interface RelayInformation extends nip11.RelayInformation {
  limitation: Limitations;
  banner: string;
}

export type INip11 = {
  relay: string;
  monitorPubkey: string;
  hash: string | null;
  nid?: string | null;
  created_at: number;
  json: Record<string, any> | null;
}

export class Nip11 {
  private _json: RelayInformation;
  private _hash: string;

  constructor(nip11: RelayInformation) {
    if(typeof nip11 === 'string'){
      nip11 = JSON.parse(nip11);
    }
    this._json = nip11;
    this._hash = deterministicHash(this._json)
  }

  /**
   * Returns the name of the relay.
   */
  get name(): string | undefined {
    return this.json.name;
  }

  get pubkey(): string | undefined {
    return this.json?.pubkey;
  }



  /**
   * Returns the description of the relay.
   */
  get description(): string | undefined {
    return this.json.description;
  }

  /**
   * Returns the icon of the relay.
   */
  get icon(): string | undefined {
    return this.json.icon;
  }

  /**
   * Returns the banner of the relay.
   */
  get banner(): string | undefined {
    return this.json.banner;
  }


  /**
   * Returns the contact information of the relay.
   */
  get contact(): string | undefined {
    return this.json.contact;
  }

  /**
   * Returns the software used by the relay.
   */
  get software(): string | undefined {
    return this.json.software;
  }

  /**
   * Returns the version of the relay software.
   */
  get version(): string | undefined {
    return this.json.version;
  }

  /**
   * Returns the limitation object for the relay.
   */
  get limitation(): Limitations {
    return this.json.limitation;
  }

  /**
   * Indicates whether payment is required to use the relay.
   */
  get paymentRequired(): boolean {
    return this.json.limitation?.payment_required ?? false;
  }

  /**
   * Indicates whether authentication is required to use the relay.
   */
  get authRequired(): boolean {
    return this.json.limitation?.auth_required ?? false;
  }

  /**
   * Indicates whether the relay is restricted to read-only.
   * If true, the relay will not accept writes.
   * If false, the relay will accept writes.
   * If undefined, the relay may accept writes.
  */
  get restrictedWrites(): boolean {
    return this.json.limitation?.restricted_writes ?? false;
  }

  /**
   * Indicates whether proof-of-work is required to publish to relay.
   */
  get powRequired(): boolean {
    return this.minPowDifficulty !== undefined;
  }


  /**
   * Returns required pow difficulty for the relay.
   */
  get minPowDifficulty(): number | undefined {
    return this.json.limitation?.min_pow_difficulty ?? false;
  }

  /**
   * Returns the hash associated with the relay.
   */
  get hash(): string | undefined {
    return this._hash ?? undefined;
  }

  /**
   * Returns the supported NIPs (Nostr Implementation Possibilities) by the relay.
   */
  get supportedNips(): number[] | undefined {
    return this.json?.supported_nips;
  }

  /**
   * Returns the payments URL for the relay.
   */
  get paymentsUrl(): Nip11PaymentsUrl | undefined {
    return this.json?.payments_url as Nip11PaymentsUrl || undefined;
  }

  /**
   * Returns the fees object for the relay.
   */
  get fees():  any | undefined {
    return this.json.fees
  }

  /**
   * Returns the max message length if set
   */
  get maxMessageLength(): number | undefined {
    return this.limitation?.max_message_length;
  }

  /**
   * Returns the max message tags if set
   */
  get maxMessageTags(): number | undefined {
    return this.limitation?.max_event_tags; 
  }

  /**
   * Returns the max subscriptions tags if set
   */
  get maxSubscriptions(): number | undefined {
    return this.limitation?.max_subscriptions;
  }

  /**
   * Returns the max filters if set
   */
  get maxFilters(): number | undefined {
    return this.limitation?.max_filters;
  }

  /**
   * Returns the max limit if set
   */
  get maxLimit(): number | undefined {
    return this.limitation?.max_limit;
  }

  /**
   * Returns the max subid length if set
   */
  get maxSubidLength(): number | undefined {
    return this.limitation?.max_subid_length;
  }

  /**
   * Returns the max event tags if set
   */
  get maxEventTags(): number | undefined {
    return this.limitation?.max_event_tags;
  }

  /**
   * Returns the max content length if set
   */
  get maxContentLength(): number | undefined {
    return this.limitation?.max_content_length;
  }

  /**
   * Returns the lower limit of notes accepted by the relay.
   */
  get createdAtLowerLimit(): number | undefined {
    return this.limitation?.created_at_lower_limit;
  }

  /**
   * Returns the upper limit of notes accepted by the relay.
   */
  get createdAtUpperLimit(): number | undefined {
    return this.limitation?.created_at_upper_limit;
  }

  /**
   * Returns the entire JSON payload.
   */
  get json(): RelayInformation {
    return this._json;
  }
}
