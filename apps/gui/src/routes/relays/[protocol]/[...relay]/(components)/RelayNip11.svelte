<script lang="ts">
    import { Nip11 } from '@nostrwatch/route66/models';
	import { onMount } from 'svelte';
	import { derived, writable, type Readable, type Writable } from 'svelte/store';
    import { SchemaValidationService, type SchemaValidationServiceResponse } from '$lib/services/SchemaValidationService';
	import { setRelayError } from '$lib/stores/relay-errors';
	import JsonHighlighter from '$lib/components/partials/JsonHighlighter.svelte';
	import { relayNip11$ } from '$stores/helpers/helpers-nip11s';
	import { get } from 'lodash';

    const relayUrl = generateRelayUrlFromPath()

    const nip11: Writable<Nip11> = relayNip11$(relayUrl);

    const schemaValidationService = new SchemaValidationService();

    const validationResult: Writable<SchemaValidationServiceResponse | null> = writable(null);

    const nip11Valid: Readable<boolean> = derived(validationResult, $validationResult => {
        return $validationResult?.status === 'success' && $validationResult?.result?.valid === true;
    });

    // Add derived store for warnings
    const nip11Warnings: Readable<boolean> = derived(validationResult, $validationResult => {
        return Array.isArray($validationResult?.result?.warnings) && $validationResult?.result?.warnings.length > 0;
    });

    onMount(() => {
        schemaValidationService.validateNip11($nip11?.json, $nip11?.hash).then( (result: SchemaValidationServiceResponse) => {
            validationResult.set(result);
            for (const error of result.result.errors) {
                setRelayError(relayUrl, 'schema', 'nip11', error.message);
            }
        })
    });
</script>

{#if $nip11 && $validationResult} 
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

    <!-- Add warning banner for additional properties -->
    {#if $nip11Warnings && $nip11Valid}
        <div class="bg-gray-400/70 text-white p-4 rounded-lg mt-4">
            <p class="text-lg font-bold">NIP-11 object contains additional properties (not errors)</p>
        </div>
    {/if}
    </div>
{/if}

{#if $nip11 && $validationResult} 
    <JsonHighlighter
    jsonString={JSON.stringify($nip11?.json, null, 4)}
    ajvResult={$validationResult}
    />
{:else if $nip11}
    <pre class="py-6 px-8 bg-black/5 dark:bg-white/5 rounded-lg">{JSON.stringify($nip11?.json, null, 4)}</pre>

{:else}
no nip11?
{/if}
