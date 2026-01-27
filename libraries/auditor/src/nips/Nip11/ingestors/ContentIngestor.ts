import { Ingestor } from '#base/Ingestor.js';
import { Note } from '#nips/Nip01/interfaces/Note.js';
import { isNaturalLanguage } from '#utils/discriminators.js'

export class ContentIngestor extends Ingestor {
  readonly sampleSize: number = 10;
  private searches = new Set<string>();

  constructor(sampleSize?: number) {
    super();
    if(sampleSize) this.sampleSize = sampleSize;
  }

  feed(note: Note): void {
    if(!isNaturalLanguage(note.content) || this.searches.has(note.content)) return;
    this.searches.add(note.content);
    if(this.searches.size >= this.sampleSize) {
      this.signal.emit('ingestor:abort');
    }
  }

  poop(): string[] {
    return Array.from(this.searches);
  }
}