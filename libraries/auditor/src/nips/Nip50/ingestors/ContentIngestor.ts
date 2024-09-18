import { Ingestor } from '#base/Ingestor.js';
import { Note } from '#nips/Nip01/interfaces/Note.js';
import { isNaturalLanguage } from '#utils/discriminators.js'

export class ContentIngestor extends Ingestor {
  readonly sampleSize: number = 5;
  private searches = new Set<string>();

  constructor(sampleSize?: number) {
    super();
    if(sampleSize) this.sampleSize = sampleSize;
  }

  feed(note: Note): void {
    if(!this?.signal) throw new Error('Ingestor not registered with signal');
    if(!isNaturalLanguage(note.content)) return;
    let term = null;
    let tries = 0;
    while(term === null && tries < 10){
      const word = this.getRandomWord(note.content, 4, 12);
      if(word) term = word;
      tries++;
    }
    if(term !== null) this.searches.add(term);
    if(this.searches.size >= this.sampleSize) {
      this.signal.emit('ingestor:abort');
    }
  }

  poop(): string[] {
    return Array.from(this.searches);
  }

  getRandomWord(paragraph: string, minLength: number = 4, maxLength: number = 10): string | null {
    const words = paragraph.match(/(?<=^|\s)[a-zA-Z]+(?=\s|$)/g)
      ?.filter(word => word.length >= minLength && word.length <= maxLength) || [];
    
    if (words.length === 0) {
      return null;
    }
  
    const randomIndex = Math.floor(Math.random() * words.length);
    return words[randomIndex];
  }
  
  
  
}