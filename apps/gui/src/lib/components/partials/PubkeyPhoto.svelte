<script lang="ts">
	import { pubkeyProfile$ } from "$stores/helpers/helpers-pubkey";
	import { PFP } from "$utils/pfp";
	import type { PubkeyProfile } from "@nostrwatch/route66/models/PubkeyProfile";
	import type { Readable } from "svelte/store";

	export let pubkey: string;
	export let size: number = 10;

	let profile: Readable<PubkeyProfile | undefined> = pubkeyProfile$(pubkey);
	let photo: string | undefined;
	let loading: boolean = true;

	$: {
		if (profile) {
			const unsubscribe = profile.subscribe((p) => {
				if (p?.photo) {
					fetchWithTimeout(p.photo, 10000)
						.then(() => {
							photo = p.photo;
							loading = false;
						})
						.catch(() => {
							photo = PFP.generate(pubkey);
							loading = false;
						});
				} else {
					photo = PFP.generate(pubkey);
					loading = false;
				}
			});
			unsubscribe();
		}
	}

	function fetchWithTimeout(url: string, timeout: number): Promise<void> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const timer = setTimeout(() => {
				img.src = ""; // Cancel image loading
				reject(new Error("Image fetch timed out"));
			}, timeout);

			img.onload = () => {
				clearTimeout(timer);
				resolve();
			};
			img.onerror = () => {
				clearTimeout(timer);
				reject(new Error("Image fetch failed"));
			};
			img.src = url;
		});
	}
</script>

{#if loading}
	<span class="overflow-hidden inline-block mr-3">
		<div class="w-{size} h-{size} rounded-full animate-pulse bg-gradient-to-r from-gray-300 to-gray-500"></div>
	</span>
{:else}
	{#if photo}
		<span class="overflow-hidden inline-block mr-3">
			<img src={photo} alt={pubkey} class="w-{size} h-{size} block rounded-full" />
		</span>
	{:else}
		<span class="rounded-full overflow-hidden inline-block mr-3">
			<img src={PFP.generate(pubkey)} alt={pubkey} class="w-{size} h-{size}" />
		</span>
	{/if}
{/if}
