<script lang="ts">

    import { clickToCopy } from "$utils/ux";

    export let title: string;
    export let icon: string | undefined = undefined;
    export let subtitle: string | undefined = undefined;
    export let copyable: boolean = true;
    export let banner: string | undefined = undefined;
    export let bgOpacity: number = 0.2;

    const noop=()=>{}

</script>
<header
  id="relay-header"
  class="relative bg-center bg-cover bg-no-repeat px-3 pb-10 gradient-purple pt-24"
  style={banner? `background: linear-gradient(rgba(0, 0, 0, ${bgOpacity}), rgba(0, 0, 0, ${bgOpacity})),  url('${banner}');
    background-repeat: no-repeat;
    background-size: cover;`: ''}
>
  <!-- Absolute positioned slot for overlays like maps -->
  <slot name="absolute" />

  <div class="relative z-10 flex justify-between items-start p-6 h-full">
    <div class="flex">
    <div class="flex-shrink-0 mr-2">
        {#if icon}
            <span class="inline-block overflow-hidden rounded-full w-20 h-20">
            <img src="{icon}" alt="relay icon" class="inline mr-2 w-full h-auto" />
            </span>
        {/if}
    </div>
      <div class="">
        <h1 class="copy-this relative">
          {#if copyable}
            <span
              class="inline-block -mt-2 relative text-black/50 dark:text-white text-6xl py-2 px-3 rounded-lg cursor-pointer hover:bg-white/50 hover:dark:bg-black/50"
              use:clickToCopy
              aria-label="Copy to clipboard"
            >
              {title}
            </span>
            <span class="copy-message">click to copy</span>
          {:else}
            <span class="inline-block -mt-2 relative text-black/50 dark:text-white text-6xl py-2 px-3 rounded-lg">
              {title}
            </span>
          {/if}
        </h1>
        {#if subtitle}
            <span class="ml-3 text-lg block">{@html subtitle}</span>
        {/if}
        <slot />
      </div>
    </div>
    <slot name="right" />
  </div>
</header>

<style lang="postcss">
    h1 > .copy-message {
        @apply hidden absolute bg-black/50 dark:bg-white/50 text-white dark:text-black text-xs px-1 rounded;
    }

    h1:hover > .copy-message {
        @apply block -top-1;
    }
</style>
