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
	import { get } from 'lodash';
	import { getRelayUrl } from '../(utils)/general';
	import { relayNip11$ } from '$stores/helpers/helpers-nip11s';
	import { dataRegister } from '$stores/data-register';
	import { delay } from '@nostrwatch/utils';
	import { validateAdditionalItems } from 'ajv/dist/vocabularies/applicator/additionalItems';
	import { validateNip11 } from '@nostrwatch/schemata-js-ajv';
	import { StateManager } from '@nostrwatch/route66';
	import { timeAgo } from '$utils/time';
	import CardLimitation from '../(components)/cards/CardLimitation.svelte';
	import CardNips from '../(components)/cards/CardNips.svelte';

    const relayUrl = getRelayUrl()

    const nip11: Readable<Nip11> = relayNip11$(relayUrl);

    const schemaValidationService = new SchemaValidationService();

    const validationResult: Writable<SchemaValidationServiceResponse | null> = writable(null);

    const nip11Valid: Readable<boolean> = derived(validationResult, $validationResult => {
        return $validationResult?.status === 'success' && $validationResult?.result?.valid === true;
    });

    let timedOut = false;

    const ready = async () => {
        const timeout = setTimeout(() => {
            timedOut = true;
        }, 5000);
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
            for (const error of result.result.errors) {
                setRelayError(relayUrl, 'schema', 'nip11', error.message);
            }
        })
    }

    onMount(async () => {
        await $dataRegister.require(
            ['sync:relay:nip11'],
            {'sync:relay:nip11': [relayUrl]}
        );
        await ready();
        if(timedOut) return;
        validate()
        console.log('synckey', nip11SyncKey)
    });

    $: nip11SyncKey = `sync:relay:nip11:${new URL(relayUrl).toString()}`
    $: lastSyncedTimestamp = StateManager.get(nip11SyncKey)
    $: lastSyncedTimeAgo = lastSyncedTimestamp? timeAgo(lastSyncedTimestamp): 'unknown'

    
</script>

{typeof $nip11}

{#if $nip11 && $validationResult} 
    <div>
        NIP-11 last synced {lastSyncedTimestamp? lastSyncedTimestamp: 'wtf?'} {lastSyncedTimeAgo}
    </div>
    <div class="mb-4">
    {#if $nip11Valid}
        <div class="bg-green-500/70 text-white p-4 rounded-lg">
            <p class="text-lg font-bold">NIP-11 has no issues</p>
        </div>
    {:else}
        <div class="bg-red-500/50 text-white p-4 rounded-lg">
            <p class="text-lg font-bold">NIP-11 requires attention</p>
        </div>

        {#if $validationResult?.result?.errors}
        {#each $validationResult?.result?.errors as result, index}
            <div class="bg-red-500/70 p-4 rounded-lg mt-4">
                <p class="text-sm">#{index+1}: {result.message}</p>
            </div>
        {/each}
        {/if}
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
{:else if $nip11}
    <pre class="py-6 px-8 bg-black/5 dark:bg-white/5 rounded-lg">{JSON.stringify($nip11?.json, null, 4)}</pre>
{:else}
no nip11?
{/if}

