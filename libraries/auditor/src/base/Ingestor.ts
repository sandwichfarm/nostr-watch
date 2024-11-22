import type { Note } from '#src/nips/Nip01/interfaces';
import { EventEmitter } from 'tseep';

export abstract class Ingestor {
  protected signal?: EventEmitter;
  constructor() {}
  abstract feed(note: Note): void;
  abstract poop(): any;
  registerSignal(signal: any): void {
    this.signal = signal;
  }
}