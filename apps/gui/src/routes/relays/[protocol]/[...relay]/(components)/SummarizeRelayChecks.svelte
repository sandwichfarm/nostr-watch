<script lang="ts">
    import Badge from '$lib/components/ui/badge/badge.svelte';
	import type { Nip66CheckEvent } from '@nostrwatch/route66/models';
    import SummarizeRelayCheck from './SummarizeRelayCheck.svelte';
	
	import { readable, type Readable } from 'svelte/store';
    
    export let checks: Readable<Nip66CheckEvent[]> = readable([])
</script>
{#if $checks.length}
<div class="mb-5">
    Reported <em>online</em> by <Badge class="rounded-full">{$checks.length}</Badge> monitors
</div>
{#each $checks as check}
    <SummarizeRelayCheck {check} />
{/each}
{/if}