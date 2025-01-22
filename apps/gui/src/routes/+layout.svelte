<script lang="ts">
  import '../app.css';
  import process from 'process/browser';

  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { doBootstrap } from '$lib/stores/routines.js';
  
  import Header from '$lib/components/layout/Header.svelte';
  import { instance, bootstrap, seedFromCache } from '$lib/utils/lifecycle';
  import { writable, type Writable, get } from 'svelte/store';
  import { navigating } from '$app/stores';
  import type Route66 from '@nostrwatch/route66';
  import { destroy } from '$lib/utils/lifecycle';
  import { createTabLifecycle } from '$lib/utils/tab-lifecycle';
  import { delay } from '@nostrwatch/utils';
  import { getBrowserInfo } from '$lib/utils/compat.js';
  import { StateManager } from '@nostrwatch/route66';
  import { unsupported, appState, tabState, type TabStateType } from '$lib/stores/app';
  import { IdleDetector } from '$lib/utils/idle.js';
  import Debugger from '$lib/components/partials/Debugger.svelte';
  import { isIdle } from '$lib/stores/app';
	import { resetStores } from '$lib/stores/memory-relays/routines';

  window.process = process;

  const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  
  let isReady = false;
  let busy = false;
  
  const lifecycle = createTabLifecycle();
  let idleDetector: IdleDetector | null = null;
  let route66: Route66;

  const isDebuggerVisible = writable(false); // Store for debugger visibility

  function handleIdle() {
    console.log('User is idle. Performing idle actions...');
    setTabState('idle');
    isIdle.set(true);
    lifecycle.releaseLeadership();
  }
  
  async function handleActive() {
    try {
      console.log('User is active again.');
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
  
  lifecycle.onStartLeader(async () => {
    console.log('[Lifecycle] onStartLeader triggered');
    if (get(unsupported)) return;
    setTabState('leader');
    try {
      await boot(); 
      console.log('Leader tab: DB initialized.');
    } catch (error) {
      console.error('[Lifecycle] Error in onStartLeader:', error);
    }
  });
  
  lifecycle.onLeaderAcquired(async () => {
    console.log('Non-leader tab: Just became leader, initializing DB.');
    if (get(unsupported)) return;
    setTabState('leader');
    try {
      await boot(); 
      seedFromCache()
      console.log('Leader tab: DB initialized.');
    } catch (error) {
      console.error('[Lifecycle] Error in onLeaderAcquired:', error);
    }
  });
  
  lifecycle.onReleaseLeader(async () => {
    console.log('[Lifecycle] onReleaseLeader triggered'); 
    try {
      route66 = await instance();
      await route66.ready();
      await route66.shutdown();
      await delay(1000);
      destroy();
      console.log("Leader tab: Released.");
      setTabState('follower');
    } catch (error) {
      console.error('[Lifecycle] Error in onReleaseLeader:', error);
      setTabState('follower'); 
    }
  });
  
  lifecycle.onWaitForLeaderRelease(() => {
    console.log('Non-leader tab: Waiting for DB to be released by leader...');
  });
  
  let unsubs: (() => any)[] = [];
  
  const appStateUnsub = tabState.subscribe(value => {
    if (value !== undefined) {
      if (!isReady) isReady = true;
    }
  });
  
  unsubs.push(appStateUnsub);
  
  const unsubscribe = () => {
    unsubs.forEach(unsub => unsub());
    if (idleDetector) {
      idleDetector.destroy();
      idleDetector = null;
      console.log('IdleDetector destroyed on component cleanup.');
    }
  };
  
  async function boot() {
    appState.set('booting');
    // (await instance()).monitorService.ensureMonitorsActive();
    if (!get(doBootstrap)) {
      try {
        await seedFromCache();
        appState.set('running');
        console.log('Data seeded from cache.');
      } catch (error) {
        console.error('Error seeding from cache:', error);
      }
    } else if (!busy) {
      busy = true;
      try {
        await bootstrap();
        appState.set('running');
        console.log('Bootstrap completed.');
      } catch (error) {
        console.error('Error during bootstrap:', error);
      } finally {
        busy = false;
      }
    }
  }
  
  function checkSupport() {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(userAgent);
    const browserInfo = getBrowserInfo();
    // const isSafari = browserInfo?.name.toLowerCase().includes('safari');
  
    if (isMobile) {
      unsupported.set(true);
  
      if (isMobile && $page.url.pathname !== '/mobile') {
        goto('/mobile'); 
      }
    // } else if (isSafari) {
    //   unsupported.set(true);
  
    //   if (isSafari && $page.url.pathname !== '/unsupported') {
    //     goto('/unsupported');
    //   }
    } else {
      unsupported.set(false);
    }
  }

  onMount(() => {
    checkSupport();
  
    if (get(unsupported)) return;
    
    const version = StateManager.get('version');
    if (!version || version !== 2) {
      console.warn('Clearing LocalStorage from nostrwatch legacy');
      StateManager.clear();
      StateManager.set('version', 2);  
    }
  
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  
    if (typeof get(doBootstrap) === 'undefined') {
      doBootstrap.set(true);
    }
  
    if (!idleDetector) {
      idleDetector = new IdleDetector({
        idleTimeoutMs: IDLE_TIMEOUT_MS,
        onIdle: handleIdle,
        onActive: handleActive,
      });
      console.log('IdleDetector initialized.');
    }
  
    const toggleDebugger = (event: KeyboardEvent) => {
      if (event.key === 'd') {
        isDebuggerVisible.update(visible => !visible);
      }
    };
    window.addEventListener('keydown', toggleDebugger);

    lifecycle.acquireLeadership();

    return () => {
      window.removeEventListener('keydown', toggleDebugger);
    };
  });
  
  onDestroy(() => {
    unsubscribe();
    resetStores();
    console.log('Component destroyed. Cleaned up subscriptions and resources.');
  });
  
  $: if (navigating) {
    console.log('Navigation detected. Rechecking support and loading data.');
    checkSupport();
    boot();
  };

  function setTabState(newState: TabStateType) {
    if($tabState === newState) return;
    tabState.update(current => {
      console.log(`TabState changing from ${current} to ${newState}`);
      return newState;
    });
  }
</script>

{#if $isDebuggerVisible}
  <Debugger />
{/if}

{#if isReady}
  {#if $tabState === 'idle'}
    <!-- Idle State -->
    <div class="flex flex-col items-center justify-center h-screen px-4">
      <div class="text-2xl">Zzz</div>
    </div>
  {:else if $tabState === 'leader' || $unsupported}
    <!-- Leader State -->
    <Header />
    <div id="content-wrapper" class="mt-16 block">
      <slot />
    </div>
  {:else if $tabState === 'follower'}
    <!-- Follower State -->
    <div class="flex flex-col items-center justify-center h-screen px-4">
      <div class="text-2xl">Another Session Detected</div>
      <div class="text-lg text-center">Please wait while the existing session is terminated.</div>
    </div>
  {:else if $tabState === 'unsupported'}
    <!-- Unsupported State handled by navigation -->
  {/if}
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
