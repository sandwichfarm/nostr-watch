<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { doBootstrap } from '$lib/stores/routines.js';
  
  import Header from '$lib/components/layout/Header.svelte';
  import { instance, bootstrap, seedFromCache } from '$lib/utils/lifecycle';
  import { writable, type Writable, get } from 'svelte/store';
  import { navigating } from '$app/stores';
  import type Nip66 from '@nostrwatch/nip66';
  import { destroy } from '$lib/utils/lifecycle';
  import { createTabLifecycle } from '$lib/utils/tab-lifecycle';
  import { delay } from '@nostrwatch/utils';
  import { getBrowserInfo } from '$lib/utils/compat.js';
  import { StateManager } from '@nostrwatch/nip66';
  import { unsupported } from '$lib/stores/app';
  import { IdleDetector } from '$lib/utils/idle.js';
  
  const IDLE_TIMEOUT_MS = 60 * 1000;
  
  const isLeader: Writable<boolean> = writable(false);
  const isIdle: Writable<boolean> = writable(false);
  
  let isLeaderValue = false;
  let isIdleValue = false;
  let isReady = false;
  
  let busy = false;
  
  const lifecycle = createTabLifecycle();
  
  let idleDetector: IdleDetector | null = null;
  let nip66: Nip66;

  import process from 'process/browser';
  window.process = process;

  
  function handleIdle() {
    //console.log('User is idle. Performing idle actions...');
    isIdle.set(true);
    lifecycle.releaseLeadership();
  }
  
  function handleActive() {
    //console.log('User is active again.');
    isIdle.set(false);
    lifecycle.acquireLeadership();
    idleDetector?.reset?.();
  }
  
  lifecycle.onStartLeader(async () => {
    //console.log('[Lifecycle] onStartLeader triggered');
    isLeader.set(true);
    if (get(unsupported)) return;
    
    try {
      await boot(); 
      //console.log('Leader tab: DB initialized.');
    } catch (error) {
      console.error('[Lifecycle] Error in onStartLeader:', error);
    }
  });
  
  lifecycle.onLeaderAcquired(async () => {
    //console.log('Non-leader tab: Just became leader, initializing DB.');
    isLeader.set(true);
    if (get(unsupported)) return;
    
    try {
      await boot(); 
      //console.log('Leader tab: DB initialized.');
    } catch (error) {
      console.error('[Lifecycle] Error in onLeaderAcquired:', error);
    }
  });
  
  lifecycle.onReleaseLeader(async () => {
    //console.log('[Lifecycle] onReleaseLeader triggered'); 
    try {
      //console.log("Leader tab: Releasing...");
      nip66 = await instance();
      //console.log("Leader tab: awaiting ready...");
      await nip66.ready();
      //console.log("Leader tab: ready, awaiting shutdown...");
      await nip66.shutdown();
      //console.log("Leader tab: shutdown...");
      await delay(1000);
      destroy();
      //console.log("Leader tab: Released.");
      isLeader.set(false);
    } catch (error) {
      console.error('[Lifecycle] Error in onReleaseLeader:', error);
    }
  });
  
  lifecycle.onWaitForLeaderRelease(() => {
    //console.log('Non-leader tab: Waiting for DB to be released by leader...');
  });
  
  let unsubs: (() => any)[] = [];
  
  const isLeaderUnsub = isLeader.subscribe(value => {
    isLeaderValue = value;
    if (isReady === false) {
      isReady = true;
    }
  });
  const isIdleUnsub = isIdle.subscribe(value => {
    isIdleValue = value;
    if (isReady === false) {
      isReady = true;
    }
  });

  unsubs.push(isLeaderUnsub, isIdleUnsub);
  
  const unsubscribe = () => {
    unsubs.forEach(unsub => unsub());
    isLeaderUnsub();
    isIdleUnsub();
    if (idleDetector) {
      idleDetector.destroy();
      idleDetector = null;
      //console.log('IdleDetector destroyed on component cleanup.');
    }
  };
  
  async function boot() {
    if (!get(doBootstrap)) {
      try {
        await seedFromCache();
        //console.log('Data seeded from cache.');
      } catch (error) {
        console.error('Error seeding from cache:', error);
      }
    } else if (!busy) {
      busy = true;
      try {
        await bootstrap();
        //console.log('Bootstrap completed.');
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
    const isSafari = browserInfo?.name.toLowerCase().includes('safari');
  
    unsupported.set(isSafari || isMobile);
  
    if (isMobile && page.url.pathname !== '/mobile') {
      goto('/mobile'); 
    }
  
    if (isSafari && page.url.pathname !== '/unsupported') {
      goto('/unsupported');
    }
  }
  
  onDestroy(() => {
    unsubscribe();
  });
  
  onMount(async () => {
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
      //console.log('IdleDetector initialized on component mount.');
    }
  
    lifecycle.acquireLeadership();
  });
  
  $: if (navigating) {
    //console.log('Navigation detected. Rechecking support and loading data.');
    checkSupport();
    boot();
  };
</script>

{#if isReady}
  {#if isLeaderValue}
    <Header />
    <div id="content-wrapper" class="mt-16 block">
      <slot />
    </div>
  {:else if !isIdleValue}
    <div class="flex flex-col items-center justify-center h-screen px-4">
      <div class="text-2xl">Another Session Detected</div>
      <div class="text-lg text-center">Please wait while the existing session is terminated.</div>
    </div>
  {:else if isIdleValue}
    <div class="flex flex-col items-center justify-center h-screen px-4">
      <div class="text-2xl">Zzz</div>
    </div>
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
