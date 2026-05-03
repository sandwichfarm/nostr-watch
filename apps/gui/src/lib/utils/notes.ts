import { marked, type MarkedOptions } from 'marked';
import * as DOMPurify from 'dompurify';
import { writable, get, type Writable } from 'svelte/store';
import { nip19 } from 'nostr-tools';
import type { UserService } from '$lib/services/UserService';
import { userService } from '$lib/stores/services.js';
import { escapeHtml, safeImageUrl } from '$lib/utils/sanitize';

/**
 * Nostr event content parser — sequential async pipeline with always-on
 * DOMPurify at the LAST step. Closes FEED-01..05 from v2.5 GUI XSS Hardening.
 *
 * # Security contract
 *
 * Every async transform runs in order; each transform's output feeds the
 * next. applySanitize is the LAST async step and runs UNCONDITIONALLY —
 * the `config.sanitize` field is preserved for back-compat with the 4
 * caller files (FeedNoteContent, FeedNote, FeedMasonryNote, Reader) that
 * literally pass `sanitize: false`, but the field is now a NO-OP and the
 * applySanitize step always appends. Stripping the option from the 4
 * callers is a Phase 29 AUDIT-01 cosmetic follow-up.
 *
 * Belt-and-suspenders per-step hardening:
 *   - parseImages / parseVideos: every matched URL passes through
 *     safeImageUrl (Phase 24); rejected URLs are REMOVED from the text;
 *     URL regex tightened from `\S+` to `[^\s"'<>]+` (defense-in-depth
 *     above safeImageUrl). Closes FEED-02.
 *   - replaceNip19: user.name passes through escapeHtml before
 *     interpolation; encoded npub/nevent etc. also pass through escapeHtml
 *     in href positions (paranoid consistency — bech32 chars are
 *     [a-z0-9] so already safe). Closes FEED-03.
 *   - applyMarkdown: marked output flows into the final applySanitize
 *     step; no special-casing.
 *   - applySanitize: DOMPurify.sanitize(text) — strips <script>,
 *     event handlers, javascript: URLs, etc. Closes FEED-01 / FEED-04 /
 *     FEED-05.
 *
 * # YouTube iframe survival
 *
 * DOMPurify's default config strips <iframe>. replaceYoutubeLink emits an
 * <iframe> shape; we extend ALLOWED_TAGS at the applySanitize step to
 * preserve YouTube embeds. The src attribute is locked by the
 * replaceYoutubeLink regex (videoId = `[a-zA-Z0-9_-]+`) so no attacker
 * input can reach the iframe.
 *
 * # Pipeline order (CONTEXT.md locked decision)
 *
 *   parseImages (sync)          [safeImageUrl-validated]
 *   -> parseVideos (sync)       [safeImageUrl-validated]
 *   -> removeHashtags (sync)
 *   -> truncate (sync, optional)
 *   -> replaceAmpersand (sync)
 *   -> replaceYoutubeLink (sync)
 *   -> replaceNip19 (async)     [escapeHtml-wrapped user.name]
 *   -> applyMarkdown (async)    [marked]
 *   -> applySanitize (async, ALWAYS-ON, LAST)  [DOMPurify]
 */

type SyncTransform = (input: string) => string;
type AsyncTransform = (input: string) => Promise<string>;

export type ParseConfig = {
  removeHashtags?: boolean;
  nip19?: boolean;
  markdown?: boolean;
  markdownOptions?: MarkedOptions;
  images?: boolean;
  videos?: boolean;
  truncate?: boolean;
  truncateLength?: number;
  /**
   * @deprecated Phase 28 (v2.5 GUI XSS Hardening) made this field a no-op.
   * applySanitize always runs as the final pipeline step regardless of
   * this value. Field preserved for back-compat with the 4 caller files
   * that literally pass `sanitize: false`. A future cleanup phase
   * (Phase 29 AUDIT-01) may strip the field entirely.
   */
  sanitize?: boolean;
  replaceAmpersand?: boolean;
};

const defaultConfig: ParseConfig = {
  removeHashtags: true,
  nip19: true,
  markdown: true,
  markdownOptions: { breaks: true },
  images: true,
  videos: true,
  truncate: false,
  truncateLength: 50,
  sanitize: true,
  replaceAmpersand: true,
};

