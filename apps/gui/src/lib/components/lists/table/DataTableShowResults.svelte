<script lang="ts">
	import { onMount } from 'svelte';
  import type { Writable } from 'svelte/store';

	import type { DataTableConfig } from './DataTableTypes';

  export let config: Writable<DataTableConfig>;
  
  let holdTimeout: ReturnType<typeof setTimeout>, 
      interval: ReturnType<typeof setInterval>, 
      holdStart: number;

  const minValue = 20;
  let incrementStep = 5;
  let inputElement: HTMLInputElement;
  
  const startAdjusting = (direction: number) => {
    clearInterval(interval);
    clearTimeout(holdTimeout);
    holdStart = Date.now();
    adjustValue(direction);
    interval = setInterval(() => adjustValue(direction), 200);
    holdTimeout = setTimeout(() => {
      clearInterval(interval);
      incrementStep = 10; 
      interval = setInterval(() => adjustValue(direction), 200);
      holdTimeout = setTimeout(() => {
        clearInterval(interval);
        interval = setInterval(() => adjustValue(direction), 100);
      }, 3000); 
    }, 2000);
  };

  const stopAdjusting = () => {
    clearInterval(interval);
    clearTimeout(holdTimeout);
    incrementStep = 5; // Reset step to default
  };

  const adjustValue = (direction: number) => {
    if(!config) return;
    config.update( (currentConfig: DataTableConfig ) => {
      currentConfig.pageSize = Math.max(minValue, currentConfig.pageSize + direction * incrementStep);
      return currentConfig
    });
  };

  const handleKeydown = (event: KeyboardEvent) => {
    event.preventDefault();
    if (event.repeat) return;

    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      startAdjusting(1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      startAdjusting(-1);
    }
  };

  const handleKeyup = (event: KeyboardEvent) => {
    event.preventDefault();
    if (
      event.key === 'ArrowUp' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowLeft'
    ) {
      stopAdjusting();
    }
  };

  const handleInput = (e: Event) => {
    const inputValue = parseInt((e.target as HTMLInputElement).value, 10);
    config.update( currentConfig => {
      currentConfig.pageSize = isNaN(inputValue) ? minValue : Math.max(minValue, inputValue)
      return currentConfig;
    });
  
  };

  onMount(() => {
    if($config && !$config?.pageSize) {
        config.update( (currentConfig: DataTableConfig) => {
            currentConfig.pageSize = 50;
            return currentConfig;
        });
    } else {
      if($config && $config.pageSize < minValue) {
        config.update( (currentConfig: DataTableConfig) => {
            currentConfig.pageSize = isNaN(currentConfig.pageSize) ? minValue : Math.max(minValue, currentConfig.pageSize)
            return currentConfig;
        });
      }
    }
    // Add listeners to the input element
    inputElement.addEventListener('keydown', handleKeydown);
    inputElement.addEventListener('keyup', handleKeyup);

    return () => {
      inputElement.removeEventListener('keydown', handleKeydown);
      inputElement.removeEventListener('keyup', handleKeyup);
    };
  });

  $: pageSize = $config?.pageSize || 50;
</script>

<!-- <pre>{JSON.stringify($config, null, 2)}</pre> -->

  <input
      type="number"
      bind:value={pageSize}
      min={minValue}
      on:input={handleInput}
      bind:this={inputElement}
      />


<style>
  input {
    background: none;
    text-align: center;
    padding: 0.2rem;
    width: 3rem;
    position:relative;
    top: -0.2rem;
    display: inline-block;
    outline: none; 
    border:none;
  }
  input:focus {
    background:rgba(255,255,255,0.05);
    outline: none; 
    border:none;
  }

  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
  -webkit-appearance: none;
    margin: 0;
  }

  /* Firefox */
  input[type=number] {
    -moz-appearance: textfield;
  }
</style>
