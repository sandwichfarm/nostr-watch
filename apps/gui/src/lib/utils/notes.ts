import { marked, type MarkedOptions } from "marked";
import * as DOMPurify from 'dompurify';
import { writable, type Writable } from 'svelte/store';
import { nip19 } from "nostr-tools";
import { get } from 'svelte/store';
import type { UserService } from "$lib/services/UserService";
import { userService } from '$lib/stores/user.js';

type SyncTransform = (input: string) => string;
type AsyncTransform = (input: string, update: (output: string) => void) => Promise<void>;

interface ParseConfig {
  removeHashtags?: boolean;
  nip19?: boolean;
  markdown?: boolean;
  markdownOptions?: MarkedOptions;
  images?: boolean;
  videos?: boolean;
  truncate?: boolean;
  truncateLength?: number;
  sanitize?: boolean;
  replaceAmpersand?: boolean;
}

const defaultConfig: ParseConfig = {
  removeHashtags: true,
  nip19: true,
  markdown: true,
  markdownOptions: { breaks: true },
  images: true,
  videos: true,
  truncate: false,
  truncateLength: 50,
  sanitize: false,
  replaceAmpersand: true,
};

class Parser {
  private syncTransforms: SyncTransform[] = [];
  private asyncTransforms: AsyncTransform[] = [];

  addSync(transform: SyncTransform) {
    this.syncTransforms.push(transform);
  }

  addAsync(transform: AsyncTransform) {
    this.asyncTransforms.push(transform);
  }

  applySync(input: string): string {
    return this.syncTransforms.reduce((acc, transform) => transform(acc), input);
  }

  applyAsync(input: string, update: (output: string) => void): void {
    this.asyncTransforms.forEach(transform => {
      transform(input, update).catch(err => console.error('Async transform error:', err));
    });
  }
}


function removeHashtags(input: string): string {
  return input.replace(/#[\w\-]+/g, '');
}

function parseImages(text: string): string {
  return text.replace(/https?:\/\/\S+\.(png|gif|jpg|jpeg|webp|svg|bmp)\b/gi, (match) => `<img src="${match}" alt="Image" class="my-2" />`);
}

function parseVideos(text: string): string {
  let videoHTML = '';
  const updatedText = text.replace(/https?:\/\/\S+\.mp4\b/gi, (match) => {
    videoHTML += `<video controls src="${match}" type="video/mp4">Your browser does not support the video tag.</video><br>`;
    return '';
  });
  return videoHTML + updatedText;
}

function truncateText(str: string, max: number = 10): string {
  const words = str.trim().split(' ');
  const ellipsis = words.length > max ? '...' : '';
  return words.slice(0, max).join(' ') + ellipsis;
}

function replaceAmpersand(text: string): string {
  return text.replace(/&;/g, `'`);
}

function hasNip19(text: string): boolean {
  const NIP19_REGEX = /nostr:(nevent|nprofile|naddr|nrelay|npub|note)[\w\d]+/gi;
  return NIP19_REGEX.test(text);
}

function replaceYoutubeLink(text: string): string {
    const youtubeRegex = /(https?:\/\/(?:www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+))/g;

    if (!youtubeRegex.test(text)) {
        return text;
    }

    return text.replace(youtubeRegex, (match, url, domain, videoId) => {
        return `<iframe 
                    width="100%" 
                    height="auto" 
                    src="https://www.youtube.com/embed/${videoId}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>`;
    });
}


async function replaceNip19(text: string, update: (output: string) => void): Promise<void> {
  const NIP19_REGEX = /nostr:(nevent|nprofile|naddr|nrelay|npub|note)[\w\d]+/gi;
  const matches = [...text.matchAll(NIP19_REGEX)];
  if (matches.length === 0) return;

  const replacements = await Promise.all(matches.map(async (m) => {
    const original = m[0];
    const encoded = original.replace('nostr:', '');
    const { type, data } = nip19.decode(encoded);
    const classes = "inline-block px-2 py-1 rounded-sm bg-black/20 text-white/70 hover:text-white/80 hover:bg-black/10"

    let replacement = original;
    if (type === 'npub') {
      const service: UserService | null = get(userService);
      if (!service) {
        return { original, replacement: encoded };
      }
      const user = service.userFromPubkey(data);
      await user.ready();
      replacement = `<a href="https://njump.me/${encoded}" class="${classes}">${user.name}</a>`;
    } else if (type === 'nevent') {
      replacement = `<a href="https://njump.me/${encoded}" class="${classes} block mt-3">View Attached Event</a>`;
    } else if (type === 'naddr') {
      replacement = `<a href="https://njump.me/${encoded}" class="${classes} block mt-3">View Attached Event</a>`;
    } else if (type === 'nprofile') {
      replacement = `<a href="https://njump.me/${encoded}" class="${classes} block mt-3">View Attached Profile</a>`;
    } else if (type === 'note'){
      replacement = `<a href="https://njump.me/${encoded}" class="${classes} block mt-3">View Attached Note</a>`;
    }

    //console.log('nip19', { original, replacement });

    return { original, replacement };
  }));

  replacements.forEach(({ original, replacement }) => {
    //console.log("Replacing:", original, "with:", replacement);
    text = text.replace(original, replacement);
  });

  update(text);
}


async function applyMarkdown(text: string, update: (output: string) => void, options: MarkedOptions): Promise<void> {
  const html = await marked(text, options);
  update(html);
}

function applySanitize(text: string, update: (output: string) => void): void {
  const sanitized = DOMPurify.sanitize(text);
  update(sanitized);
}

export function parseNote(input: string, config: ParseConfig = defaultConfig): Writable<string> {
  const store = writable<string>(input);

  const parser = new Parser();

  if (config.images) {
    parser.addSync(parseImages);
  }

  if (config.videos) {
    parser.addSync(parseVideos);
  }

  if (config.removeHashtags) {
    parser.addSync(removeHashtags);
  }

  if (config.truncate) {
    parser.addSync((input: string) => truncateText(input, config.truncateLength!));
  }

  if (config.replaceAmpersand) {
    parser.addSync(replaceAmpersand);
  }

  parser.addSync(replaceYoutubeLink);

  let content = parser.applySync(input);
  store.set(content);

  if (config.nip19) {
    parser.addAsync(replaceNip19);
  }

  if (config.markdown) {
    parser.addAsync(async (text: string, update: (output: string) => void) => {
      await applyMarkdown(text, update, config.markdownOptions!);
    });
  }

  if (config.sanitize) {
    parser.addAsync((text: string, update: (output: string) => void) => {
      applySanitize(text, update);
      return Promise.resolve();
    });
  }

  parser.applyAsync(content, (updatedContent) => {
    store.set(updatedContent);
  });

  return store;
}
