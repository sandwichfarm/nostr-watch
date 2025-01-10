<script lang="ts">
    import { Nip11 } from '@nostrwatch/nip66/models';
	import { onMount } from 'svelte';
	import { derived, writable, type Readable, type Writable } from 'svelte/store';
    import { SchemaValidationService, type SchemaValidationServiceResponse } from '$lib/services/SchemaValidationService';
	import { setRelayError } from '$lib/stores/relay-errors';

    export let nip11: Writable<Nip11>
    export let relay: string;

    const schemaValidationService = new SchemaValidationService();

    const validationResult: Writable<SchemaValidationServiceResponse | null> = writable(null);

    const nip11Valid: Readable<boolean> = derived(validationResult, $validationResult => {
        return $validationResult?.status === 'success' && $validationResult?.result?.valid === true;
    });

    onMount(() => {
        schemaValidationService.validateNip11($nip11?.json, $nip11?.hash).then( (result: SchemaValidationServiceResponse) => {
            validationResult.set(result);
            for (const error of result.result.errors) {
                setRelayError(relay, 'schema', 'nip11', error.message);
            }
        })
    });
</script>

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


{#if $validationResult} 
    <pre class="py-6 px-8 bg-white/5 rounded-lg">{JSON.stringify($validationResult, null, 4)}</pre>
{/if}

<pre class="py-6 px-8 bg-white/5 rounded-lg">{JSON.stringify($nip11?.json, null, 4)}</pre>