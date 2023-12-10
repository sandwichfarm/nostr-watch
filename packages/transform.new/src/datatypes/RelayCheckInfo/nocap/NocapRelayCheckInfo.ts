import { BaseRelayCheckInfo } from '../common/BaseRelayCheckInfo';
import { Expose, Type } from 'class-transformer';
import { RelayCheckInfoTransformers } from '../transformers/RelayCheckInfoTransformers';


class InfoDataLimitation {
  @Expose() auth_required: boolean = false;
  @Expose() created_at_lower_limit: number = -1;
  @Expose() created_at_upper_limit: number = -1;
  @Expose() max_event_tags: number = -1;
  @Expose() max_limit: number = -1;
  @Expose() max_message_length: number = -1;
  @Expose() max_subid_length: number = -1;
  @Expose() max_subscriptions: number = -1;
  @Expose() min_pow_difficulty: number = 0;
  @Expose() payment_required: boolean = false;
  @Expose() restricted_writes: boolean = false;
}

class InfoDataFeesAdmission {
  @Expose() amount: number = -1;
  @Expose() unit: string = '';
}

class InfoData {
  @Expose() contact: string = '';
  @Expose() description: string = '';
  @Expose() icon: string = '';
  @Expose() name: string = '';
  @Expose() payments_url: string = '';
  @Expose() pubkey: string = '';
  @Expose() software: string = '';
  @Expose() version: string = '';

  @Expose() @Type(() => InfoDataFeesAdmission) fees: InfoDataFeesAdmission[] | null = null;
  @Expose() @Type(() => InfoDataLimitation) limitation: InfoDataLimitation | null = null;
  @Expose() @Type(() => Number) supported_nips: number[] | null = null;
}

class Info {
  @Expose() status: string = '';
  @Expose() duration: number = -1;
  @Expose() @Type(() => InfoData) data: InfoData | null = null;
}

export class NocapRelayCheckInfo extends BaseRelayCheckInfo {
  @Expose() @Type(() => Info) info: Info | null = null;

  constructor(plainObject: any) {
    super();
    Object.assign(this, NocapRelayCheckInfo.plainToClass(NocapRelayCheckInfo, plainObject));
    this.dropped_fields = this.getExtraFields(plainObject);
  }

  toRdb(): object {
    return RelayCheckInfoTransformers.nocapToRdb(this);
  }

}