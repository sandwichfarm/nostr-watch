<script lang="ts"> 
    import type { Readable } from 'svelte/store';
    import type { PubkeyProfile } from '@nostrwatch/route66/models';
    import { nip05ResultsByPubkey } from '$stores/nip05s';
    import ValidIcon from 'lucide-svelte/icons/badge-check'; 
    import InvalidIcon from 'lucide-svelte/icons/circle-off'; 

    export let pubkey: string;
    export let profile: Readable<PubkeyProfile | undefined>;
    export let showNip05: boolean = false;

    $: nip05 = $profile?.nip05;
    $: nip05Valid = nip05? $nip05ResultsByPubkey.get(pubkey)?.valid === true: false;

</script>

<div>
  {#if nip05Valid}
    <ValidIcon class="w-4 h-4 inline-block mr-1 text-green-500" />
  {:else}
    <InvalidIcon class="w-4 h-4 inline-block mr-1 text-red-500" />
  {/if}
  {#if showNip05}
    {nip05}
  {/if}
</div>