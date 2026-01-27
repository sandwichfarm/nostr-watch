import { IEvent } from "@base/interfaces";
import { NostrEvent } from "@base/models";
import Bolt11 from 'light-bolt11-decoder';

export const isPubkey = (value: string): boolean => {
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    return hexRegex.test(value);
}

export type WebsocketUrlType = `wss://${string}` | `ws://${string}`;
export const getNormalizedWebsocketVariants = (url: WebsocketUrlType): [WebsocketUrlType, WebsocketUrlType] => {
    const withoutSlash = url.replace(/\/+$/, '') as WebsocketUrlType;
    const withSlash = withoutSlash + '/' as WebsocketUrlType;
    return [withoutSlash, withSlash];
}

export const zapSum = (zaps: IEvent[] | NostrEvent[]): string => {
    return zapSumString(zapSumNum(zaps));
}

export const zapSumNum = (zaps: IEvent[] | NostrEvent[]): number => {
    const bolt11s = zaps.map(zap => {
            const b11 = zap.tags.find(tag => tag[0] === 'bolt11')?.[1]
            if(!b11) return null
            return Bolt11.decode(b11)
        }).filter( b11 => b11 !== null )

    return Math.round(
        bolt11s.reduce((acc, b11) => acc += parseInt(
            b11.sections.find( 
                section => section?.name === 'amount')?.value || "0"
            ),
        0)/1000
    )
}

export const zapSumString = (sum: number): string => {
    if(sum === 0) return '';
    if (sum < 1000) return sum.toString();
    const units = ["", "K", "M", "B", "T", "P", "E"];
    const magnitude = Math.floor(Math.log10(sum) / 3);
    const precision = magnitude - 1; 
    const scaled = sum / Math.pow(1000, magnitude); 
    return `${scaled.toFixed(precision + 1)}${units[magnitude]}`;
}    