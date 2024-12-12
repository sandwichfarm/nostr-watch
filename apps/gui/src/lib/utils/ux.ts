export const clickToCopy = (node: HTMLElement, target?: string) => {
    async function copyText(): Promise<void> {
      let text = target
        ? document.querySelector<HTMLElement>(target)?.innerText ?? ''
        : node.innerText;
  
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
  

  export function observeViewport(node, options = {}) {
    const observer = new IntersectionObserver(([entry]) => {
        node.dispatchEvent(
        new CustomEvent('viewportchange', {
            detail: {
            isIntersecting: entry.isIntersecting,
            intersectionRatio: entry.intersectionRatio,
            },
        })
        );
    }, options);

    observer.observe(node);

    return {
        destroy() {
            observer.unobserve(node);
        },
    };
}