import { Expose, Type } from 'class-transformer';
import { Transformable } from './Transformable';

export abstract class BaseRelayCheckInfo extends Transformable {
    @Expose() url: string = '';
    @Expose() checked_at: number = -1;
    @Expose() checked_by: string = '';
    @Expose() @Type(() => String) adapters: string[] | null = null;
    @Expose() dropped_fields: string[] = [];
}