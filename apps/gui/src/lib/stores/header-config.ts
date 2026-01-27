import type { Writable } from 'svelte/store';
import { writable } from 'svelte/store';

import type { DataViewViews } from '$lib/components/data-view/DataTableTypes';

export type HeaderDataViewSelectorsConfig = {
    id: string;
    showDimension?: boolean;
    showPresets?: boolean;
    showView?: boolean;
    enabledViews?: DataViewViews[];
    activeView?: Writable<DataViewViews>;
    onPresetSelect?: (path: string) => void;
    className?: string;
};

export type HeaderConfig = {
    selectors: HeaderDataViewSelectorsConfig | null;
};

export const HeaderConfigStore: Writable<HeaderConfig> = writable({ selectors: null });
