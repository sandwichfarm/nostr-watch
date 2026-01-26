<script lang="ts">
    import { get, writable, type Writable } from 'svelte/store';
    import Input from '$ui/input/input.svelte';
    import * as Dialog from '$lib/components/ui/dialog';
    import Checkbox from '$ui/checkbox/checkbox.svelte';
    import Label from '$ui/label/label.svelte';
    import Button from '$ui/button/button.svelte';
	import { cn } from '$lib/utils/ui.js';
    import { StateManager } from '@nostrwatch/route66';
    import { sharableConfig, type SharableConfigKeys } from '../table/utils';
    import type { DataTableConfig } from '../DataTableTypes';
    import { compress } from 'compress-json';

    export let config: Writable<DataTableConfig>;
    export let onSave: () => void = () => {};
	export let triggerClass: string | undefined = undefined;

    const USER_PRESETS_KEY = 'preferences:relays:userPresets';

    type UserPreset = {
        title: string;
        hash: string;
        payload: Partial<DataTableConfig>;
        createdAt: number;
    };

    const availableSaveKeys: readonly string[] = Object.freeze(['filtersActive', 'filtersShow', 'columnsShow', 'sortState']);
    const saveKeys: Writable<SharableConfigKeys[]> = writable([...availableSaveKeys] as SharableConfigKeys[]);
    const presetName: Writable<string> = writable('');
    const error: Writable<string> = writable('');

    let dialogOpen = false;

    const toggleSaveKey = (key: string) => {
        if ($saveKeys.length === 1 && $saveKeys.includes(key as SharableConfigKeys)) {
            error.set('Must include at least one option');
            return;
        }
        error.set('');

        if ($saveKeys.includes(key as SharableConfigKeys)) {
            saveKeys.update(keys => keys.filter(k => k !== key));
        } else {
            saveKeys.update(keys => [...keys, key as SharableConfigKeys]);
            if (key === 'filtersActive') {
                saveKeys.update(keys => {
                    const newKeys = Array.from(new Set([...keys, 'filtersShow', 'columnsShow'])) as SharableConfigKeys[];
                    return newKeys;
                });
            }
        }
    };

    const savePreset = () => {
        const name = $presetName.trim();
        if (!name) {
            error.set('Please enter a preset name');
            return;
        }

        // Get current presets
        const existingPresets: UserPreset[] = StateManager.get(USER_PRESETS_KEY) || [];

        // Check for duplicate names
        if (existingPresets.some(p => p.title.toLowerCase() === name.toLowerCase())) {
            error.set('A preset with this name already exists');
            return;
        }

        // Build payload from current config
        const payload: Partial<DataTableConfig> = {};
        const currentConfig = $config;

        if ($saveKeys.includes('filtersActive')) {
            payload.filtersActive = currentConfig.filtersActive;
        }
        if ($saveKeys.includes('filtersShow')) {
            payload.filtersShow = currentConfig.filtersShow;
        }
        if ($saveKeys.includes('columnsShow')) {
            payload.columnsShow = currentConfig.columnsShow;
        }
        if ($saveKeys.includes('sortState')) {
            payload.sortState = currentConfig.sortState;
        }

        // Generate hash for URL compatibility
        const hash = btoa(JSON.stringify(compress(payload)));

        const newPreset: UserPreset = {
            title: name,
            hash,
            payload,
            createdAt: Date.now(),
        };

        // Save to storage
        StateManager.set(USER_PRESETS_KEY, [...existingPresets, newPreset]);

        // Reset form
        presetName.set('');
        error.set('');
        dialogOpen = false;

        // Notify parent
        onSave();
    };

    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            savePreset();
        }
    };
</script>

<Dialog.Root bind:open={dialogOpen}>
    <Dialog.Trigger asChild let:builder>
        <Button builders={[builder]} variant="secondary" size="sm" class={cn("whitespace-nowrap", triggerClass)}>
            Save Preset
        </Button>
    </Dialog.Trigger>
    <Dialog.Content class="p-10 z-[9999]">
        <Dialog.Header>
            <Dialog.Title>Save Current View as Preset</Dialog.Title>
            <Dialog.Description>
                Save your current filters and column settings for quick access later.
            </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-4 mt-4">
            <div>
                <Label for="preset-name" class="text-sm font-medium">Preset Name</Label>
                <Input
                    id="preset-name"
                    bind:value={$presetName}
                    placeholder="e.g., My favorite relays"
                    on:keydown={handleKeydown}
                    class="mt-1"
                />
            </div>

            {#if $error}
                <p class="text-sm text-red-500">{$error}</p>
            {/if}

            <div class="space-y-2">
                <p class="text-sm font-medium">Include in preset:</p>

                <div class="flex items-center gap-2">
                    <Checkbox
                        id="save-filtersActive"
                        onCheckedChange={() => toggleSaveKey('filtersActive')}
                        checked={$saveKeys.includes('filtersActive')}
                    />
                    <Label for="save-filtersActive" class="text-sm">
                        Active Filters
                    </Label>
                </div>

                <div class="flex items-center gap-2">
                    <Checkbox
                        id="save-filtersShow"
                        disabled={$saveKeys.includes('filtersActive')}
                        onCheckedChange={() => toggleSaveKey('filtersShow')}
                        checked={$saveKeys.includes('filtersShow')}
                    />
                    <Label for="save-filtersShow" class="text-sm">
                        Visible Filters
                    </Label>
                </div>

                <div class="flex items-center gap-2">
                    <Checkbox
                        id="save-columnsShow"
                        disabled={$saveKeys.includes('filtersActive')}
                        onCheckedChange={() => toggleSaveKey('columnsShow')}
                        checked={$saveKeys.includes('columnsShow')}
                    />
                    <Label for="save-columnsShow" class="text-sm">
                        Visible Columns
                    </Label>
                </div>

                <div class="flex items-center gap-2">
                    <Checkbox
                        id="save-sortState"
                        onCheckedChange={() => toggleSaveKey('sortState')}
                        checked={$saveKeys.includes('sortState')}
                    />
                    <Label for="save-sortState" class="text-sm">
                        Sort State
                    </Label>
                </div>
            </div>

            <div class="flex justify-end gap-2 mt-6">
                <Button variant="outline" on:click={() => dialogOpen = false}>
                    Cancel
                </Button>
                <Button on:click={savePreset}>
                    Save Preset
                </Button>
            </div>
        </div>
    </Dialog.Content>
</Dialog.Root>
