import { Geocoded } from "./Geocoded";

export class MonitorRegistration extends Geocoded {
    
    keys(keys: string[]): string[] {
        return [
            'pubkey',
            'checks',
            'frequency',
        ];
    }

    get networks(): string[] {
        return this.tags.filter(tag => tag[0] === 'n').map(tag => tag[1]);
    }

    get frequency(): number {   
        return parseInt(this.tags.find(tag => tag[0] === 'frequency')?.[1] || "0")
    }

    get checks(): string[] {
        return this.tags.filter(tag => tag[0] === 'c').map(tag => tag[1]);
    }

}