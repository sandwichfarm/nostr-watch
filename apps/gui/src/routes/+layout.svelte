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
  import { instance, } from '$lib/utils/lifecycle';
  import { destroy } from '$lib/utils/lifecycle';
  import { createTabLifecycle } from '$lib/utils/tab-lifecycle';
  import { delay } from '@nostrwatch/utils';
  import { IdleDetector } from '$lib/utils/idle.js';
  import Debugger from '$lib/components/partials/Debugger.svelte';
	import { resetStores } from '$lib/stores/memory-relays/routines';
	import { userService } from '$lib/stores/services';
	import { UserService } from '$lib/services/UserService';
	
	import { totalMonitors } from '$stores/events';
	import ActivityList from '$lib/components/partials/ActivityList.svelte';
	import { dataRegister, dataRegisterInit } from '$stores/data-register';

  import { 
    type TabStateType, 
    unsupported, 
    appState, 
    tabState, 
    isIdle, 
    hasBeenBootstrapped, 
    isBootstrapped 
  } from '$lib/stores/app';

  window.process = process;

  const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

  let isReady = false;
  let busy = false;

  const lifecycle = createTabLifecycle();
  let idleDetector: IdleDetector | null = null;

  const isDebuggerVisible = writable(false);

  const toggleDebugger = (event: KeyboardEvent) => {
    if (event.key === 'd') {
      isDebuggerVisible.update(visible => !visible);
    }
  };
  window.addEventListener('keydown', toggleDebugger);

  const shutdown = async () => {
    console.log('[Lifecycle] onReleaseLeader triggered.');
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

  // --------------------------------------------------------------------------------
  // Utility to change tabState using store.get instead of $tabState in TS context
  // --------------------------------------------------------------------------------
  function setTabState(newState: TabStateType) {
    if (get(tabState) === newState) return;
    tabState.update(() => newState);
    console.log(`Tab state updated to: ${newState}`);
  }

  // --------------------------------------------------------------------------------
  // Idle Logic
  // --------------------------------------------------------------------------------
  function handleIdle() {
    console.log('User is idle.');
    setTabState('idle');
    isIdle.set(true);
    lifecycle.releaseLeadership();
  }

  async function handleActive() {
    console.log('User is active.');
    try {
      setTabState('follower');
      await lifecycle.acquireLeadership();
      if (get(unsupported)) return;
      setTabState('leader');
      await boot();
      idleDetector?.reset?.();
      isIdle.set(false);
    } catch (error) {
      console.error('Error in handleActive:', error);
      setTabState('follower');
    }
  }

  // --------------------------------------------------------------------------------
  // Lifecycle: Leader events
  // --------------------------------------------------------------------------------
  lifecycle.onStartLeader(async () => {
    console.log('[Lifecycle] onStartLeader triggered.');
    if (get(unsupported)) return;
    setTabState('leader');
    try {
      await boot();
    } catch (error) {
      console.error('[Lifecycle] Error in onStartLeader:', error);
    }
  });

  lifecycle.onLeaderAcquired(async () => {
    console.log('[Lifecycle] onLeaderAcquired triggered.');
    if (get(unsupported)) return;
    setTabState('leader');
    try {
      await boot();
      // seedFromCache();
    } catch (error) {
      console.error('[Lifecycle] Error in onLeaderAcquired:', error);
    }
  });

  lifecycle.onReleaseLeader(shutdown);

  lifecycle.onWaitForLeaderRelease(() => {
    console.log('[Lifecycle] Waiting for leader to release...');
  });

  // lifecycle.onTabInactive(shutdown);

  // --------------------------------------------------------------------------------
  // Subscriptions cleanup
  // --------------------------------------------------------------------------------
  let unsubs: (() => void)[] = [];

  const appStateUnsub = tabState.subscribe(value => {
    if (value !== undefined) {
      if (!isReady) isReady = true;
    }
  });
  unsubs.push(appStateUnsub);

  function unsubscribe() {
    unsubs.forEach(unsub => unsub());
    if (idleDetector) {
      idleDetector.destroy();
      idleDetector = null;
      console.log('IdleDetector destroyed on component cleanup.');
    }
  }

  // --------------------------------------------------------------------------------
  // Boot function (with concurrency & unsupported check)
  // --------------------------------------------------------------------------------
  async function boot() {
    if (get(unsupported)) return;
    appState.set('booting');
    await initServices();
    dataRegisterInit();
    appState.set('running');
    const route66 = await instance();
    await route66.ready();
    await delay(3000)
    await $dataRegister.require([
      'sync:cache',
      'sync:all',
      'validate:nip11s'
    ])
    // if (!get(doBootstrap)) {
    //   try {
    //     route66 = await instance();
    //     await route66.ready();
    //     route66?.services?.monitors?.ensureMonitorsActive();
    //     initServices();
    //     appState.set('running');
    //   } catch (error) {
    //     console.error('Error seeding from cache:', error);
    //   }
    // } else if (!busy) {
    //   busy = true;
    //   try {
    //     await bootstrap();
    //     route66 = await instance();
    //     initServices();
    //     appState.set('running');
    //   } catch (error) {
    //     console.error('Error during bootstrap:', error);
    //   } finally {
    //     busy = false;
    //   }
    // }
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
  // Recover leadership when tab becomes visible again
  // --------------------------------------------------------------------------------
  function recoverLeadershipOnVisibilityChange() {
    if (document.visibilityState === 'visible') {
      console.log('Tab became visible. Attempting to reclaim leadership...');
      lifecycle.acquireLeadership();
    }
  }

  // --------------------------------------------------------------------------------
  // onMount logic
  // --------------------------------------------------------------------------------
  onMount(() => {
    checkSupport();
    if (get(unsupported)) return;

    if (typeof get(doBootstrap) === 'undefined') {
      doBootstrap.set(true);
    }

    if (!idleDetector) {
      idleDetector = new IdleDetector({
        idleTimeoutMs: IDLE_TIMEOUT_MS,
        onIdle: handleIdle,
        onActive: handleActive,
      });
    }

    document.addEventListener('visibilitychange', recoverLeadershipOnVisibilityChange);

    lifecycle.acquireLeadership();

    return () => {
      document.removeEventListener('visibilitychange', recoverLeadershipOnVisibilityChange);
    };
  });

  onDestroy(() => {
    unsubscribe();
    resetStores();
  });

  $: if ($navigating) {
    checkSupport();
    if (!get(unsupported) && !busy) {
      boot();
    }
  }

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
    {:else if $tabState === 'idle'}
      <div class="flex items-center justify-center h-screen">
        <div class="text-2xl">Zzz</div>
      </div>
    {:else if $tabState === 'follower'}
      <div class="flex flex-col items-center justify-center h-screen px-4">
        <div class="text-2xl">Another Session Detected</div>
        <div class="text-lg text-center">Please wait while the existing session is terminated.</div>
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
