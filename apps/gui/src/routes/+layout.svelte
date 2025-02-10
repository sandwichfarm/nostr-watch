<script lang="ts">
  import '../app.css';
  import process from 'process/browser';

  import 'nostr-zap'

  import { page, navigating } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { writable, type Writable, get } from 'svelte/store';
  import { loadModules, type ModuleKey, type Modules, moduleLoaders } from './layout.modules.js';

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

  // if (import.meta.env.PROD && 'serviceWorker' in navigator) {
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
      const route66 = await lifecycle.instance();
      await route66.ready();
      await route66.shutdown();
      await delay(1000);
      lifecycle.destroy();
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

  // --------------------------------------------------------------------------------
  // Boot function (with concurrency & unsupported check)
  // --------------------------------------------------------------------------------
  async function boot() {
    console.log('Booting...');
    if (get(unsupported)) return;
    
    appState.set('booting');
    await initServices();
    appState.set('running');
    const route66 = await lifecycle.instance();
    await route66.ready();
    dataRegisterInit();
    const datas = []
    datas.push('sync:cache')
    if(hasBeenBootstrapped()){
      datas.push('sync:all')
    } else {
      datas.push('sync:all-force')
    }
    await get(dataRegister).require(datas)
  }

  const initServices = async () => {
    userService.set(new UserService((await lifecycle.instance()).adapters));
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

    ({ Header, Debugger, ActivityList } = modules);

    lifecycle = modules.lifecycle;
    ({ instance, destroy } = lifecycle);

    ({ userService } = modules.services);
    ({ resetStores } = modules.routines);
    ({ totalMonitors } = modules.events);
    ({ dataRegister } = modules.dataRegister);
    ({ delay } = modules.utils);
    ({ ActivityManager } = modules.ActivityManager);
    ({ UserService } = modules.UserService);
    ({ dataRegisterInit } = modules.dataRegister);

    // if(import.meta.env.DEV){
    //   //similate slow loading
    //   // await delay(1000);
    // }
  };

  let activityManager: Modules['ActivityManager']['ActivityManager'];

  onMount(async () => {
    
    await load();

    checkSupport();
    if (get(unsupported)) return;

    if (typeof get(doBootstrap) === 'undefined') {
      doBootstrap.set(true);
    }

    let justBooted = true;
    await boot();

    activityManager = new ActivityManager(IDLE_TIMEOUT_MS);
    activityManager.on('active', async () => {
      console.log('active.')
      if(justBooted) return;
      boot();
    });
    
    activityManager.on('inactive', async () => {
      if(justBooted) return;
      await shutdown();
    });

    setTimeout( () => {
      justBooted = false;
    }, 1000)
    
    isReady = true;
  });

  onDestroy(() => {
    console.log('DESTROY')
    resetStores();
    activityManager.destroy();
  });



  let activities: ActivityItem[] = [];

  $: loadedEnough = hasBeenBootstrapped() || $totalMonitors > 1

  $: {
    console.log(progressList.length, Object.keys(modules || {}).length, `progressList.length / Object.keys(modules || {}).length`, progressList.length / Object.keys(modules || {}).length)
  }
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
  $: relayChecksSynced = numRelayChecksSynced === 1;
  $: percentCompleted = percentModulesLoaded * 0.5 + (numMonitorsSynced*10) + (relayChecksSynced? 20: 0);

  let loadingThresholdPassed = false;
  setTimeout(() => loadingThresholdPassed = true, 200 )
  $: loading = loadingThresholdPassed && (!isReady || !loadedEnough);
</script>

<!-- loading: {loading} <br />
isReady: {isReady} <br />
loadedEnough: {loadedEnough} <br /> -->


{#if $unsupported}
<div class="flex flex-col items-center justify-center h-screen px-4">
  <div class="text-7xl">Unsupported</div>
  <div class="text-xs opacity-30">This version of nostr.watch does not support mobile devices.</div>
</div>
{:else}
  {#if loading && !hasBeenBootstrapped()}
  <BootstrapLoading {isReady} {monitorsSynced} {relayChecksSynced} {percentCompleted} />
  {:else if loading && hasBeenBootstrapped()}
    <div class="flex flex-col items-center justify-center h-screen px-4">
      <div class="text-7xl">booting.</div>
      <div class="text-xs opacity-30">[{$tabState}]</div>
    </div>
  {/if}
  {#if isReady}
    {#if $tabState === 'leader'}
      {#if loadedEnough}
        <Header />
        <div id="content-wrapper" class="block">
          <slot />
        </div>
      {/if}
    {:else if $tabState === 'follower'}
      <div class="flex flex-col items-center justify-center h-screen px-4">
        <div class="text-7xl mb-3">taking charge</div>
        <div class="text-xl opacity-50">nostr.watch can only run in one tab at a time, shutting down other tab.</div>
        <div class="text-xs opacity-30">[{$tabState}]</div>
      </div>
    {:else if $tabState === 'idle'}
      <div class="flex flex-col items-center justify-center h-screen px-4">
        <div class="text-7xl mb-3">you were sleeping</div>
        <div class="text-xl opacity-50">nostr.watch shutdown while you were gone, restarting</div>
        <div class="text-xs opacity-30">[{$tabState}]</div>
      </div>
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
