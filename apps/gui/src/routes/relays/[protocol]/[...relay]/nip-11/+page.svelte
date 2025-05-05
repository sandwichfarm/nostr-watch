<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import * as Table from '$lib/components/ui/table';
    import * as Tabs from '$lib/components/ui/tabs';

    import { Nip11 } from '@nostrwatch/route66/models';
	import { onMount } from 'svelte';
	import { derived, writable, type Readable, type Writable } from 'svelte/store';
    import { SchemaValidationService, type SchemaValidationServiceResponse } from '$lib/services/SchemaValidationService';
	import { setRelayError } from '$lib/stores/relay-errors';
	import JsonHighlighter from '$lib/components/partials/JsonHighlighter.svelte';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import { relayNip11$ } from '$stores/helpers/helpers-nip11s';
	import { dataRegister } from '$stores/data-register';
	import { delay } from '@nostrwatch/utils';
	import { StateManager } from '@nostrwatch/route66';
	import { timeAgo } from '$utils/time';
	import CardLimitation from '../(components)/cards/CardLimitation.svelte';
	import CardNips from '../(components)/cards/CardNips.svelte';
	import { nip11ValidationErrorCount } from '$stores/nip11-validations';
	import { fade } from 'svelte/transition';
	// import { nip11ValidationErrorCount, relayNip11Validations } from '$stores/nip11s';

    const relayUrl = generateRelayUrlFromPath()

    const nip11: Readable<Nip11> = relayNip11$(relayUrl);

    const schemaValidationService = new SchemaValidationService();

    const validationResult: Writable<SchemaValidationServiceResponse | null> = writable(null);

    const nip11Valid: Readable<boolean> = derived(validationResult, $validationResult => {
        return $validationResult?.status === 'success' && $validationResult?.result?.valid === true;
    });

    let timedOut = false;

    const ready = async () => {
        const timeout = setTimeout(() => timedOut = true, 5000);
        while(!$nip11 && !timedOut){
            await delay(100);
        }
    }

    const validate = () => {
        schemaValidationService.validateNip11($nip11?.json, $nip11?.hash).then( (result: SchemaValidationServiceResponse) => {
            if(typeof result !== 'object'){
                throw new Error('Invalid result from schema validation service');
            }
            validationResult.set(result);
            for (const err of result.result.errors) {
                if(!relayUrl) continue;
                setRelayError(relayUrl, 'schema', 'nip11', err.message);
            }
        })
    }

    onMount(async () => {
        $dataRegister.require(
            ['sync:relay:nip11'],
            {'sync:relay:nip11': [relayUrl]}
        ).then( async () => {
            await ready();
            if(timedOut) return;
            validate()
            console.log('synckey', nip11SyncKey)
        })
        
    });

    $: nip11SyncKey = `sync:relay:nip11:${new URL(relayUrl).toString()}`
    $: lastSyncedTimestamp = StateManager.get(nip11SyncKey)
    $: lastSyncedTimeAgo = lastSyncedTimestamp? timeAgo(lastSyncedTimestamp): 'unknown'

</script>

<!-- <pre>
    {JSON.stringify(Array.from($nip11ValidationErrorCount.entries()), null, 4)}
</pre> -->
{#if $nip11}
<div in:fade>
{#if $validationResult} 
    <div class="mb-4">
    {#if $nip11Valid}
        <div class="bg-green-500/30 text-white p-4 rounded-lg">
            <p class="text-lg font-bold">NIP-11 looks good</p>
        </div>
    {:else}
        <div class="bg-red-500/50 text-white p-4 rounded-lg">
            <p class="text-lg font-bold">NIP-11 requires attention</p>
        </div>

        <!-- {#if $validationResult?.result?.errors}
        {#each $validationResult?.result?.errors as result, index}
            <div class="bg-red-500/70 p-4 rounded-lg mt-4">
                <p class="text-sm">#{index+1}: {result.message}</p>
            </div>
        {/each}
        {/if} -->
    {/if}
    </div>
{/if}

{#if $nip11 && $validationResult} 
    <JsonHighlighter
    jsonString={JSON.stringify($nip11?.json, null, 4)}
    ajvResult={$validationResult}
    />
    <CardLimitation />
    <CardNips />
{/if}
</div>
{/if}