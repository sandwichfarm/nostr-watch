import { Ingestor } from '#base/Ingestor.js';
import { Note } from '../interfaces/Note.js';

export class SingleTagIngestor extends Ingestor {
  readonly sampleSize: number = 1;
  private tags: Set<string> = new Set();
  private tag: string[] = [];

  constructor(sampleSize?: number) {
    super();
    if(sampleSize) this.sampleSize = sampleSize;
  }

  feed(note) {
    if (this.tags.size >= this.sampleSize)
        return;
    if (!this?.signal)
        throw new Error('Ingestor not registered with signal');
    let singleLetterTags = [];
    try {
        singleLetterTags = note.tags.filter((tag: string[][]) => tag[0].length === 1);
    }
    catch (error) {
        console.warn(`Note ${note.id} had a tag with an empty item: ${note.tags}`)
    }
    if (singleLetterTags.length > 0) {
        this.tag = singleLetterTags[0];
        this.signal.emit('ingestor:abort');
    }
}

  poop(): string[] {
    return this.tag;
  }
}