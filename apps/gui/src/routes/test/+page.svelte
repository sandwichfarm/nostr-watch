<script lang="ts">
    import { onMount } from "svelte";
    import { writable, type Writable, type Readable } from "svelte/store";
    
    import { Auditor } from "@nostrwatch/auditor"
	import { doBootstrap } from "$lib/stores/routines";
	import { doAggregateCache } from "$lib/stores/app";
    // import type { Nip11, PubkeyProfile } from "@nostrwatch/nip66/models";
    
    let relayUrl = 'wss://purplepag.es';
    // // export let operatorProfile: Writable<PubkeyProfile | null>;
    let nip11: any = {
        "contact": "pablof7z.com",
        "description": "Nostr's Purple Pages",
        "name": "purplepag.es",
        "pubkey": "fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52",
        "software": "git+https://github.com/hoytech/strfry.git",
        "supported_nips": [
            1,
            2,
            4,
            9,
            11,
            12,
            16,
            20,
            22,
            28,
            33,
            40
        ],
        "version": "0.9.6-7-g7196547"
    }
    
    const results: Writable<any> = writable(null)
    
    const onSuiteStart = ( key: string ) => {
        console.log(`Suite Start: ${key}`)
    }
    
    const onSuiteFinish = ( key: string , result: any ) => {
        console.log(`Suite Finish: ${key}`, result)
    }
    
    const onSuiteTestStart = ( key: string  ) => {
        console.log(`Suite Test Start: ${key}`)
    }
    
    const onSuiteTestFinish = ( key: string , result: any ) => {
        console.log(`Suite Test Finish: ${key}`, result)
    }
    
    onMount(async () => {
        doBootstrap.set(false)
        doAggregateCache.set(false)

        console.log('Starting relay audits...');
        
        const audit = new Auditor();
    
        if (nip11) {
            audit.applySupportedNips(nip11.supported_nips);
        } else {
            console.warn('No nip11 provided; skipping supported NIPs application.');
        }
    
        audit.test(relayUrl).then(results.set);
    
        audit.on('auditor.suite:start', onSuiteStart);
        audit.on('auditor.suite:finish', onSuiteFinish);
        audit.on('auditor.suite.test:start', onSuiteTestStart);
        audit.on('auditor.suite.test:finish', onSuiteTestFinish);
    });
    </script>
    
    audits
    {relayUrl}
    
    <pre>{JSON.stringify($results, null, 4)}</pre>