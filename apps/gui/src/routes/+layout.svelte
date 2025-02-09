<script lang="ts">
  import '../app.css';
  import process from 'process/browser';

  import 'nostr-zap'

  import { page, navigating } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { writable, type Writable, get } from 'svelte/store';
  import { doBootstrap } from '$lib/stores/routines.js';

  import Header from '$lib/components/layout/Header.svelte';
  import { instance, destroy } from '$lib/utils/lifecycle';
  import { delay } from '@nostrwatch/utils';
  
  import Debugger from '$lib/components/partials/Debugger.svelte';
	import { resetStores } from '$lib/stores/memory-relays/routines';
	import { userService } from '$lib/stores/services';
	import { UserService } from '$lib/services/UserService';
	
	import { totalMonitors } from '$stores/events';
	import ActivityList from '$lib/components/partials/ActivityList.svelte';
	import { dataRegister, dataRegisterInit } from '$stores/data-register';

  import { ActivityManager } from '$lib/managers/ActivityManager';

  import { 
    type TabStateType, 
    unsupported, 
    appState, 
    tabState, 
    hasBeenBootstrapped, 
  } from '$lib/stores/app';

  window.process = process;

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    addEventListener('load', function () {
      navigator.serviceWorker.register('$src/service-workers/cors.js'); 
    });
  }

  const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

  let isReady = false;

  const isDebuggerVisible = writable(false);

  const toggleDebugger = (event: KeyboardEvent) => {
    if (event.key === 'd') {
      isDebuggerVisible.update(visible => !visible);
    }
  };
  window.addEventListener('keydown', toggleDebugger);

  const shutdown = async () => {
    console.log('Shutdown...');
    try {
      const route66 = await instance();
      await route66.ready();
      await route66.shutdown();
      await delay(1000);
      destroy();
      setTabState('follower');
    } catch (error) {
      console.error('[Lifecycle] Error in onReleaseLeader:', error);
      setTabState('follower');
    }
  }

  function setTabState(newState: TabStateType) {
    if (get(tabState) === newState) return;
    tabState.update(() => newState);
    console.log(`Tab state updated to: ${newState}`);
  }

  let unsubs: (() => void)[] = [];

  const appStateUnsub = tabState.subscribe(value => {
    if (value !== undefined) {
      if (!isReady) isReady = true;
    }
  });
  unsubs.push(appStateUnsub);

  function unsubscribe() {
    unsubs.forEach(unsub => unsub());
  }

  // --------------------------------------------------------------------------------
  // Boot function (with concurrency & unsupported check)
  // --------------------------------------------------------------------------------
  async function boot() {
    if (get(unsupported)) return;
    console.log('Booting...');
    appState.set('booting');
    await initServices();
    appState.set('running');
    const route66 = await instance();
    await route66.ready();
    dataRegisterInit();
    await $dataRegister.require([
      'sync:cache',
      'sync:all',
      'validate:nip11s'
    ])
  }

  const initServices = async () => {
    userService.set(new UserService((await instance()).adapters));
  };

  // --------------------------------------------------------------------------------
  // checkSupport - Mobile = unsupported
  // --------------------------------------------------------------------------------
  function checkSupport() {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(userAgent);

    if (isMobile) {
      unsupported.set(true);
      if (isMobile && get(page).url.pathname !== '/mobile') {
        goto('/mobile');
      }
    } else {
      unsupported.set(false);
    }
  }

  // --------------------------------------------------------------------------------
  // onMount logic
  // --------------------------------------------------------------------------------
  let activityManager: ActivityStateManager;

  onMount(() => {
    checkSupport();
    if (get(unsupported)) return;

    if (typeof get(doBootstrap) === 'undefined') {
      doBootstrap.set(true);
    }

    activityManager = new ActivityManager(IDLE_TIMEOUT_MS);

    activityManager.on('active', async () => {
      await boot();
    });

    activityManager.on('inactive', async () => {
      await shutdown();
    });

    return () => {
      activityManager.destroy();
    };
  });

  onDestroy(() => {
    console.log('DESTROY')
    unsubscribe();
    resetStores();
  });

  $: loadedEnough = hasBeenBootstrapped() || $totalMonitors > 1
</script>



{#if $unsupported}
  <div>
    <h1>Unsupported Device</h1>
    <p>Please switch to a supported device.</p>
  </div>
{:else}
  {#if isReady}
    {#if $tabState === 'leader'}
      {#if loadedEnough}
      <Header />
      <div id="content-wrapper" class="block">
        <slot />
      </div>
      {:else}
      <div class="flex flex-col items-center justify-center h-screen relative z-[100]">
        <ActivityList />
      </div>
      {/if}
    {:else}
    <div class="flex flex-col items-center justify-center h-screen px-4">
      <div class="text-7xl">booting.</div>
      <div class="text-xs opacity-30">[{$tabState}]</div>
    </div>
    {/if}
  {/if}
{/if}

{#if $isDebuggerVisible}
  <Debugger />
{/if}

<style global>
  body {
    margin: 0;
    padding: 0;
  }
</style>
