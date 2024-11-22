import { Ingestor } from '#base/Ingestor.js';
import { Note } from '../interfaces/Note.js';

export class AuthorIngestor extends Ingestor {
  readonly sampleSize: number = 1;
  private authors: Set<string> = new Set();

  constructor(sampleSize?: number) {
    super();
    if(sampleSize) this.sampleSize = sampleSize;
  }

  feed(note: Note): void {
    if(!this?.signal) throw new Error('Ingestor not registered with signal');
    this.authors.add(note.pubkey);
    if(this.authors.size >= this.sampleSize) {
      this.signal.emit('ingestor:abort');
    }
  }

  poop(): string[] {
    return Array.from(this.authors);
  }
}