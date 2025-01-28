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

export const randomLoadingMessage = () => { 
  const messages = [
    'desperately trying to find the meaning of life',
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
    'presently annoying fiatjaf, need a sec.',
    'telling pablo purplepag.es is down',
    'asking gigi to forgive me for missing the hike',
    'running branl.',
    'meat good.',
    `showing benthecarmen this isn't the dumbest thing he's ever heard`,
    'telling fiatjaf websockets suck',
    'deduplicating fuzzy strings in relay lists',
    'waiting for the day relays have pubkeys',
    'waiting for the day NIPs that have no impact on relays will be called NAPs',
    `wondering why some relays don't support NIP-01`,
    `wondering why most NIP-50 relays do case sensitive searches`,
    `terminating websocket connection with beligerent relay`,
  ]

  return messages[Math.floor(Math.random() * messages.length)];
}