<script lang="ts">

import { getBrowserInfo } from "$lib/utils/compat.js"
import { doBootstrap } from "$lib/stores/routines";
import { onMount } from "svelte";

onMount( () => {
    doBootstrap.set(false)
})

$: browser = getBrowserInfo()
</script>

<div class="flex flex-col items-center justify-center h-screen">
    <div class="text-2xl">Unsupported Browser</div>
    <div class="text-lg">This version of nostr.watch does not support 
        {browser.name} 
        <span class="text-sm italic text-white/60">{browser.version} </span>
    </div>
  </div>