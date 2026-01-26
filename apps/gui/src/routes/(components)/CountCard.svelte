<script lang="ts">
	import AlwaysSquare from "$lib/components/partials/AlwaysSquare.svelte";
import { onMount } from "svelte";
	import { writable, type Readable, type Writable } from "svelte/store";
	import { fly, fade } from "svelte/transition";

	export let topText: string | undefined = undefined;
	export let value: Readable<string | number | null>;
	export let link: string | undefined = undefined;
	export let bottomText: string | undefined = undefined;
    export let index: number = 0;
	export let innerClass: string | undefined = undefined;

    let show: Writable<boolean> =  writable(false);

    onMount(() => {
        setTimeout(() => {
            show.set(true);
        }, 50*index);
    })  
</script>

<div class="{$$restProps.class || ''} grid hp-card-wrapper">
	<AlwaysSquare>
	<div class="hp-card {innerClass? innerClass: 'bg-white/10 dark:bg-black/10'}">
		
		{#if $show && $value !== null && $value !== undefined}
			<div class="content" in:fade>
                <div in:fly={{ y: 20, duration: 300 }}>
					{#if topText}
                    <div class="label text-center">{@html topText}</div>
					{/if}
                    <div class="value text-7xl font-bold text-center">
						{#if link}
							<a href={link}>{@html $value}</a>
						{:else}
							{@html $value}
						{/if}
                        
                    </div>
					{#if bottomText}
                    <div class="label text-center">{@html bottomText}</div>
					{/if}
                </div>
			</div>
		{/if}
	</div>
	</AlwaysSquare>
	
</div>

<style lang="postcss">
	.hp-card-wrapper {
		@apply p-5
	}

	.hp-card {
		@apply 
			flex
			border-white/5 border-[2px] 
			 hover:bg-white/15 
			rounded-md
			items-center justify-center
			shadow-start hover:shadow-end transition-shadow duration-200 
			drop-shadow-[0_25px_25px_rgba(255,255,255,0.35)]
            min-h-[240px]
			h-full;
	}

	.hp-card:hover {
		@apply bg-white/20 dark:bg-black/15;
	}

	.label {
		@apply opacity-50 hover:opacity-60;
	}

	.value {
		@apply opacity-70;
	}

	.hp-card:hover .value {
		@apply opacity-100;
	}
</style>
