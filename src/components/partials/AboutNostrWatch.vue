<template>
  <Popover class="relative">
    <PopoverButton>🤍</PopoverButton>
    <PopoverPanel class="absolute -left-32 mt-3 z-9000 bg-white dark:bg-slate-900">
      <div class="w-64 px-3 py-5 text-xs">
        <div>
          nostr.watch was created in the wee hours of
          a cold, restless night in Central Europe.
          I stumbled into nostr while messing around 
          with some LND integrations. I was looking for 
          a fun project to work on, and found
          <a href="">nostr-relay-registry</a>,
          forked it and nostr.watch was born.
        </div>
        <div class="border-t border-slate-700">
          <span>Follow me for updates and bad sandwich jokes</span>
          <img alt="sandwich" src="https://cloudflare-ipfs.com/ipfs/QmeCYiohwh8mKgYTaBNXHQ8etRJpVYpiBSqhdkVx5dWP4a" class="block m-auto h-10 w-10 rounded-full " />
          <span>
            <code class="inline-block">nip05:bread@sandwich.farm</code> 
            <span class="inline-block">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </span>
          </span>
          <code class="cursor-pointer" @click="RelaysLib.copy('npub1uac67zc9er54ln0kl6e4qp2y6ta3enfcg7ywnayshvlw9r5w6ehsqq99rx')">npub1uac67zc9er54ln0kl6e4qp2y6ta3enfcg7ywnayshvlw9r5w6ehsqq99rx</code>
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