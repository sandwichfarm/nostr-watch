<script>
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
</script>

<div class="flex min-h-screen w-full flex-col items-center justify-center bg-background text-foreground">
	<div class="container flex max-w-md flex-col items-center justify-center gap-4 text-center">
		<div class="space-y-2">
			<h1 class="text-4xl font-bold tracking-tight">{$page.status}</h1>
			<p class="text-lg text-muted-foreground">{$page.error?.message || 'Something went wrong'}</p>
		</div>
		
		<div class="mt-8">
			<Button href="/" variant="default">Return to home</Button>
		</div>
	</div>
</div>

<style>
	:global(body) {
		overflow: hidden;
	}
</style> 