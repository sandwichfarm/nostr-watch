<script lang="ts">
	export let percent: number | null = null;
	export let size = 148;
	export let strokeWidth = 10;
	export let title: string | undefined = undefined;
	export let foreground = 'rgba(255, 255, 255, 0.85)';
	export let background = 'rgba(255, 255, 255, 0.16)';

	const clampPercent = (value: number | null): number => {
		if (typeof value !== 'number') return 0;
		if (!Number.isFinite(value)) return 0;
		return Math.max(0, Math.min(100, value));
	};

	$: clamped = clampPercent(percent);
	$: radius = Math.max(1, (size - strokeWidth) / 2);
	$: circumference = 2 * Math.PI * radius;
	$: dashOffset = circumference * (1 - clamped / 100);
	$: viewBox = `0 0 ${size} ${size}`;
</script>

<svg
	class="donut"
	width={size}
	height={size}
	viewBox={viewBox}
	role="img"
	aria-label={title ?? 'donut'}
>
	{#if title}
		<title>{title}</title>
	{/if}

	<circle
		class="track"
		cx={size / 2}
		cy={size / 2}
		r={radius}
		fill="none"
		stroke={background}
		stroke-width={strokeWidth}
	/>

	<circle
		class="arc"
		cx={size / 2}
		cy={size / 2}
		r={radius}
		fill="none"
		stroke={foreground}
		stroke-width={strokeWidth}
		stroke-linecap="round"
		stroke-dasharray={circumference}
		stroke-dashoffset={dashOffset}
		transform={`rotate(-90 ${size / 2} ${size / 2})`}
	/>
</svg>

<style>
	.donut {
		display: block;
		margin: 0 auto;
		overflow: visible;
	}
</style>

