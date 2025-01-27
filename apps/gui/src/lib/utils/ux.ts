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

export function observeViewport(node: HTMLElement, options = {}, debounceTime = 500) {
  let lastIsIntersecting = false; // Track state to avoid redundant events
  let timeoutId: number | null = null;

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
