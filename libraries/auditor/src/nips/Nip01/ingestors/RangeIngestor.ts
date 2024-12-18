import { Ingestor } from '#base/Ingestor.js';
import { Note } from '../interfaces/Note.js';

export class RangeIngestor extends Ingestor {
  private timestamps: Set<number> = new Set();

  feed(note: Note): void {
    this.timestamps.add(note.created_at);
    if(this.timestamps.size >= this.sampleSize) 
      this.complete();
  }

  poop(): number[] {
    return Array.from(this.timestamps);
  }
}