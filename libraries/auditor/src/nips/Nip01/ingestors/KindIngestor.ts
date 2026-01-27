import { Ingestor } from '#base/Ingestor.js';
import { Note } from '../interfaces/Note.js';

export class KindIngestor extends Ingestor {
  private kinds: Set<number> = new Set();

  feed(note: Note): void {
    this.kinds.add(note.kind);
    if(this.kinds.size < this.sampleSize) return 
    this.complete();
  }

  poop(): number[] {
    return Array.from(this.kinds);
  }
}