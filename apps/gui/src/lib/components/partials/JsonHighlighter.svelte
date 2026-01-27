<script lang="ts">
    // import { onMount } from 'svelte';
    import { JsonHighlighter, type AjvResult } from '$lib/utils/JsonHighlighter.js';
  
    export let jsonString: string = '';
    export let ajvResult: AjvResult = { errors: [] };
  
    let highlightedHtml = '';  
    $: highlightedHtml = JsonHighlighter.highlight(jsonString, ajvResult);
  </script>
  
  {@html highlightedHtml}
  
  <style></style>
  