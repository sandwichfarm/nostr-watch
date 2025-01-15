import { writable, type Writable } from 'svelte/store';
import type Route66 from '@nostrwatch/route66';

export const route66: Writable<Route66 | null> = writable(null);