/**
 * Sequential pipeline. Each async transform receives the prior transform's
 * output as input and returns the next text-state Promise. The previous
 * `Parser.applyAsync` ran every transform on the SAME input in parallel —
 * a race where the final store value was whichever callback fired last.
 * That bug is the structural reason DOMPurify never saw the markdown output
 * even when sanitize:true was set. Fixed here.
 */
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

  async applyAsyncSequential(input: string): Promise<string> {
    let current = input;
    for (const transform of this.asyncTransforms) {
      try {
        current = await transform(current);
      } catch (err) {
        console.error('Async transform error:', err);
        // Fail-closed: keep the prior text-state. The applySanitize
        // step at the end still runs, so a thrown earlier transform
        // cannot leak un-sanitized HTML.
      }
    }
    return current;
  }
}

function removeHashtags(input: string): string {
  return input.replace(/#[\w\-]+/g, '');
}

/**
 * FEED-02: parseImages with safeImageUrl validation.
 *
 * Regex tightened from `\S+` to `[^\s"'<>]+` — defense-in-depth so the
 * captured URL cannot contain attribute-breakout chars even before
 * safeImageUrl runs. safeImageUrl additionally rejects the same set
 * (and protocol-disallowlisted schemes), returning '' on reject.
 *
 * Rejected URLs are REMOVED from the text (per CONTEXT.md decision —
 * cleaner UX than leaving a malformed URL as visible text).
 */
function parseImages(text: string): string {
  return text.replace(
    /https?:\/\/[^\s"'<>]+\.(png|gif|jpg|jpeg|webp|svg|bmp)\b/gi,
    (match) => {
      const safe = safeImageUrl(match);
      if (!safe) return ''; // Reject -> remove from text.
      return `<img src="${safe}" alt="Image" class="my-2" />`;
    },
  );
}

/**
 * FEED-02: parseVideos with safeImageUrl validation.
 *
 * Same shape as parseImages. safeImageUrl is the right helper for video
 * src too — the allowlist (http(s):// or data:image/) excludes
 * data:video/mp4 (rare, and we'd rather not allow it without an explicit
 * helper). CONTEXT.md decides "use safeImageUrl for both; revisit if a
 * future phase needs a safeMediaUrl with video-specific schemes."
 */
function parseVideos(text: string): string {
  let videoHTML = '';
  const updatedText = text.replace(
    /https?:\/\/[^\s"'<>]+\.mp4\b/gi,
    (match) => {
      const safe = safeImageUrl(match);
      if (!safe) return ''; // Reject -> remove (do NOT emit raw URL as text).
      videoHTML += `<video controls src="${safe}" type="video/mp4">Your browser does not support the video tag.</video><br>`;
      return '';
    },
  );
  return videoHTML + updatedText;
}

function truncateText(str: string, max: number = 10): string {
  const words = str.trim().split(' ');
  const ellipsis = words.length > max ? '...' : '';
  return words.slice(0, max).join(' ') + ellipsis;
}

function replaceAmpersand(text: string): string {
  // Out of scope per CONTEXT.md (dead-ish code; future cleanup).
  return text.replace(/&;/g, `'`);
}

function replaceYoutubeLink(text: string): string {
  const youtubeRegex = /(https?:\/\/(?:www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+))/g;
  if (!youtubeRegex.test(text)) return text;
  // videoId is restricted to [a-zA-Z0-9_-]+ at the regex level — safe by
  // construction. Still passes through DOMPurify at the final step (which
  // is configured to allow <iframe> with a tight attribute allowlist).
  return text.replace(youtubeRegex, (_match, _url, _domain, videoId) => {
    return `<iframe width="100%" height="auto" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  });
}

/**
 * FEED-03: replaceNip19 with escapeHtml-wrapped user.name.
 *
 * The npub branch reads kind:0 metadata via UserService. user.name is
 * attacker-controlled (any kind:0 publisher on wss://purplepag.es /
 * wss://user.kindpag.es). Wrap through escapeHtml before interpolating
 * into the <a> text position.
 *
 * encoded (the bech32 string) is also wrapped in escapeHtml in href
 * positions for paranoid consistency — bech32 chars are [a-z0-9] so
 * the helper is a no-op in practice; the wrap protects against a
 * future regression in the bech32 encoder.
 */
async function replaceNip19(text: string): Promise<string> {
  try {
    const NIP19_REGEX = /nostr:(nevent|nprofile|naddr|nrelay|npub|note)[\w\d]+/gi;
    const matches = [...text.matchAll(NIP19_REGEX)];
    if (matches.length === 0) return text;

    const replacements = await Promise.all(
      matches.map(async (m) => {
        const original = m[0];
        let replacement = original;
        try {
          const encoded = original.replace('nostr:', '');
          const safeEncoded = escapeHtml(encoded); // Paranoid wrap.
          const { type, data } = nip19.decode(encoded);
          const classes =
            'inline-block px-2 py-1 rounded-sm bg-black/20 text-white/70 hover:text-white/80 hover:bg-black/10';

          if (type === 'npub') {
            const service: UserService | null = get(userService);
            if (!service) {
              return { original, replacement: encoded };
            }
            const user = service.userFromPubkey(data as string);
            await user.ready();
            // FEED-03 LIVE FIX: escape attacker-controlled user.name
            // before interpolating into the <a> text position.
            const safeName = escapeHtml(user.name ?? '');
            replacement = `<a href="https://njump.me/${safeEncoded}" class="${classes}">${safeName}</a>`;
          } else if (type === 'nevent') {
            replacement = `<a href="https://njump.me/${safeEncoded}" class="${classes} block mt-3">View Attached Event</a>`;
          } else if (type === 'naddr') {
            replacement = `<a href="https://njump.me/${safeEncoded}" class="${classes} block mt-3">View Attached Event</a>`;
          } else if (type === 'nprofile') {
            replacement = `<a href="https://njump.me/${safeEncoded}" class="${classes} block mt-3">View Attached Profile</a>`;
          } else if (type === 'note') {
            replacement = `<a href="https://njump.me/${safeEncoded}" class="${classes} block mt-3">View Attached Note</a>`;
          }
        } catch (e) {
          console.error('Error in replaceNip19:', e);
        }
        return { original, replacement };
      }),
    );

    let out = text;
    for (const { original, replacement } of replacements) {
      out = out.replace(original, replacement);
    }
    return out;
  } catch (e: unknown) {
    console.error('Error in replaceNip19:', e);
    return text;
  }
}

async function applyMarkdown(text: string, options: MarkedOptions): Promise<string> {
  const html = await marked(text, options);
  return typeof html === 'string' ? html : String(html);
}

/**
 * FEED-01 / FEED-04 / FEED-05: applySanitize is the FINAL async step
 * and runs UNCONDITIONALLY. DOMPurify's default config strips <script>,
 * event handlers (onerror, onclick, ...), and javascript: / data:text/html
 * URLs from href / src.
 *
 * <iframe> survival: ADD_TAGS includes 'iframe' so replaceYoutubeLink's
 * embed survives. ADD_ATTR includes 'src' (in addition to 'allow',
 * 'allowfullscreen', 'frameborder', 'scrolling') so DOMPurify preserves
 * the src attribute on the iframe — without it, DOMPurify allows the
 * <iframe> tag but strips src, breaking the embed. The iframe src is
 * locked by replaceYoutubeLink's regex (videoId = [a-zA-Z0-9_-]+) so no
 * attacker input can reach the iframe. ALLOW_TAGS is NOT used (would
 * replace the default allowlist); ADD_TAGS / ADD_ATTR extend it.
 */
function applySanitize(text: string): string {
  // DOMPurify's CommonJS shape: in some bundler setups DOMPurify is the
  // default export; in others it's the module namespace. The current
  // codebase uses `import * as DOMPurify` — the .sanitize is on the
  // namespace OR on .default depending on bundler. Defensive lookup.
  const purify =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (DOMPurify as any).sanitize ?? (DOMPurify as any).default?.sanitize;
  return purify(text, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src'],
  });
}

export function parseNote(input: string, config: ParseConfig = defaultConfig): Writable<string> {
  const store = writable<string>(input);
  const parser = new Parser();

  // ---- Sync stage (in CONTEXT.md-locked order) ----
  if (config.images) parser.addSync(parseImages);
  if (config.videos) parser.addSync(parseVideos);
  if (config.removeHashtags) parser.addSync(removeHashtags);
  if (config.truncate) parser.addSync((s: string) => truncateText(s, config.truncateLength!));
  if (config.replaceAmpersand) parser.addSync(replaceAmpersand);
  parser.addSync(replaceYoutubeLink);

  const syncOut = parser.applySync(input);
  store.set(syncOut);

  // ---- Async stage (sequential composition) ----
  if (config.nip19) {
    parser.addAsync(replaceNip19);
  }
  if (config.markdown) {
    parser.addAsync((text: string) => applyMarkdown(text, config.markdownOptions ?? {}));
  }

  // FEED-05: applySanitize ALWAYS runs as the LAST async step. The
  // config.sanitize field is preserved for back-compat (the 4 callers
  // literally pass `sanitize: false`) but it is now a no-op — the
  // pipeline always appends applySanitize.
  parser.addAsync(async (text: string) => applySanitize(text));

  // Drain the sequential pipeline; emit on the writable store.
  parser
    .applyAsyncSequential(syncOut)
    .then((finalText) => store.set(finalText))
    .catch((err) => {
      console.error('parseNote pipeline error:', err);
      // Fail-closed: leave store at last-good (the sync output).
    });

  return store;
}
