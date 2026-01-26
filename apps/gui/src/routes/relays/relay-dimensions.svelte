<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import DropdownSelect, { type DropdownSelectOption } from "$lib/components/partials/DropdownSelect.svelte";
	import { cn } from "$lib/utils/ui.js";

	type DimensionKey = "relay" | "software" | "geo" | "isps";

	const options: DropdownSelectOption<DimensionKey>[] = [
		{ value: "relay", label: "relay", searchText: "relays", meta: { href: "/relays" } },
		{ value: "software", label: "software", meta: { href: "/relays/software" } },
		{ value: "geo", label: "geo", searchText: "geography", meta: { href: "/relays/geography" } },
		{ value: "isps", label: "isps", meta: { href: "/relays/isps" } },
	];

	$: pathname = $page.url.pathname;
	$: current = ((): DimensionKey => {
		if (pathname === "/relays") return "relay";
		if (pathname.startsWith("/relays/software")) return "software";
		if (pathname.startsWith("/relays/geography")) return "geo";
		if (pathname.startsWith("/relays/isps")) return "isps";
		return "relay";
	})();

	const onDimensionChange = (next: string | null) => {
		if (!next) return;
		const opt = options.find((o) => o.value === next);
		const href = opt?.meta?.href as string | undefined;
		if (!href) return;
		goto(href);
	};

	let className: string | undefined = undefined;
	export { className as class };
</script>

<DropdownSelect class={cn(className)} label="dimension" value={current} {options} on:change={(e) => onDimensionChange(e.detail.value)} />
