<svelte:head>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/svelte-material-ui@7.0.0/bare.min.css" />
</svelte:head>

<script lang="ts">
    import { setContext } from "svelte"
    import "../app.pcss";
    import { EventEmitter } from "tseep";
    import NDK from "@nostr-dev-kit/ndk-svelte"
    import { NDK_CONTEXT, SIGNAL_CONTEXT, PROFILES_CONTEXT } from "$lib/contextKeys"
    import { monitorsStore, preferencesStore } from "$lib/stores"
    import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie"
    import NDKSvelte from "@nostr-dev-kit/ndk-svelte"

    const {explicitRelayUrls} = $preferencesStore
    console.log('ndk init');

    // const cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'ndk' });
    const ndk: NDKSvelte = new NDKSvelte({ explicitRelayUrls });
    const signal: EventEmitter = new EventEmitter();
    
    let monitors;

    monitorsStore.subscribe( _monitors => {
        monitors = _monitors
    })

    const profiles = ndk.storeSubscribe(
      { kinds: [0], authors: Array.from(monitors.values()).map(monitor => monitor.pubkey )},
      { closeOnEose: false } 
    );

    profiles.subscribe( (profiles) => {
      console.log('profiles', profiles)
      console.log('monitors', Array.from(monitors.values()))
    })

    setContext(SIGNAL_CONTEXT, signal);
    setContext(NDK_CONTEXT, ndk);
    setContext(PROFILES_CONTEXT, profiles);

    ndk.connect().then( () => {
        signal.emit('ndk:connected') 
    });
</script>
<slot></slot>