import type { Listener } from "tseep";

export type EventType = 'replaceable' | 'parameterized' | 'event';

export interface BaseEvent {
  id?: string | null;
  created_at?: number | null;
  kind: number | null;
  pubkey: string | null;
  tags: string[][] | null;
  content: string | null;
  sig?: string | null;
}

export type EventKeyDataType = {
    type: EventType;
    key: string;
}

export type AbstractMemoryRelayCallbackQualify<I> = (event: any, key: string, instance: I) => boolean;
export type AbstractMemoryRelayCallbackInstatiate<I, Output> = (event: any, key: string, instance: I) => Output;

export type AbstractMemoryRelayCallback<I, Output> = AbstractMemoryRelayCallbackQualify<I> | AbstractMemoryRelayCallbackInstatiate<I, Output>;