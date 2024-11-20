export type RecordItem = { timestamp: bigint; id: Uint8Array };
export type RangeMode = 0 | 1 | 2;

export interface Range {
  upperBound: Bound;
  mode: RangeMode;
  payload: Uint8Array;
}

export interface Bound {
  timestampOffset: bigint;
  idPrefix: Uint8Array;
}