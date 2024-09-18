import { Ingestor } from '#base/Ingestor.js';
import { Note } from '../interfaces/Note.js';

export class RangeIngestor extends Ingestor {
  readonly sampleSize: number = 30;
  private timestamps: Set<number> = new Set();

  constructor(sampleSize?: number) {
    super();
    if(sampleSize) this.sampleSize = sampleSize;
  }

  feed(note: Note): void {
    if(!this?.signal) throw new Error('Ingestor not registered with signal');
    this.timestamps.add(note.created_at);
    if(this.timestamps.size >= this.sampleSize) {
      this.signal.emit('ingestor:abort');
    }
  }

  poop(): number[] {
    return Array.from(this.timestamps);
  }
}