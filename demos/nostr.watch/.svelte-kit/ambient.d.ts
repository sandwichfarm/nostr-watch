
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://kit.svelte.dev/docs/modules#$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://kit.svelte.dev/docs/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://kit.svelte.dev/docs/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://kit.svelte.dev/docs/modules#$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```bash
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const NVM_INC: string;
	export const COREPACK_ROOT: string;
	export const TERM_PROGRAM: string;
	export const npm_package_dependencies__nostr_dev_kit_ndk_svelte: string;
	export const NODE: string;
	export const npm_package_dependencies_tseep: string;
	export const INIT_CWD: string;
	export const NVM_CD_FLAGS: string;
	export const npm_package_devDependencies_typescript: string;
	export const npm_config_version_git_tag: string;
	export const SHELL: string;
	export const TERM: string;
	export const npm_package_devDependencies_vite: string;
	export const npm_package_devDependencies_rimraf: string;
	export const TMPDIR: string;
	export const npm_config_init_license: string;
	export const TERM_PROGRAM_VERSION: string;
	export const npm_package_scripts_dev: string;
	export const npm_package_devDependencies_postcss_load_config: string;
	export const MallocNanoZone: string;
	export const ORIGINAL_XDG_CURRENT_DESKTOP: string;
	export const ZDOTDIR: string;
	export const npm_package_devDependencies__sveltejs_kit: string;
	export const npm_config_registry: string;
	export const ZSH: string;
	export const npm_package_readmeFilename: string;
	export const npm_package_dependencies_svelte_time: string;
	export const USER: string;
	export const NVM_DIR: string;
	export const npm_package_description: string;
	export const LS_COLORS: string;
	export const npm_package_scripts_check_watch: string;
	export const npm_package_license: string;
	export const COMMAND_MODE: string;
	export const npm_package_dependencies__square_svelte_store: string;
	export const npm_package_dependencies__nostr_dev_kit_ndk: string;
	export const SSH_AUTH_SOCK: string;
	export const npm_package_dependencies__nostrwatch_kit: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const npm_package_devDependencies_postcss: string;
	export const PYENV_VIRTUALENV_INIT: string;
	export const npm_execpath: string;
	export const npm_package_devDependencies_tslib: string;
	export const PAGER: string;
	export const GO111MODULE: string;
	export const npm_package_devDependencies_svelte: string;
	export const LSCOLORS: string;
	export const PATH: string;
	export const npm_config_argv: string;
	export const LaunchInstanceID: string;
	export const _: string;
	export const __CFBundleIdentifier: string;
	export const USER_ZDOTDIR: string;
	export const PWD: string;
	export const npm_package_devDependencies_tailwindcss: string;
	export const npm_package_devDependencies__smui_tooltip: string;
	export const npm_package_scripts_preview: string;
	export const npm_lifecycle_event: string;
	export const npm_package_dependencies_vite_plugin_node_polyfills: string;
	export const LANG: string;
	export const npm_package_devDependencies__sveltejs_vite_plugin_svelte: string;
	export const npm_package_devDependencies__smui_button: string;
	export const npm_package_name: string;
	export const npm_package_dependencies_svelte_material_ui: string;
	export const npm_package_dependencies_svelte_bricks: string;
	export const npm_package_scripts_build: string;
	export const npm_config_version_commit_hooks: string;
	export const XPC_FLAGS: string;
	export const VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
	export const npm_package_dependencies__nostr_dev_kit_ndk_cache_dexie: string;
	export const npm_config_bin_links: string;
	export const npm_package_main: string;
	export const XPC_SERVICE_NAME: string;
	export const npm_package_devDependencies__sveltejs_adapter_auto: string;
	export const npm_package_version: string;
	export const GPG_TTY: string;
	export const VSCODE_INJECTION: string;
	export const npm_package_devDependencies_svelte_check: string;
	export const npm_package_devDependencies_autoprefixer: string;
	export const HOME: string;
	export const SHLVL: string;
	export const UPDATE_ZSH_DAYS: string;
	export const PYENV_SHELL: string;
	export const npm_package_type: string;
	export const VSCODE_GIT_ASKPASS_MAIN: string;
	export const npm_config_save_prefix: string;
	export const npm_config_strict_ssl: string;
	export const npm_config_version_git_message: string;
	export const npm_config_save_exact: string;
	export const npm_package_dependencies__nostrwatch_idb: string;
	export const LOGNAME: string;
	export const LESS: string;
	export const YARN_WRAP_OUTPUT: string;
	export const npm_package_dependencies__svelte_plugins_tooltips: string;
	export const npm_lifecycle_script: string;
	export const VSCODE_GIT_IPC_HANDLE: string;
	export const NVM_BIN: string;
	export const npm_package_dependencies_fastq: string;
	export const npm_config_version_git_sign: string;
	export const npm_config_ignore_scripts: string;
	export const npm_config_user_agent: string;
	export const GIT_ASKPASS: string;
	export const VSCODE_GIT_ASKPASS_NODE: string;
	export const npm_package_dependencies__nostrwatch_kit_adapter_idb: string;
	export const npm_config_init_version: string;
	export const npm_config_ignore_optional: string;
	export const SECURITYSESSIONID: string;
	export const npm_package_scripts_clean: string;
	export const npm_package_dependencies_hash_object: string;
	export const npm_package_scripts_check: string;
	export const COLORTERM: string;
	export const npm_node_execpath: string;
	export const npm_package_devDependencies_vite_plugin_cross_origin_isolation: string;
	export const npm_config_version_tag_prefix: string;
	export const NODE_ENV: string;
}

