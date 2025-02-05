<script lang="ts">
    import Badge from '$lib/components/ui/badge/badge.svelte';
	import type { Nip66CheckEvent } from '@nostrwatch/route66/models';
    import SummarizeRelayCheck from './SummarizeRelayCheck.svelte';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import { relayLivenessChecks$ } from '$stores/helpers/helpers-relay';
    
    const relayUrl = generateRelayUrlFromPath();
    const checks = relayLivenessChecks$(relayUrl);  
    
</script>
{#if $checks.length}
<div class="mb-5">
    Reported <em>online</em> by <Badge class="rounded-full">{$checks.length}</Badge> monitors
</div>
{#each $checks as check}
    <!-- {#if check?.pubkey} -->
    <SummarizeRelayCheck {check} />
    <!-- {/if} -->
{/each}
{/if}