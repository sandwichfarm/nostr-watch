<script lang="ts">
  import Button from '$ui/button/button.svelte';
  import { onMount } from 'svelte';

  export let orientation: 'horizontal' | 'vertical' = 'horizontal';
  export let autoScroll: boolean = true; // Auto-scroll enabled by default
  export let speed: number = 40; // Pixels per second (affects CSS duration)
  export let scrollMode: 'css' | 'js' = 'css'; // New property for scrolling mode
  export let className: string = $$props.class;

  let outerContainer: HTMLDivElement;
  let contentEl: HTMLDivElement;
  let contentWidth = 0;
  let manualOffset = 0;

  // **Calculate auto-scroll duration based on speed**
  function calculateDuration(): string {
    return `${contentWidth / speed}s`; // Ensures slower speeds = longer duration
  }

  // **Ensure content width is measured for scrolling calculations**
  function updateContentWidth() {
    if (contentEl) {
      contentWidth = contentEl.scrollWidth / 2; // We duplicate content for seamless looping
      if (scrollMode === 'css') {
        contentEl.style.setProperty('--scroll-duration', calculateDuration());
      }
    }
  }

  // **Manual scrolling with buttons (only in JS mode)**
  function scrollPrev() {
    if (scrollMode === 'js') {
      contentEl.scrollBy({ left: -speed * 5, behavior: 'smooth' });
    }
  }

  function scrollNext() {
    if (scrollMode === 'js') {
      contentEl.scrollBy({ left: speed * 5, behavior: 'smooth' });
    }
  }

  onMount(() => {
    setTimeout(updateContentWidth, 100); // Ensures correct content measurement
  });
</script>

<!-- **Outer Container (Fixed Size, No Overflow Growth)** -->
<div 
  bind:this={outerContainer}
  class={`relative w-full overflow-hidden ${className}`}
  style="height: 100%;"
>
  <!-- **Content Wrapper (Duplicate Content for Seamless Scroll)** -->
  <div class="absolute inset-0 overflow-hidden px-20">
    <div 
      bind:this={contentEl} 
      class="flex w-max transition-transform"
      class:cssScroll={scrollMode === 'css'}
    >
      <slot />
      <slot />
    </div>
  </div>

  <!-- **Fixed Gradient Overlays (Always Visible)** -->
  {#if orientation === 'horizontal'}
    <div class="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black to-transparent pointer-events-none z-10"></div>
    <div class="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black to-transparent pointer-events-none z-10"></div>
  {/if}

  <!-- **Fixed Arrow Buttons (Only Shown in JS Mode)** -->
  {#if scrollMode === 'js' && orientation === 'horizontal'}
    <div class="absolute top-1/2 left-2 -translate-y-1/2 z-20">
      <Button on:click={scrollPrev} class="rounded-full p-2 shadow bg-black/50 hover:bg-gray-100">
        &larr;
      </Button>
    </div>
    <div class="absolute top-1/2 right-2 -translate-y-1/2 z-20">
      <Button on:click={scrollNext} class="rounded-full p-2 shadow bg-black/50 hover:bg-gray-100">
        &rarr;
      </Button>
    </div>
  {/if}
</div>

<style>
  /* **Smooth, Adjustable Auto-Scroll Animation (Only Active in CSS Mode)** */
  .cssScroll {
    animation: autoScroll var(--scroll-duration, 30s) linear infinite;
  }

  @keyframes autoScroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  /* **Ensure Buttons and Gradients are Fixed to Viewport** */
  .absolute {
    position: absolute;
  }
  
  /* **Fix Scrollbar Hiding** */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
