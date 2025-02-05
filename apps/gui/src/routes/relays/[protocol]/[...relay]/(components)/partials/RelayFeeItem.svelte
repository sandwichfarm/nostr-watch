<script lang="ts">
	import CountCard from "$routes/components/CountCard.svelte";
	import { formatSeconds } from "$utils/time";
	import { readable } from "svelte/store";

    type Nip11Fee = {
        amount: number,
        unit: string,
        period?: number
    } 


    export let key: string; 
    export let fee: Nip11Fee;
    const className = $$props.class

    $: unit = fee?.unit || 'msats'
    $: amount = unit === 'msats'
        ? fee.amount/1000
        : fee.amount;
    $: bottomText = key === 'admission'
        ? 'Admission fee'
        : key === 'publication'
            ? 'Per publication'
                : fee?.period
                    ? formatSeconds(fee?.period)
                    : undefined
</script>

<!-- {key}

<pre>{JSON.stringify(fee)}</pre> -->

<CountCard
    class={className}
    value={readable(`${amount}<span class="text-sm">sats</span>`)}
    label={key}
    {bottomText}
    />