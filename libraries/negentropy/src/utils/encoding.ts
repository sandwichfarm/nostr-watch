import PROTOCOL_VERSION from '../version';
import type { Range, Bound, RangeMode } from '../types';

export function encodeMessage(ranges: Range[]): Uint8Array {
  const buffers: Uint8Array[] = [];
  buffers.push(Uint8Array.from([PROTOCOL_VERSION]));
  let prevTimestamp = BigInt(0);

  for (const range of ranges) {
    const timestampOffset = range.upperBound.timestampOffset;
    const timestampVarint = encodeVarint(Number(timestampOffset));
    const idPrefixLengthVarint = encodeVarint(range.upperBound.idPrefix.length);
    const upperBoundBuffer = new Uint8Array([
      ...timestampVarint,
      ...idPrefixLengthVarint,
      ...range.upperBound.idPrefix
    ]);

    const modeVarint = encodeVarint(range.mode);

    buffers.push(upperBoundBuffer);
    buffers.push(modeVarint);

    if (range.mode === 0) {
    } else if (range.mode === 1) {
      buffers.push(range.payload);
    } else if (range.mode === 2) {
      buffers.push(range.payload);
    }
    prevTimestamp += timestampOffset;
  }
  // Concatenate all buffers into a single Uint8Array
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}

export function decodeMessage(buffer: Uint8Array): Range[] {
  let offset = 0;
  const ranges: Range[] = [];
  const protocolVersion = buffer[offset++];
  if (protocolVersion !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported protocol version: ${protocolVersion}`);
  }
  let prevTimestamp = BigInt(0);

  while (offset < buffer.length) {
    const timestampResult = decodeVarint(buffer, offset);
    offset += timestampResult.bytesRead;
    const timestampOffset = BigInt(timestampResult.value);
    const idPrefixLengthResult = decodeVarint(buffer, offset);
    offset += idPrefixLengthResult.bytesRead;
    const idPrefixLength = idPrefixLengthResult.value;
    const idPrefix = new Uint8Array(buffer.subarray(offset, offset + idPrefixLength));
    offset += idPrefixLength;

    const upperBound: Bound = {
      timestampOffset,
      idPrefix,
    };

    const modeResult = decodeVarint(buffer, offset);
    offset += modeResult.bytesRead;
    const mode = modeResult.value as RangeMode;

    let payload: Uint8Array = new Uint8Array();
    if (mode === 0) {
    } else if (mode === 1) {
      payload = new Uint8Array(buffer.subarray(offset, offset + 16));
      offset += 16;
    } else if (mode === 2) {
      const lengthResult = decodeVarint(buffer, offset);
      offset += lengthResult.bytesRead;
      const idCount = lengthResult.value;
      const ids: Uint8Array[] = [];
      for (let i = 0; i < idCount; i++) {
        const id = buffer.subarray(offset, offset + 32);
        ids.push(id);
        offset += 32;
      }
      // Concatenate varint count and IDs
      const countBytes = encodeVarint(idCount);
      const totalLength = countBytes.length + idCount * 32;
      payload = new Uint8Array(totalLength);
      payload.set(countBytes, 0);
      let payloadOffset = countBytes.length;
      for (const id of ids) {
        payload.set(id, payloadOffset);
        payloadOffset += 32;
      }
    } else {
      throw new Error(`Unknown mode: ${mode}`);
    }

    ranges.push({
      upperBound,
      mode,
      payload,
    });
  }
  return ranges;
}

export function encodeVarint(value: number): Uint8Array {
  const buffer: number[] = [];
  while (value >= 0x80) {
    buffer.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  buffer.push(value & 0x7f);
  return new Uint8Array(buffer);
}
  
export function decodeVarint(buffer: Uint8Array, offset: number = 0): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  while (true) {
    if (offset + bytesRead >= buffer.length) {
      throw new Error("Buffer underflow during varint decoding");
    }
    const byte = buffer[offset + bytesRead];
    value |= (byte & 0x7f) << shift;
    bytesRead++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value, bytesRead };
}