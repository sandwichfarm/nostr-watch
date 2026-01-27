<script lang="ts">
    export let path: string;
    import { onMount } from 'svelte'
    import { writable, type Writable } from 'svelte/store';
    const loading: Writable<boolean> = writable(true)
    const error: Writable<boolean> = writable(false)
    let component = undefined

    onMount( () => {
        console.log('loading', path)
        import(path)
            .then((c) => {
                loading.set(false)
                component = c.default
            })
            .catch((error) => {
                console.error(error)
            })
    })
</script>
{#if $loading}
    {#if $error}
        Failed to load component
    {:else}
        Loading...
    {/if}
{:else}
    <svelte:component this={component} />
{/if}   