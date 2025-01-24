<script lang="ts">
  import '../app.css';
  import process from 'process/browser';

  import { page, navigating } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { doBootstrap } from '$lib/stores/routines.js';
  
  import Header from '$lib/components/layout/Header.svelte';
  import { instance, bootstrap, seedFromCache } from '$lib/utils/lifecycle';
  import { writable, type Writable, get } from 'svelte/store';
  import { StateManager } from '@nostrwatch/route66';
  import { destroy } from '$lib/utils/lifecycle';
  import { createTabLifecycle } from '$lib/utils/tab-lifecycle';
  import { delay } from '@nostrwatch/utils';
  import { getBrowserInfo } from '$lib/utils/compat.js';
  import { unsupported, appState, tabState, type TabStateType, isIdle } from '$lib/stores/app';
  import { IdleDetector } from '$lib/utils/idle.js';
  import Debugger from '$lib/components/partials/Debugger.svelte';
	import { resetStores } from '$lib/stores/memory-relays/routines';

  window.process = process;

  const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

  let isReady = false;
  let busy = false;

  const lifecycle = createTabLifecycle();
  let idleDetector: IdleDetector | null = null;
  let route66: any; // type Route66 if you import from your library

  const isDebuggerVisible = writable(false);

  // --------------------------------------------------------------------------------
  // Utility to change tabState using store.get instead of $tabState in TS context
  // --------------------------------------------------------------------------------
  function setTabState(newState: TabStateType) {
    if (get(tabState) === newState) return;
    tabState.update(current => {
      // console.log(`TabState changing from ${current} to ${newState}`);
      return newState;
    });
  }

  // --------------------------------------------------------------------------------
  // Idle Logic
  // --------------------------------------------------------------------------------
  function handleIdle() {
    // console.log('User is idle. Performing idle actions...');
    setTabState('idle');
    isIdle.set(true);
    lifecycle.releaseLeadership();
  }

  async function handleActive() {
    try {
      // console.log('User is active again.');
      setTabState('follower');
      // Attempt to acquire leadership again:
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
    // console.log('[Lifecycle] onStartLeader triggered');
    if (get(unsupported)) return;
    setTabState('leader');
    try {
      await boot(); 
    } catch (error) {
      console.error('[Lifecycle] Error in onStartLeader:', error);
    }
  });

  lifecycle.onLeaderAcquired(async () => {
    // console.log('Non-leader tab: Just became leader...');
    if (get(unsupported)) return;
    setTabState('leader');
    try {
      await boot(); 
      seedFromCache();
    } catch (error) {
      console.error('[Lifecycle] Error in onLeaderAcquired:', error);
    }
  });

  lifecycle.onReleaseLeader(async () => {
    // console.log('[Lifecycle] onReleaseLeader triggered'); 
    try {
      route66 = await instance();
      await route66.ready();
      await route66.shutdown();
      await delay(1000);
      destroy();
      setTabState('follower');
    } catch (error) {
      console.error('[Lifecycle] Error in onReleaseLeader:', error);
      setTabState('follower'); 
    }
  });

  lifecycle.onWaitForLeaderRelease(() => {
    // console.log('Non-leader tab: Waiting for DB to be released...');
  });

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
      // console.log('IdleDetector destroyed on component cleanup.');
    }
  }

  // --------------------------------------------------------------------------------
  // Boot function (with concurrency & unsupported check)
  // --------------------------------------------------------------------------------
  async function boot() {
    // If we're unsupported or already running busy logic, do nothing
    if (get(unsupported)) return;

    appState.set('booting');

    // If we've already booted once (cached DB, etc.), skip direct bootstrap
    if (!get(doBootstrap)) {
      try {
        route66 = await instance();
        await route66.ready();
        route66?.services?.monitors?.ensureMonitorsActive();
        await seedFromCache();
        appState.set('running');
      } catch (error) {
        console.error('Error seeding from cache:', error);
      }
    } else if (!busy) {
      // If doBootstrap is true and we're not busy, do a fresh bootstrap
      busy = true;
      try {
        await bootstrap();
        appState.set('running');
      } catch (error) {
        console.error('Error during bootstrap:', error);
      } finally {
        busy = false;
      }
    }
  }

  // --------------------------------------------------------------------------------
  // checkSupport - Mobile = unsupported
  // --------------------------------------------------------------------------------
  function checkSupport() {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(userAgent);
    const browserInfo = getBrowserInfo();

    // If it's mobile, set unsupported -> force /mobile route
    if (isMobile) {
      unsupported.set(true);
      if (isMobile && get(page).url.pathname !== '/mobile') {
        goto('/mobile'); 
      }
    } else {
      // Otherwise mark as supported
      unsupported.set(false);
    }
  }

  // --------------------------------------------------------------------------------
  // onMount logic
  // --------------------------------------------------------------------------------
  onMount(() => {
    checkSupport();
    if (get(unsupported)) return;

    // Version check for localStorage
    const version = StateManager.get('version');
    if (!version || version !== 2) {
      console.warn('Clearing LocalStorage from nostrwatch legacy');
      StateManager.clear();
      StateManager.set('version', 2);  
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    // If doBootstrap is not yet set
    if (typeof get(doBootstrap) === 'undefined') {
      doBootstrap.set(true);
    }

    // Initialize IdleDetector
    if (!idleDetector) {
      idleDetector = new IdleDetector({
        idleTimeoutMs: IDLE_TIMEOUT_MS,
        onIdle: handleIdle,
        onActive: handleActive,
      });
      // console.log('IdleDetector initialized.');
    }

    // Debugger toggle with "d" key
    const toggleDebugger = (event: KeyboardEvent) => {
      if (event.key === 'd') {
        isDebuggerVisible.update(visible => !visible);
      }
    };
    window.addEventListener('keydown', toggleDebugger);

    // Attempt to acquire leadership
    lifecycle.acquireLeadership();

    return () => {
      window.removeEventListener('keydown', toggleDebugger);
    };
  });

  // --------------------------------------------------------------------------------
  // onDestroy logic
  // --------------------------------------------------------------------------------
  onDestroy(() => {
    unsubscribe();
    resetStores();
    // console.log('Component destroyed. Cleaned up subscriptions and resources.');
  });

  // --------------------------------------------------------------------------------
  // React to navigation - but only if not unsupported
  // Use $navigating to get the actual store value
  // --------------------------------------------------------------------------------
  $: if ($navigating) {
    // console.log('Navigation detected. Rechecking support and loading data.');
    checkSupport();
    if (!get(unsupported) && !busy) {
      boot();
    }
  }
</script>

{#if $unsupported}
  <slot />
{:else}
  {#if isReady}
    {#if $tabState === 'idle'}
      <div class="flex flex-col items-center justify-center h-screen px-4">
        <div class="text-2xl">Zzz</div>
      </div>
    {:else if $tabState === 'leader'}
      <Header />
      <div id="content-wrapper" class="mt-16 block">
        <slot />
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
  :root {
    --scrollbar-primary: black;
    --scrollbar-secondary: rgba(255,255,255,0.2);
  }
  
  body {
    @apply pb-10;
  }
  
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-secondary) var(--scrollbar-primary);
  }
  
  *::-webkit-scrollbar {
    width: 15px;
  }
  
  *::-webkit-scrollbar-track {
    background: var(--scrollbar-primary);
    border-radius: 5px;
  }
  
  *::-webkit-scrollbar-thumb {
    background-color: var(--scrollbar-secondary);
    border-radius: 14px;
    border: 3px solid var(--scrollbar-primary);
  }
</style>
