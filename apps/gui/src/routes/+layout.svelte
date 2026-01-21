<script lang="ts">
  import '../app.css';
  import process from 'process/browser';

  import 'nostr-zap'

  import { page, navigating } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { writable, type Writable, get } from 'svelte/store';
  import { loadModules, type ModuleKey, type Modules, moduleLoaders } from './layout.modules.js';
  import { startLeaderTabRpcServer, stopLeaderTabRpcServer } from '$lib/runtime/leader-tab-server';

  import { type ActivityItem } from '$lib/stores/activity.js';
  import { doBootstrap } from '$lib/stores/routines.js';
  import { 
    type TabStateType, 
    unsupported, 
    appState, 
    tabState, 
    hasBeenBootstrapped, 
  } from '$lib/stores/app';
	import BootstrapLoading from './(components)/BootstrapLoading.svelte';


  let modules: Record<ModuleKey, any> | null = null;
  let progressList: ModuleKey[] = [];

  let Header: Modules['Header'];
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
      console.log("Service workers unregistered");
    }).catch(error => {
      console.error("Error unregistering service workers:", error);
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
    } catch (error) {
      console.error('[Lifecycle] Error during shutdown:', error);
      destroy();
    }
  };

  // --------------------------------------------------------------------------------
  // Boot function (with concurrency & unsupported check)
  // --------------------------------------------------------------------------------
  async function boot() {
    console.log('Booting...');
    if (get(unsupported)) return;
    
    appState.set('booting');
    await initServices();
    appState.set('running');
    const route66 = await instance();
    await route66.ready();
    dataRegisterInit();
    const datas: string[] = ['sync:cache'];
    if (get(tabState) === 'leader') {
      datas.push(hasBeenBootstrapped() ? 'sync:all' : 'sync:all-force');
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
    modules = await loadModules((key, mod) => {
      progressList = [...progressList, key];
      console.log(`Module loaded: ${key}`);
    });
    ({lifecycle} = modules.lifecycle);
    ({ instance, destroy } = modules.lifecycle);
    ({ Header, Debugger, ActivityList } = modules);
    ({ userService } = modules.services);
    ({ resetStores } = modules.routines);
    ({ totalMonitors } = modules.events);
    ({ dataRegister } = modules.dataRegister);
    ({ delay } = modules.utils);
    ({ ActivityManager } = modules.ActivityManager);
    ({ UserService } = modules.UserService);
    ({ dataRegisterInit } = modules.dataRegister);
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

    checkSupport();
    if (get(unsupported)) return;

    if (typeof get(doBootstrap) === 'undefined') {
      doBootstrap.set(true);
    }

    activityManager = new ActivityManager(IDLE_TIMEOUT_MS);

    // Give the ActivityManager a tick to claim/follow leadership before boot.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Leader-tab runtime RPC server (only runs in the elected leader tab).
    if (get(tabState) === 'leader') startLeaderTabRpcServer(leaderRpcOptions);
    else stopLeaderTabRpcServer();

    lastRole = get(tabState);
    await runBoot();

    // React to leader/follower role changes after initial boot.
    unsubscribeTabState = tabState.subscribe(async (role) => {
      if (!role || role === lastRole) return;

      if (role === 'leader') startLeaderTabRpcServer(leaderRpcOptions);
      else stopLeaderTabRpcServer();

      // If we were the leader and got demoted, release heavy resources.
      if (lastRole === 'leader' && role === 'follower') {
        await shutdown();
      }

      if (role === 'leader' || role === 'follower') {
        await runBoot();
      }

      lastRole = role;
    });

    isReady = true;
  });

  onDestroy(() => {
    console.log('DESTROY')
    stopLeaderTabRpcServer();
    resetStores();
    unsubscribeTabState?.();
    activityManager?.destroy?.();
  });



  let activities: ActivityItem[] = [];

  $: loadedEnough = hasBeenBootstrapped() || $totalMonitors > 1

  // $: {
  //   console.log(progressList.length, Object.keys(modules || {}).length, `progressList.length / Object.keys(modules || {}).length`, progressList.length / Object.keys(modules || {}).length)
  // }

  $: percentModulesLoaded = Math.round((progressList.length / Object.keys(moduleLoaders || {}).length) * 100);
  $: numMonitorsSynced = 
      activities
        .filter( item =>
          item.slug === "monitors/bootstrap/registrations"
          || item.slug === "monitors/bootstrap/meta"
          || item.slug === "monitors/bootstrap/ensureActive"
        )
        .filter( item => item.complete )
        .length
  $: numRelayChecksSynced = 
      activities
        .filter( item =>
          item.slug === "monitors/bootstrap/checks"
        )
        .filter( item => item.complete )
        .length
  $: monitorsSynced = numMonitorsSynced === 3;
  $: relayChecksSynced = loadedEnough
  $: percentCompleted = percentModulesLoaded * 0.5 + (numMonitorsSynced*10) + (relayChecksSynced? 20: 0);

  let loadingThresholdPassed = false;
  let loadingThresholdTimeout: ReturnType<typeof setTimeout>;

  $: {
    if($navigating?.to){
      console.log('navigating to:', $navigating.to)
      clearTimeout(loadingThresholdTimeout)
      loadingThresholdPassed = false
    }
    if($navigating?.from){
      console.log('navigating from:', $navigating.from)
      loadingThresholdTimeout = setTimeout(() => loadingThresholdPassed = true, 1000 )
    }
  }

  setTimeout(() => loadingThresholdPassed = true, 1000 )

  let loadedEnoughSignal = false;

  $: {
    if(loadedEnough){
      setTimeout(() => { 
        console.log('loaded enough.')
        loadedEnoughSignal = true;
      }, 1000);
    }
  }
  
  $: loading = loadingThresholdPassed && (!isReady || !loadedEnoughSignal);
</script>

{#if $unsupported}
<div class="flex flex-col items-center justify-center h-screen px-4">
  <div class="text-3xl">Unsupported</div>
  <div class="text-xs opacity-30">This version of nostr.watch does not support mobile devices.</div>
</div>
{:else}
  {#if loading && !hasBeenBootstrapped()}
    <BootstrapLoading {isReady} {monitorsSynced} {relayChecksSynced} {percentCompleted} bind:activities />
  {:else if loading && hasBeenBootstrapped()}
    <div class="flex flex-col items-center justify-center h-screen px-4">
      <div class="text-7xl">loading.</div>
      <div class="text-xs opacity-30">[{$tabState}]</div>
    </div>
  {:else if isReady}
    {#if $tabState === 'leader' || $tabState === 'follower'}
      {#if loadedEnoughSignal}
        <Header />
        <div id="content-wrapper" class="block">
          <slot />
        </div>
      {/if}
    {:else}
      <div class="flex flex-col items-center justify-center h-screen px-4">
        <div class="text-7xl mb-3">booting.</div>
        {#if $tabState}
        <div class="text-xs opacity-30">[{$tabState}]</div>
        {/if}
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
