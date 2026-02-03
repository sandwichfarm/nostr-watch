export const clickToCopy = (node: HTMLElement, target?: string) => {
  async function copyText(): Promise<void> {
    let text = target
      ? document.querySelector<HTMLElement>(target)?.innerText ?? ''
      : node.textContent ?? ''; // Use textContent instead of innerText for better performance

    try {
      await navigator.clipboard.writeText(text);
      node.dispatchEvent(
        new CustomEvent('copysuccess', {
          bubbles: true,
        })
      );
    } catch (error) {
      node.dispatchEvent(
        new CustomEvent('copyerror', {
          bubbles: true,
          detail: error,
        })
      );
    }
  }

  node.addEventListener('click', copyText);

  return {
    destroy() {
      node.removeEventListener('click', copyText);
    },
  };
};

export function observeViewport(node: HTMLElement, options: { infiniteScroll?: boolean } = { infiniteScroll: true }, debounceTime = 500) {
  const { infiniteScroll } = options;
  let lastIsIntersecting = false;
  let timeoutId: number | null = null;
  
  if(!infiniteScroll) return;

  const debounceEvent = (callback: () => void, delay: number) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(callback, delay);
  };

  const observer = new IntersectionObserver(([entry]) => {
    const isIntersecting = entry.isIntersecting;

    if (isIntersecting !== lastIsIntersecting) {
      lastIsIntersecting = isIntersecting;

      debounceEvent(() => {
        node.dispatchEvent(
          new CustomEvent('viewportchange', {
            detail: {
              isIntersecting: isIntersecting,
              intersectionRatio: entry.intersectionRatio,
            },
          })
        );
      }, debounceTime);
    }
  }, options);

  observer.observe(node);

  return {
    destroy() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      observer.unobserve(node);
    },
  };
}

export type InViewChangeDetail = {
  inView: boolean;
  intersectionRatio: number;
};

export function observeInView(
  node: HTMLElement,
  options: (IntersectionObserverInit & { disabled?: boolean; debounceMs?: number }) = {}
) {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    return { destroy() {} };
  }

  let observer: IntersectionObserver | null = null;
  let timeoutId: number | null = null;
  let lastInView: boolean | null = null;

  function stop() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (observer) {
      observer.unobserve(node);
      observer.disconnect();
      observer = null;
    }
  }

  function start(opts: (IntersectionObserverInit & { disabled?: boolean; debounceMs?: number }) = {}) {
    if (opts.disabled) return;

    const debounceMs = Math.max(0, Math.floor(opts.debounceMs ?? 100));
    const inputThreshold = opts.threshold;
    const thresholds = Array.isArray(inputThreshold)
      ? Array.from(new Set([0, ...inputThreshold]))
      : typeof inputThreshold === 'number' && Number.isFinite(inputThreshold) && inputThreshold !== 0
        ? [0, inputThreshold]
        : 0;

    observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting;
        if (lastInView === inView) return;
        lastInView = inView;

        const emit = () => {
          node.dispatchEvent(
            new CustomEvent<InViewChangeDetail>('inviewchange', {
              detail: {
                inView,
                intersectionRatio: entry.intersectionRatio,
              },
            })
          );
        };

        if (debounceMs === 0) {
          emit();
          return;
        }

        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          timeoutId = null;
          emit();
        }, debounceMs);
      },
      {
        root: opts.root ?? null,
        rootMargin: opts.rootMargin,
        threshold: thresholds,
      }
    );

    observer.observe(node);
  }

  start(options);

  return {
    update(next: IntersectionObserverInit & { disabled?: boolean; debounceMs?: number }) {
      stop();
      start(next);
    },
    destroy() {
      stop();
    },
  };
}

export const randomLoadingMessage = () => { 
  const messages = [
    'trying to find the lost city of Atlantis',
    'searching for the Holy Grail',
    'looking for the needle in the haystack',
    'searching for the pot of gold at the end of the rainbow',
    'trying to find the end of the rainbow',
    'looking for the end of the universe',
    'searching for the end of the internet',
    'trying to find the end of the world',
    'searching for the end of time',
    'looking for the end of the rainbow',
    'pondering the meaning of life',
    'searching for the meaning of life',
    'asking tough questions',
    'rm -fr /',
    'busy annoying fiatjaf, need a sec.',
    '...hopefully the pages are still purple',
    'running branl.',
    'meat good.',
    `showing benthecarman this isn't the dumbest thing he's ever heard`,
    'telling fiatjaf websockets suck',
    'deduplicating fuzzy strings in relay lists',
    'one day relays have pubkeys',
    'NIPs that have no impact on relays should be called NAPs',
    `wondering why some relays don't support NIP-01`,
    `wondering why most NIP-50 relays do case sensitive searches`,
    `[terminating websocket connection with beligerent relay]`,
  ]

  return messages[Math.floor(Math.random() * messages.length)];
}
