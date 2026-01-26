<script lang="ts">
    import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { compress } from "compress-json";
	import { onMount } from "svelte";
	import { writable, type Writable } from "svelte/store";
	import { StateManager } from "@nostrwatch/route66";
	import DropdownSelect, { type DropdownSelectOption } from "$lib/components/partials/DropdownSelect.svelte";
	import { cn } from "$lib/utils/ui.js";
	import { getLeaderTabRpcClient } from "$lib/runtime/leader-tab-client";
	import { stateManagerSet, stateManagerStorageKey } from "$lib/runtime/state-manager-sync";

    // Built-in Presets
	import AllRelays from "./presets/AllRelays";
	import CommunityRelays from "./presets/CommunityRelays";
    import ClientDevView from "./presets/ClientDevView";

	const LAST_PRESET_KEY = "preferences:relays:lastPreset";
	const USER_PRESETS_KEY = "preferences:relays:userPresets";

	type UserPreset = {
		title: string;
		hash: string;
		payload: any;
		createdAt: number;
	};

    const className = $$props.class;

    export let onClick = (hash:string) => { goto(hash) }
    export let label = "Presets"

    // Built-in presets (static)
    const builtInPresets = [
        AllRelays,
        {
            title: "paid relays",
            hash: "W1siY29sdW1uc1Nob3ciLCJmaWx0ZXJzU2hvdyIsImZpbHRlcnNBY3RpdmUiLCJzb3J0U3RhdGUiLCJhfDB8MXwyfDMiLCJyZWxheSIsInJ0dCIsIm9wZXJhdG9yUHVia2V5IiwicmVzdHJpY3RlZFdyaXRlcyIsInN1YnNjcmlwdGlvbkZlZSIsInB1YmxpY2F0aW9uRmVlIiwiYWRtaXNzaW9uRmVlIiwibGFzdFNlZW4iLCJhfDV8Nnw3fDh8OXxBfEJ8QyIsInN1cHBvcnRlZE5pcHMiLCJwYXltZW50UmVxdWlyZWQiLCJhdXRoUmVxdWlyZWQiLCJuaXAxMUlzVmFsaWQiLCJuaXAxMVZhbGlkYXRpb25FcnJvcnMiLCJhfDZ8RXxGfEd8SHxJIiwiYXxGIiwiYnxUIiwib3xLfEwiLCJjb2x1bW5JZCIsImRpcmVjdGlvbiIsImF8TnxPIiwiYXNjIiwib3xQfDl8USIsIm98NHxEfEp8TXxSIl0sIlMiXQ=="
        },
        {
            title: "public relays",
            hash: "W1siY29sdW1uc1Nob3ciLCJmaWx0ZXJzU2hvdyIsImZpbHRlcnNBY3RpdmUiLCJzb3J0U3RhdGUiLCJhfDB8MXwyfDMiLCJyZWxheSIsInJ0dCIsIm9wZXJhdG9yUHVia2V5IiwiZGVzY3JpcHRpb24iLCJsYXN0U2VlbiIsImF8NXw2fDd8OHw5Iiwic3VwcG9ydGVkTmlwcyIsInBheW1lbnRSZXF1aXJlZCIsImF1dGhSZXF1aXJlZCIsIm5pcDExSXNWYWxpZCIsIm5pcDExVmFsaWRhdGlvbkVycm9ycyIsImF8NnxCfEN8RHxFfEYiLCJhfER8Q3xFIiwiYnxGIiwiYnxUIiwib3xIfEl8SXxKIiwiY29sdW1uSWQiLCJkaXJlY3Rpb24iLCJhfEx8TSIsImFzYyIsIm98Tnw2fE8iLCJvfDR8QXxHfEt8UCJdLCJRIl0="
        },
        {
            title: "search relays",
            hash: "W1siY29sdW1uc1Nob3ciLCJmaWx0ZXJzU2hvdyIsImZpbHRlcnNBY3RpdmUiLCJzb3J0U3RhdGUiLCJhfDB8MXwyfDMiLCJyZWxheSIsInJ0dCIsImdlb2NvZGUiLCJuaXAxMVZhbGlkYXRpb25FcnJvcnMiLCJhfDV8Nnw3fDgiLCJzdXBwb3J0ZWROaXBzIiwiYXxBIiwiNTAiLCJhfEMiLCJvfEJ8RCIsImNvbHVtbklkIiwiZGlyZWN0aW9uIiwiYXxGfEciLCJvfEh8NnwiLCJvfDR8OXxCfEV8SSJdLCJKIl0="
        },
        CommunityRelays,
        {
            title: "pow relays",
            hash: "W1siY29sdW1uc1Nob3ciLCJmaWx0ZXJzU2hvdyIsImZpbHRlcnNBY3RpdmUiLCJzb3J0U3RhdGUiLCJhfDB8MXwyfDMiLCJyZWxheSIsInBvd1JlcXVpcmVkIiwibWluUG93RGlmZmljdWx0eSIsImF8NXw2fDciLCJhfDZ8NyIsImF8NiIsImJ8VCIsIm98QXxCIiwiY29sdW1uSWQiLCJkaXJlY3Rpb24iLCJhfER8RSIsImRlc2MiLCJvfEZ8N3xHIiwib3w0fDh8OXxDfEgiXSwiSSJd"
        },
        {
            title: "data-complete relays",
            hash: "W1siY29sdW1uc1Nob3ciLCJmaWx0ZXJzU2hvdyIsImZpbHRlcnNBY3RpdmUiLCJzb3J0U3RhdGUiLCJhfDB8MXwyfDMiLCJyZWxheSIsIm9wZXJhdG9yUHVia2V5IiwiZGVzY3JpcHRpb24iLCJuaXAxMUlzVmFsaWQiLCJhfDV8Nnw3fDgiLCJvcGVyYXRvclB1YmtleVZhbGlkIiwiaWNvbiIsImhhc0ljb24iLCJoYXNOaXAxMSIsIm5pcDExVmFsaWRhdGlvbkVycm9ycyIsImF8QXxCfEN8RHw4fEUiLCJhfEN8RHw4fEEiLCJifFQiLCJvfEd8SHxIfEh8SCIsImNvbHVtbklkIiwiZGlyZWN0aW9uIiwiYXxKfEsiLCJkZXNjIiwib3xMfDh8TSIsIm98NHw5fEZ8SXxOIl0sIk8iXQ=="
        },
        {
            title: "relays with nip-11 errors",
            hash: "W1siY29sdW1uc1Nob3ciLCJmaWx0ZXJzU2hvdyIsImZpbHRlcnNBY3RpdmUiLCJzb3J0U3RhdGUiLCJhfDB8MXwyfDMiLCJyZWxheSIsIm9wZXJhdG9yUHVia2V5IiwiZGVzY3JpcHRpb24iLCJuaXAxMUlzVmFsaWQiLCJuaXAxMVZhbGlkYXRpb25FcnJvcnMiLCJhfDV8Nnw3fDh8OSIsIm9wZXJhdG9yUHVia2V5VmFsaWQiLCJpY29uIiwiaGFzTmlwMTEiLCJhfEJ8Q3xEfDh8OSIsImF8OCIsImJ8RiIsIm98RnxHIiwiY29sdW1uSWQiLCJkaXJlY3Rpb24iLCJhfEl8SiIsImRlc2MiLCJvfEt8OXxMIiwib3w0fEF8RXxIfE0iXSwiTiJd",
        },
        ClientDevView,
    ];

    // User presets (loaded from storage)
    const userPresets: Writable<UserPreset[]> = writable([]);

    // Load user presets from storage
    const loadUserPresets = () => {
        const stored = StateManager.get(USER_PRESETS_KEY) || [];
        userPresets.set(stored);
		return stored as UserPreset[];
    };

    // Combined shortcuts (built-in + user)
    $: shortcuts = [...$userPresets.map(p => ({ ...p, isUserPreset: true })), ...builtInPresets];

    const active = writable(builtInPresets[0].title);

    // Delete a user preset
    const deleteUserPreset = (title: string) => {
        const stored: UserPreset[] = StateManager.get(USER_PRESETS_KEY) || [];
        const updated = stored.filter(p => p.title !== title);
        void stateManagerSet(USER_PRESETS_KEY, updated);
        userPresets.set(updated);

        // If deleted preset was active, switch to default
        if ($active === title) {
            setActive(builtInPresets[0], false);
        }
    };

    // Export for parent component to trigger reload
    export const reloadPresets = loadUserPresets;

    const setActive = (shortcut: any, persist: boolean = true) => {
        active.set(shortcut.title)

        // Persist the selected preset
        if (persist) {
            try {
                void stateManagerSet(LAST_PRESET_KEY, shortcut.title);
            } catch {}
        }

        if(shortcut?.payload){
            try {
                shortcut.hash = btoa(JSON.stringify(compress(shortcut.payload)))
                onClick(`/relays#${shortcut.hash}`)
                return
            }
            catch(e){
                onClick(`/relays`)
                return
            }
        }
        if(!shortcut.hash) {
            onClick(`/relays`)
            return
        }
        onClick(`/relays#${shortcut.hash}`)
    }

    onMount(() => {
        const storedUserPresets = loadUserPresets();
		const allShortcuts = [...storedUserPresets.map(p => ({ ...p, isUserPreset: true })), ...builtInPresets] as any[];

        // Initialize from URL hash, persisted preference, or default
        if (window.location.hash) {
            const hash = window.location.hash.replace('#', '');
            const shortcut = allShortcuts.find(s => s.hash === hash);
            if (shortcut) setActive(shortcut);
        } else if ($page.url.pathname === "/relays") {
            // Try to load last used preset from storage
            const lastPresetTitle = StateManager.get(LAST_PRESET_KEY);
            const lastPreset = lastPresetTitle
                ? allShortcuts.find(s => s.title === lastPresetTitle)
                : null;

            if (lastPreset) {
                setActive(lastPreset, false); // Don't re-persist, just restore
            } else {
                setActive(builtInPresets[0], false); // Default to first preset
            }
        }

		const onStorage = (event: StorageEvent) => {
			if (!event.key) return;
			if (event.key === stateManagerStorageKey(USER_PRESETS_KEY)) loadUserPresets();
			if (event.key === stateManagerStorageKey(LAST_PRESET_KEY)) {
				const next = StateManager.get(LAST_PRESET_KEY);
				if (typeof next === "string" && next.length) active.set(next);
			}
		};

		window.addEventListener("storage", onStorage);

		let stopBroadcast: (() => void) | null = null;
		try {
			stopBroadcast = getLeaderTabRpcClient().onBroadcast((msg) => {
				if (msg.kind !== "state.stateManager") return;
				const data = msg.data as any;
				if (data?.key === USER_PRESETS_KEY) loadUserPresets();
				if (data?.key === LAST_PRESET_KEY) {
					const next = data?.value;
					if (typeof next === "string" && next.length) active.set(next);
				}
			});
		} catch {}

		return () => {
			stopBroadcast?.();
			window.removeEventListener("storage", onStorage);
		};
    });

	$: dropdownOptions = shortcuts.map((shortcut) => {
		const isUserPreset = Boolean(shortcut.isUserPreset);
		return {
			value: shortcut.title,
			label: shortcut.title,
			group: isUserPreset ? "user" : "built-in",
			searchText: isUserPreset ? "user" : "built-in",
			className: isUserPreset ? "font-medium text-primary" : undefined,
			meta: { isUserPreset },
		} satisfies DropdownSelectOption;
	});

	const onPresetChange = (nextTitle: string | null) => {
		if (!nextTitle) return;
		const shortcut = shortcuts.find((s) => s.title === nextTitle);
		if (!shortcut) return;
		setActive(shortcut);
	};
    
</script>

<DropdownSelect
	class={cn(className)}
	label={label}
	value={$active}
	options={dropdownOptions}
	on:change={(e) => onPresetChange(e.detail.value)}
>
	<svelte:fragment slot="optionRight" let:option>
		{#if option?.meta?.isUserPreset}
			<span class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary">
				user
			</span>
			<button
				type="button"
				class="ml-2 px-1 opacity-50 hover:opacity-100 hover:text-red-300"
				title="Delete preset"
				on:click|stopPropagation={() => deleteUserPreset(option.value)}
			>
				×
			</button>
		{/if}
	</svelte:fragment>
</DropdownSelect>
