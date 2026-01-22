<script lang="ts">
    import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import Page from "$routes/+page.svelte";
	import Badge from "$ui/badge/badge.svelte";
	import Button from "$ui/button/button.svelte";
	import { compress } from "compress-json";
	import { filter } from "lodash";
	import { onMount } from "svelte";
	import { writable, type Writable } from "svelte/store";
	import { StateManager } from "@nostrwatch/route66";

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

    export let buttonClass = "inline-block py-1 px-2 mr-2 mb-2 text-sm rounded-sm bg-black/5 dark:bg-white/5 hover:bg-white/20";
    export let buttonSize = "sm";
    export let buttonActiveClass = "bg-black/20 dark:bg-white/20"
    export let buttonVariant = "ghost";
    export let onClick = (hash:string) => { goto(hash) }
    export let label = ""

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
    };

    // Combined shortcuts (built-in + user)
    $: shortcuts = [...builtInPresets, ...$userPresets.map(p => ({ ...p, isUserPreset: true }))];

    const active = writable(builtInPresets[0].title);

    // Delete a user preset
    const deleteUserPreset = (title: string, event: Event) => {
        event.stopPropagation();
        const stored: UserPreset[] = StateManager.get(USER_PRESETS_KEY) || [];
        const updated = stored.filter(p => p.title !== title);
        StateManager.set(USER_PRESETS_KEY, updated);
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
                StateManager.set(LAST_PRESET_KEY, shortcut.title);
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
        loadUserPresets();

        // Initialize from URL hash, persisted preference, or default
        if (window.location.hash) {
            const hash = window.location.hash.replace('#', '');
            // Use builtInPresets for initial check since userPresets may not be loaded yet
            const shortcut = builtInPresets.find(s => s.hash === hash);
            if (shortcut) setActive(shortcut);
        } else if ($page.url.pathname === "/relays") {
            // Try to load last used preset from storage
            const lastPresetTitle = StateManager.get(LAST_PRESET_KEY);
            const lastPreset = lastPresetTitle
                ? builtInPresets.find(s => s.title === lastPresetTitle)
                : null;

            if (lastPreset) {
                setActive(lastPreset, false); // Don't re-persist, just restore
            } else {
                setActive(builtInPresets[0], false); // Default to first preset
            }
        }
    });

    
</script>
<div class="leading-9 {className}">
{#if label}
    <span class="inline-block italic text-sm mr-2 ml-2">
        {label}
    </span>
{/if}
{#each shortcuts as shortcut}
    <span class="inline-flex items-center mr-1 mb-1">
        <Button
            size="small"
            variant={buttonVariant}
            on:click={() => setActive(shortcut)}
            class="{buttonClass} {$active === shortcut.title ? buttonActiveClass : ''} {shortcut.isUserPreset ? 'pr-1 border border-dashed border-purple-500/40 text-purple-300' : ''}"
        >
            {shortcut.title}
            {#if shortcut.isUserPreset}
                <button
                    on:click={(e) => deleteUserPreset(shortcut.title, e)}
                    class="ml-1 px-1 opacity-40 hover:opacity-100 hover:text-red-400"
                    title="Delete preset"
                >
                    ×
                </button>
            {/if}
        </Button>
    </span>
{/each}
</div>