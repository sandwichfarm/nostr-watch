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

export function observeViewport(node: HTMLElement, options = {}) {
  let lastIsIntersecting = false; // Track state to avoid redundant events

  const observer = new IntersectionObserver(([entry]) => {
    const isIntersecting = entry.isIntersecting;

    if (isIntersecting !== lastIsIntersecting) {
      lastIsIntersecting = isIntersecting;
      node.dispatchEvent(
        new CustomEvent('viewportchange', {
          detail: {
            isIntersecting: isIntersecting,
            intersectionRatio: entry.intersectionRatio,
          },
        })
      );
    }
  }, options);

  observer.observe(node);

  return {
    destroy() {
      observer.unobserve(node);
    },
  };
}