/**
 * Similar to [`$env/static/private`](https://kit.svelte.dev/docs/modules#$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://kit.svelte.dev/docs/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://kit.svelte.dev/docs/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://kit.svelte.dev/docs/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://kit.svelte.dev/docs/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * Dynamic environment variables cannot be used during prerendering.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		NVM_INC: string;
		COREPACK_ROOT: string;
		TERM_PROGRAM: string;
		npm_package_dependencies__nostr_dev_kit_ndk_svelte: string;
		NODE: string;
		npm_package_dependencies_tseep: string;
		INIT_CWD: string;
		NVM_CD_FLAGS: string;
		npm_package_devDependencies_typescript: string;
		npm_config_version_git_tag: string;
		SHELL: string;
		TERM: string;
		npm_package_devDependencies_vite: string;
		npm_package_devDependencies_rimraf: string;
		TMPDIR: string;
		npm_config_init_license: string;
		TERM_PROGRAM_VERSION: string;
		npm_package_scripts_dev: string;
		npm_package_devDependencies_postcss_load_config: string;
		MallocNanoZone: string;
		ORIGINAL_XDG_CURRENT_DESKTOP: string;
		ZDOTDIR: string;
		npm_package_devDependencies__sveltejs_kit: string;
		npm_config_registry: string;
		ZSH: string;
		npm_package_readmeFilename: string;
		npm_package_dependencies_svelte_time: string;
		USER: string;
		NVM_DIR: string;
		npm_package_description: string;
		LS_COLORS: string;
		npm_package_scripts_check_watch: string;
		npm_package_license: string;
		COMMAND_MODE: string;
		npm_package_dependencies__square_svelte_store: string;
		npm_package_dependencies__nostr_dev_kit_ndk: string;
		SSH_AUTH_SOCK: string;
		npm_package_dependencies__nostrwatch_kit: string;
		__CF_USER_TEXT_ENCODING: string;
		npm_package_devDependencies_postcss: string;
		PYENV_VIRTUALENV_INIT: string;
		npm_execpath: string;
		npm_package_devDependencies_tslib: string;
		PAGER: string;
		GO111MODULE: string;
		npm_package_devDependencies_svelte: string;
		LSCOLORS: string;
		PATH: string;
		npm_config_argv: string;
		LaunchInstanceID: string;
		_: string;
		__CFBundleIdentifier: string;
		USER_ZDOTDIR: string;
		PWD: string;
		npm_package_devDependencies_tailwindcss: string;
		npm_package_devDependencies__smui_tooltip: string;
		npm_package_scripts_preview: string;
		npm_lifecycle_event: string;
		npm_package_dependencies_vite_plugin_node_polyfills: string;
		LANG: string;
		npm_package_devDependencies__sveltejs_vite_plugin_svelte: string;
		npm_package_devDependencies__smui_button: string;
		npm_package_name: string;
		npm_package_dependencies_svelte_material_ui: string;
		npm_package_dependencies_svelte_bricks: string;
		npm_package_scripts_build: string;
		npm_config_version_commit_hooks: string;
		XPC_FLAGS: string;
		VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
		npm_package_dependencies__nostr_dev_kit_ndk_cache_dexie: string;
		npm_config_bin_links: string;
		npm_package_main: string;
		XPC_SERVICE_NAME: string;
		npm_package_devDependencies__sveltejs_adapter_auto: string;
		npm_package_version: string;
		GPG_TTY: string;
		VSCODE_INJECTION: string;
		npm_package_devDependencies_svelte_check: string;
		npm_package_devDependencies_autoprefixer: string;
		HOME: string;
		SHLVL: string;
		UPDATE_ZSH_DAYS: string;
		PYENV_SHELL: string;
		npm_package_type: string;
		VSCODE_GIT_ASKPASS_MAIN: string;
		npm_config_save_prefix: string;
		npm_config_strict_ssl: string;
		npm_config_version_git_message: string;
		npm_config_save_exact: string;
		npm_package_dependencies__nostrwatch_idb: string;
		LOGNAME: string;
		LESS: string;
		YARN_WRAP_OUTPUT: string;
		npm_package_dependencies__svelte_plugins_tooltips: string;
		npm_lifecycle_script: string;
		VSCODE_GIT_IPC_HANDLE: string;
		NVM_BIN: string;
		npm_package_dependencies_fastq: string;
		npm_config_version_git_sign: string;
		npm_config_ignore_scripts: string;
		npm_config_user_agent: string;
		GIT_ASKPASS: string;
		VSCODE_GIT_ASKPASS_NODE: string;
		npm_package_dependencies__nostrwatch_kit_adapter_idb: string;
		npm_config_init_version: string;
		npm_config_ignore_optional: string;
		SECURITYSESSIONID: string;
		npm_package_scripts_clean: string;
		npm_package_dependencies_hash_object: string;
		npm_package_scripts_check: string;
		COLORTERM: string;
		npm_node_execpath: string;
		npm_package_devDependencies_vite_plugin_cross_origin_isolation: string;
		npm_config_version_tag_prefix: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://kit.svelte.dev/docs/modules#$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://kit.svelte.dev/docs/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * Dynamic environment variables cannot be used during prerendering.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
