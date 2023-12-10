import { Expose, Type } from 'class-transformer';
import { BaseRelayCheckInfo } from '../common/BaseRelayCheckInfo';
import { RelayCheckInfoTransformers } from '../transformers/RelayCheckInfoTransformers';

class RdbInfoDataLimitation {
  @Expose() max_message_length: number = -1;
  @Expose() max_subscriptions: number = -1;
  @Expose() max_filters: number = -1;
  @Expose() max_limit: number = -1;
  @Expose() max_subid_length: number = -1;
  @Expose() min_prefix: number = -1;
  @Expose() max_event_tags: number = -1;
  @Expose() max_content_length: number = -1;
  @Expose() min_pow_difficulty: number = -1;
  @Expose() auth_required: boolean = false;
  @Expose() payment_required: boolean = false;
}

class RdbInfoDataFeesAdmission {
  @Expose() amount: number = -1;
  @Expose() unit: string = '';
}

class RdbInfoData {
  @Expose() name: string = '';
  @Expose() description: string = '';
  @Expose() pubkey: string = '';
  @Expose() contact: string = '';
  @Expose() software: string = '';
  @Expose() version: string = '';
  @Expose() payments_url: string = '';
  @Expose() @Type(() => Number) supported_nips: number[] | null = null;
  @Expose() @Type(() => String) supported_nip_extensions: string[] | null = null;
  @Expose() @Type(() => RdbInfoDataFeesAdmission) fees: { admission: RdbInfoDataFeesAdmission[] } | null = null;
  @Expose() @Type(() => RdbInfoDataLimitation) limitation: RdbInfoDataLimitation | null = null;
}

export class RdbRelayCheckInfo extends BaseRelayCheckInfo {
  @Expose() @Type(() => RdbInfoData) data: RdbInfoData | null = null;
  private _recordId: string = '';

  constructor(plainObject: any) {
    super();
    Object.assign(this, RdbRelayCheckInfo.plainToClass(RdbRelayCheckInfo, plainObject));
    this._recordId = plainObject['#'] || '';
    this.dropped_fields = this.getExtraFields(plainObject);
  }

  // Getter and setter for the record ID
  get recordId(): string {
    return this._recordId;
  }

  set recordId(value: string) {
    this._recordId = value;
  }

  toNocap(): object {
    return RelayCheckInfoTransformers.rdbToNocap(this);
  }
}
