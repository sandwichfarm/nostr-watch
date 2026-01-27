<script lang="ts">
	import { pubkeyProfile$ } from "$stores/helpers/helpers-pubkey";
	import { PFP } from "$utils/pfp";
	import type { PubkeyProfile } from "@nostrwatch/route66/models/PubkeyProfile";
	import type { Readable } from "svelte/store";
	import { onDestroy } from "svelte";

	export let pubkey: string;
	export let size: number = 10;

	let profile: Readable<PubkeyProfile | undefined> = pubkeyProfile$(pubkey);
	let photo: string | undefined;
	let loading: boolean = true;

	let unsubscribe: (() => void) | null = null;

	$: profile = pubkeyProfile$(pubkey);
	$: {
		unsubscribe?.();
		loading = true;
		photo = undefined;

		unsubscribe = profile.subscribe((p) => {
			photo = p?.photo || p?.picture || PFP.generate(pubkey);
			loading = false;
		});
	}

	onDestroy(() => {
		unsubscribe?.();
		unsubscribe = null;
	});
</script>

{#if loading}
	<span class="overflow-hidden inline-block mr-3">
		<div class="w-{size} h-{size} rounded-full animate-pulse bg-gradient-to-r from-gray-300 to-gray-500"></div>
	</span>
{:else}
	{#if photo}
		<span class="overflow-hidden inline-block mr-3">
			<img
				src="{photo}"
				alt={pubkey}
				loading="lazy"
				decoding="async"
				referrerpolicy="no-referrer"
				on:error={() => (photo = PFP.generate(pubkey))}
				class="w-{size} h-{size} block rounded-full"
			/>
		</span>
	{:else}
		<span class="rounded-full overflow-hidden inline-block mr-3">
			<img
				src="{PFP.generate(pubkey)}"
				alt={pubkey}
				loading="lazy"
				decoding="async"
				referrerpolicy="no-referrer"
				class="w-{size} h-{size}"
			/>
		</span>
	{/if}
{/if}
