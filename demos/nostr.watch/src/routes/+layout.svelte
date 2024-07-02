<svelte:head>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/svelte-material-ui@7.0.0/bare.min.css" />
</svelte:head>

<script>
    import { setContext } from "svelte"
import "../app.pcss";
import { EventEmitter } from "tseep";
setContext("signal", new EventEmitter());
</script>
<slot></slot>