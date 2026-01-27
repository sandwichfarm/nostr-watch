<script lang="ts">
import { relayLivenessCounts } from '$stores';
</script>

<span class="flex items-center gap-2 font-mono ml-4 relative text-xs flex items-center gap-1 font-mono font-bold opacity-80">
    <span class="text-green-300" title="online">{$relayLivenessCounts.online}</span>
    <span class="opacity-80">/</span>
    <span class="text-yellow-400" title="offline">{$relayLivenessCounts.offline}</span>
    <span class="opacity-80">/</span>
    <span class="text-red-300" title="dead">{$relayLivenessCounts.dead}</span>
</span>