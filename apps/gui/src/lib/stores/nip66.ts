import { writable, type Writable } from 'svelte/store';
import type Nip66 from '@nostrwatch/nip66';

export const nip66: Writable<Nip66 | null> = writable(null);