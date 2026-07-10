<script lang="ts">
  import '../app.css';
  import process from 'process/browser';

  import 'nostr-zap'

  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { writable, type Writable, get } from 'svelte/store';
  import { loadModules, type ModuleKey, type Modules } from './layout.modules.js';
  import { startLeaderTabRpcServer, stopLeaderTabRpcServer } from '$lib/runtime/leader-tab-server';
  import HeaderComponent from '$lib/components/layout/Header.svelte';
  import MonitorsBanner from '$lib/components/layout/MonitorsBanner.svelte';

	  import { doBootstrap } from '$lib/stores/routines.js';
	  import {
	    type TabStateType,
	    unsupported,
	    appState,
	    tabState,
	    hasBeenBootstrapped,
	    isSeeded,
	    opfsStatus,
	  } from '$lib/stores/app';
	  import { relayCheckAggregates } from '$lib/stores';
	  import { showDebugButton } from '$lib/stores/preferences';
	  import BootstrapLoading from './(components)/BootstrapLoading.svelte';
	  import FollowerLoading from './(components)/FollowerLoading.svelte';
	  import {
	    startBootActivity,
	    completeBootActivity,
	    resetBootActivities,
	  } from '$lib/stores/boot-activity';
	  import { seedBootStatus } from '$lib/stores/boot-state';


  let modules: Record<ModuleKey, any> | null = null;
  let progressList: ModuleKey[] = [];

  let Debugger: Modules['Debugger'];
  let ActivityList: Modules['ActivityList'];

  let lifecycle: Modules['lifecycle'];
  let instance: Modules['lifecycle']['instance'];
  let destroy: Modules['lifecycle']['destroy'];

  let delay: Modules['utils']['delay'];
  let resetStores: Modules['routines']['resetStores'];
  let userService: Modules['services']['userService'];
  let UserService: Modules['UserService']['UserService'];
  let totalMonitors: Modules['events']['totalMonitors'];
  let ActivityManager: Modules['ActivityManager']['ActivityManager'];
  let dataRegister: Modules['dataRegister']['dataRegister'];
  let dataRegisterInit: Modules['dataRegister']['dataRegisterInit'];

  let modulesLoaded: boolean = false;

  window.process = process;
  const DEV = import.meta.env.DEV;

  if(window.isSecureContext === false && "serviceWorker" in navigator && navigator.serviceWorker !== undefined) {
    // if (import.meta.env.PROD) {
    //   addEventListener('load', function () {
    //     navigator.serviceWorker.register('$src/service-workers/cors.js');
    //   });
    // }
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for (let registration of registrations) {
        registration.unregister();
      }
    }).then(() => {
      if (DEV) console.log("Service workers unregistered");
    }).catch(error => {
      console.error("Error unregistering service workers:", error);
    });
  }

  const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

  let isReady = false;

  const isDebuggerVisible = writable(false);

  const toggleDebugger = (event: KeyboardEvent) => {
    // Alt+D to toggle debugger (on macOS Alt+D produces '∂')
    if (event.altKey && (event.key === 'd' || event.key === 'D' || event.key === '∂' || event.code === 'KeyD')) {
      event.preventDefault();
      isDebuggerVisible.update(visible => !visible);
    }
  };

  const shutdown = async () => {
    if (DEV) console.log('Shutdown...');
    try {
      const route66 = await instance();
      await route66.ready();
      await route66.shutdown();
      await delay(1000);
      await destroy();
    } catch (error) {
      console.error('[Lifecycle] Error during shutdown:', error);
      await destroy();
    }
  };

  // --------------------------------------------------------------------------------
  // Boot function (with concurrency & unsupported check)
  // --------------------------------------------------------------------------------
  async function boot() {
    if (DEV) console.log('Booting...');
    if (get(unsupported)) return;

    // startBootActivity('init', 'Initialization');
    appState.set('booting');
    await initServices();
    appState.set('running');
    const route66 = await instance();
    await route66.ready();
    // completeBootActivity('init');

	    dataRegisterInit();
	    const datas: string[] = ['sync:cache'];
	    if (get(tabState) === 'leader') {
	      const opfs = get(opfsStatus);
	      const forceFullSync = opfs === 'fallback' || opfs === 'error';
	      datas.push(forceFullSync ? 'sync:all-force' : hasBeenBootstrapped() ? 'sync:all' : 'sync:all-force');
	    }
	    void get(dataRegister)
	      .require(datas)
	      .catch((err) => console.error('[DataRegister] require failed', err));
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

  const load = async () => {
    // Reset and start tracking asset loading
    resetBootActivities();
    startBootActivity('assets', 'Assets');

    modules = await loadModules((key, mod) => {
      progressList = [...progressList, key];
      if (DEV) console.log(`Module loaded: ${key}`);
    });
    ({lifecycle} = modules.lifecycle);
    ({ instance, destroy } = modules.lifecycle);
    ({ Debugger, ActivityList } = modules);
    ({ userService } = modules.services);
    ({ resetStores } = modules.routines);
    ({ totalMonitors } = modules.events);
    ({ dataRegister } = modules.dataRegister);
    ({ delay } = modules.utils);
    ({ ActivityManager } = modules.ActivityManager);
    ({ UserService } = modules.UserService);
    ({ dataRegisterInit } = modules.dataRegister);

    completeBootActivity('assets');
  };

  let activityManager: any;
  let unsubscribeTabState: (() => void) | null = null;
  let lastRole: TabStateType | null = null;
  let bootInFlight: Promise<void> | null = null;
  const leaderRpcOptions = {
    isLeader: () => get(tabState) === 'leader',
    getRoute66: async () => await instance(),
  };

  const runBoot = async () => {
    if (bootInFlight) return bootInFlight;
    bootInFlight = boot().finally(() => {
      bootInFlight = null;
    });
    return bootInFlight;
  };

  onMount(async () => {

    await load();

    window.addEventListener('keydown', toggleDebugger);

    checkSupport();
    if (get(unsupported)) return;

    if (typeof get(doBootstrap) === 'undefined') {
      doBootstrap.set(true);
    }

    activityManager = new ActivityManager(IDLE_TIMEOUT_MS);

    lastRole = get(tabState);

    // React to leader/follower role changes immediately (even during boot),
    // so follower tabs don't time out waiting for a leader RPC server.
    unsubscribeTabState = tabState.subscribe(async (role) => {
      if (!role || role === lastRole) return;

      if (role === 'leader') startLeaderTabRpcServer(leaderRpcOptions);
      else stopLeaderTabRpcServer();

      // If we were the leader and got demoted, release heavy resources.
      if (lastRole === 'leader' && role === 'follower') {
        await shutdown();
      }

      lastRole = role;

      if (role === 'leader' || role === 'follower') {
        // If boot was running while we changed roles, complete it and then run again
        // so Route66/leader RPC reflects the current leader/follower mode.
        if (bootInFlight) await bootInFlight;
        await runBoot();
      }
    });

    // Leader-tab runtime RPC server (only runs in the elected leader tab).
    if (get(tabState) === 'leader') startLeaderTabRpcServer(leaderRpcOptions);
    else stopLeaderTabRpcServer();

    // Give the ActivityManager a tick to claim/follow leadership before boot.
    await new Promise((resolve) => setTimeout(resolve, 0));

    await runBoot();

    isReady = true;
  });

  onDestroy(() => {
    window.removeEventListener('keydown', toggleDebugger);
    stopLeaderTabRpcServer();
    resetStores();
    unsubscribeTabState?.();
    activityManager?.destroy?.();
  });

  // --------------------------------------------------------------------------------
	  // Render gating
	  // --------------------------------------------------------------------------------
	  $: hasActualData = $relayCheckAggregates?.length > 0;
	  $: seedInProgress = $seedBootStatus === 'in_progress';
	  // "bootloaded" === seed import completed (or no seed payload available).
	  $: seedReady = $isSeeded || $seedBootStatus === 'complete';

	  // Fresh state: no prior bootstrap markers AND no seed marker.
	  // This supports old installs (bootstrapped pre-seed) without forcing seed boot UI.
	  $: isFreshState = !hasBeenBootstrapped() && !$isSeeded;

	  $: loadedEnough = hasActualData && (!isFreshState || seedReady);

	  // Bootloader = build-seed import (first run / after reset).
	  $: needsSeedBootstrap = isFreshState && !seedReady;

	  $: showBootstrapLoading = needsSeedBootstrap && $tabState === 'leader';
	  $: showFollowerWaiting = $tabState === 'follower' && !showContent;

	  // Seed import is only an accelerator. Do not enter the app until
	  // runtime bootstrap has produced actual relay-check aggregates.
	  $: showContent = isReady && loadedEnough && !seedInProgress;
</script>

{#if $unsupported}
<div class="flex flex-col items-center justify-center h-screen px-4">
  <div class="text-3xl">Unsupported</div>
  <div class="text-xs opacity-30">This version of nostr.watch does not support mobile devices.</div>
</div>
{:else}
	  {#if showBootstrapLoading}
	    <BootstrapLoading {isReady} />
	  {:else if showFollowerWaiting}
	    <FollowerLoading />
	  {:else if showContent}
	    <HeaderComponent navDisabled={false} />
	    <MonitorsBanner />
	    <div id="content-wrapper" class="block flow-root">
	      <slot />
	    </div>
	  {:else}
	    <div class="flex flex-col items-center justify-center h-screen px-4">
	      <div class="text-7xl mb-3">booting.</div>
	    </div>
	  {/if}
{/if}

{#if $showDebugButton}
  <button
    type="button"
    on:click={() => isDebuggerVisible.update(v => !v)}
    class="fixed bottom-4 right-4 z-[9998] p-3 rounded-full bg-muted hover:bg-muted/80 border border-border shadow-lg transition-colors"
    title="Toggle debug panel (Alt+D)"
    aria-label="Toggle debug panel"
  >
    <svg class="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 00-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 01.4-2.253M12 8.25a2.25 2.25 0 00-2.248 2.146M12 8.25a2.25 2.25 0 012.248 2.146M8.683 5a6.032 6.032 0 01-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0115.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 00-.575-1.752M4.921 6a24.048 24.048 0 00-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 01-5.223 1.082" />
    </svg>
  </button>
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
