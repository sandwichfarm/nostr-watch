import { Ingestor } from '#base/Ingestor.js';
import { Note } from '../interfaces/Note.js';

export class SingleTagIngestor extends Ingestor {
  private tags: Set<string> = new Set();
  private tag: string[] = [];

  feed(note: Note): void {
    if (this.tags.size >= this.sampleSize)
        return;
    let singleLetterTags = [];
    try {
        singleLetterTags = note.tags.filter((tag: string[]) => tag[0].length === 1);
    }
    catch (error) {
        console.warn(`Note ${note.id} had a tag with an empty item: ${note.tags}`)
    }
    if (singleLetterTags.length > 0) {
        this.tag = singleLetterTags[0];
        this.complete();
    }
  }

  poop(): string[] {
    return this.tag;
  }
}