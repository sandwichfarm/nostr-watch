<script lang="ts">
import { Accordion } from 'radix-svelte';
import Badge from '$lib/components/ui/badge/badge.svelte';
import RelayCheck from './RelayCheck.svelte';

export let checks: any[];

// $: checks = [...checks];

</script>
{#if checks?.length}
<h2>Checks</h2>
<p>Reported <em>online</em> by <Badge class="rounded-full">{checks.length}</Badge> monitors</p>
<Accordion.Root>
{#each checks.filter(Boolean) as check}
    {#if check?.pubkey}
        <RelayCheck {check} />
    {/if}
{/each}
</Accordion.Root>
{/if}