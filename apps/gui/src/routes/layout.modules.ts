
export type ModuleKey =
  | 'lifecycle'
  | 'utils'
  | 'Debugger'
  | 'routines'
  | 'services'
  | 'UserService'
  | 'events'
  | 'ActivityList'
  | 'dataRegister'
  | 'ActivityManager';

type ModuleDefinition = {
  loader: () => Promise<any>;
  path: string;
};

export const moduleLoaders: Record<ModuleKey, ModuleDefinition> = {
  lifecycle: {
    loader: () => import('$lib/utils/lifecycle'),
    path: '$lib/utils/lifecycle'
  },
  utils: {
    loader: () => import('@nostrwatch/utils'),
    path: '@nostrwatch/utils'
  },
  Debugger: {
    loader: () => import('$lib/components/partials/Debugger.svelte'),
    path: '$lib/components/partials/Debugger.svelte'
  },
  routines: {
    loader: () => import('$lib/stores/memory-relays/routines'),
    path: '$lib/stores/memory-relays/routines'
  },
  services: {
    loader: () => import('$lib/stores/services'),
    path: '$lib/stores/services'
  },
  UserService: {
    loader: () => import('$lib/services/UserService'),
    path: '$lib/services/UserService'
  },
  events: {
    loader: () => import('$stores/events'),
    path: '$stores/events'
  },
  ActivityList: {
    loader: () => import('$lib/components/partials/ActivityList.svelte'),
    path: '$lib/components/partials/ActivityList.svelte'
  },
  dataRegister: {
    loader: () => import('$stores/data-register'),
    path: '$stores/data-register'
  },
  ActivityManager: {
    loader: () => import('$lib/managers/ActivityManager'),
    path: '$lib/managers/ActivityManager'
  },
};

export type Modules = {
  lifecycle: typeof import('$lib/utils/lifecycle');
  utils: typeof import('@nostrwatch/utils');
  Debugger: (typeof import('$lib/components/partials/Debugger.svelte'))["default"];
  routines: typeof import('$lib/stores/memory-relays/routines');
  services: typeof import('$lib/stores/services');
  UserService: typeof import('$lib/services/UserService');
  events: typeof import('$stores/events');
  ActivityList: (typeof import('$lib/components/partials/ActivityList.svelte'))["default"];
  dataRegister: typeof import('$stores/data-register');
  ActivityManager: typeof import('$lib/managers/ActivityManager');
};

export async function loadModules(
  onProgress?: (key: ModuleKey, module: Modules[ModuleKey]) => void
): Promise<Modules> {
  const loadedModules = {} as Partial<Modules>;

  const keys = Object.keys(moduleLoaders) as ModuleKey[];
  await Promise.all(
    keys.map(async (key) => {
      const { loader, path } = moduleLoaders[key];
      try {
        const mod = await loader();
        const loaded: Modules[typeof key] = mod.default ?? mod;
        loadedModules[key] = loaded;
        onProgress?.(key, loaded);
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `Failed to load module "${key}" from path "${path}". Error: ${errorMsg}\n` +
            `Please verify that the file exists and that the import path is correct.`
        );
        throw new Error(`Failed to load module "${key}" from path "${path}": ${errorMsg}`);
      }
    })
  );

  return loadedModules as Modules;
}
