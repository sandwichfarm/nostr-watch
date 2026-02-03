<script lang="ts">
	import type { HTMLTableAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/ui.js';

	type $$Props = HTMLTableAttributes;

	let className: $$Props['class'] = undefined;
	export let containerClass: string | undefined = 'overflow-x-auto';
	export let containerStyle: string | undefined = undefined;
	export { className as class };
</script>

<div class={cn('relative w-full', containerClass)} style={containerStyle ?? undefined}>
	<table class={cn('w-full caption-bottom text-sm', className)} {...$$restProps}>
		<slot />
	</table>
</div>
