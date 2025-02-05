<script lang="ts">
	import { page } from '$app/stores';
import * as Card from '$lib/components/ui/card';
	import { getRelayErrors$, relaysErrors } from '$stores/relay-errors';
	import { relays } from '$stores/relays';
	import { findValidRelayPath, generateRelayUrlFromPath } from '$utils/routing';
	import { stringify } from 'json-source-map';

const relayUrl = generateRelayUrlFromPath() as string;
const errors = getRelayErrors$(relayUrl);
</script>

<Card.Root class="w-full bg-gray-900/5 border-white/10 rounded-[3px]">
    <Card.Header>
        <Card.Title class='font-mono text-white/80'>issues</Card.Title>  
    </Card.Header>  
    <Card.Content>
        <pre>
            {JSON.stringify($relaysErrors || {}, null, 2)}
        </pre>
    </Card.Content>
    <Card.Footer>
        <!-- <Button>
            Details
        </Button> -->
    </Card.Footer>
</Card.Root>