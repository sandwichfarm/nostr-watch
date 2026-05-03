<script lang="ts">
	import CountCard from "$routes/(components)/CountCard.svelte";
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
    // CountCard's value-display gate requires a defined `$value`. We pass a
    // sentinel readable (the coerced numeric amount as a string) so the gate
    // resolves true; the actual rendered value comes from the default slot
    // below, where Number(amount) does the CARD-03 coercion in template
    // text-bind context.
    $: valueSentinel = readable(String(Number(amount)));
</script>

<!-- {key}

<pre>{JSON.stringify(fee)}</pre> -->

<CountCard
    class={className}
    value={valueSentinel}
    label={key}
    {bottomText}
    >
    <span>{Number(amount)}<span class="text-sm">sats</span></span>
</CountCard>
