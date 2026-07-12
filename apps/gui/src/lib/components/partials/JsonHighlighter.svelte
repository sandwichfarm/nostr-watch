<script lang="ts">
  import { JsonHighlighter, type AjvResult } from '$lib/utils/JsonHighlighter.js';
  import { sanitizedHtml } from '$utils/sanitize';

  export let jsonString: string = '';
  export let ajvResult: AjvResult = { errors: [] };

  let highlightedHtml = '';
  $: highlightedHtml = JsonHighlighter.highlight(jsonString, ajvResult);
</script>

<div use:sanitizedHtml={highlightedHtml}></div>

<style></style>
