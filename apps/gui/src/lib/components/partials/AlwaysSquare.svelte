<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import debounce from 'lodash/debounce';
  
    export let reference: 'width' | 'height' = 'width';
    let squareEl: HTMLDivElement | null = null;

    function adjustSquare() {
      if (!squareEl) return;

      const width = squareEl.offsetWidth,
            height = squareEl.offsetHeight;

      if (reference === 'width') {
        console.log('always square: changing height to', width);
        squareEl.classList.add(`h-[${width}px]`);
        // squareEl.style.height = `${width}px`;
      } else if (reference === 'height') {
        console.log('always square: changing width to', height);
        squareEl.style.width = `${height}px`;
        // squareEl.classList.add(`w-[${height}px]`);
      }
      else {
        console.log('always square: no changes made');
      }
    }
  
    const debouncedAdjust = debounce(adjustSquare, 10);
  
    onMount(() => {
      adjustSquare();
      window.addEventListener('resize', debouncedAdjust);
    });
  
    onDestroy(() => {
      window.removeEventListener('resize', debouncedAdjust);
    });
  </script>
  
  <style lang="postcss">
    .square-transition {
        @apply transition-all;
    }
  </style>

  <div
    bind:this={squareEl}
    class="square-transition"
    >
    <slot />
  </div>
  