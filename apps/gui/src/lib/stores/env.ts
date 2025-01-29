import { get, readable, type Readable } from "svelte/store";

export const mode: Readable<string> = readable(import.meta.env.MODE)

export const isProduction = (): boolean => get(mode) === "production"