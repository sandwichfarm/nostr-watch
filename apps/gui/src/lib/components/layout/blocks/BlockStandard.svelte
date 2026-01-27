<script lang="ts">
    export let classes: string = '';
    export let shadow: boolean = true;
</script>
<div class="block {classes} {shadow? 'shadow' : ''}">
    <div class="block-inner">
        <div class="block-header">
            <slot name="text" />
            <slot name="id" />
        </div>
        <div class="block-content">
            <slot></slot>
        </div>
        <div class="block-footer">
            <slot name="footer" />
        </div>
    </div>
</div>

<style lang="postcss">
    .block {
		@apply 
            ml-10 mt-10
			border-white/5 border-[2px] 
			bg-white/10 dark:bg-black/10 hover:bg-white/15 
            shadow-start hover:shadow-end transition-shadow duration-200
			pt-5 pb-10 px-10 m-5 
	}

    .shadow {
        @apply shadow-start hover:shadow-end transition-shadow duration-200;
    }

	.block:hover {
		@apply bg-white/20 dark:bg-black/15;
	}
</style>