<script>
    import Masonry from 'svelte-bricks'
  
    let nItems = 30
    $: items = [
        'general',
        'network',
        'insights',
        'checks',
        'map',
        
    ]
  
    let [minColWidth, maxColWidth, gap] = [200, 800, 20]
    let width, height
  </script>
  
  <Masonry
    {items}
    {minColWidth}
    {maxColWidth}
    {gap}
    let:item
    bind:width
    bind:height
  >
    {#if item === 'map'}

    {/if}
    {#if item === 'network'}

    {/if}
    {#if item === 'insights'}

    {/if}
    {#if item === 'checks'}

    {/if}
    {#if item === 'general'}

    {/if}
    {#if item === 'map'}

    {/if}
  </Masonry>