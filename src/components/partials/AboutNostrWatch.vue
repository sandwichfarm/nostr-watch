<template>
  <Popover class="relative mr-2 sm:hidden md:hidden">
    <PopoverButton>🤍</PopoverButton>
    <PopoverPanel class="absolute border border-slate-600 rounded-md -left-48 mt-3 z-9000 bg-white dark:bg-slate-900">
      <div class="w-96 px-3 py-5">
        <div class="font-bold text-md pb-3">
          I launched nostr.watch as a prototype for fun
          and a few weeks later nostr took off. Built 
          with Vue3/Pinia, Tailwind and nostr-relay-inspector.
          <span class="italic text-black">Thank you for giving me something positive to focus on.</span>
        </div>
        <div class="border-t text-md pt-3 border-slate-700">
          <img alt="sandwich" src="https://cloudflare-ipfs.com/ipfs/QmeCYiohwh8mKgYTaBNXHQ8etRJpVYpiBSqhdkVx5dWP4a" class="block m-auto h-14 w-14 rounded-full mb-2" />
          <span>Follow me for updates and bad sandwich jokes</span>
          <span class="block relative cursor-pointer py-1 px-1" @click="RelaysLib.copy('npub1uac67zc9er54ln0kl6e4qp2y6ta3enfcg7ywnayshvlw9r5w6ehsqq99rx')">
            <code class="block truncate">npub1uac67zc9er54ln0kl6e4qp2y6ta3enfcg7ywnayshvlw9r5w6ehsqq99rx</code>
            <span ref="about_msg_copied" class="text-xs">click to copy</span>
          </span>
          <span>
            <span ref="about_msg_copied" class="text-xs mr-1">
              NIP-05 & 
              <span class="inline-block">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </span>
            </span>
            <a class="inline-block" href="lightning:bread@sandwich.farm">bread@sandwich.farm</a> 
          </span>
        </div>
      </div>
      <img src="/solutions.jpg" alt="" />
    </PopoverPanel>
  </Popover>
</template>

<script setup>
  import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue'
  import RelaysLib from '@/shared/relays-lib'
</script>

<script>
</script>