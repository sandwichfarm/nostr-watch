<script lang="ts">
	import { onMount } from 'svelte';
  import type { Writable } from 'svelte/store';

  import { resultsPerPage as value } from '$lib/stores/datatable-settings';
	import type { DataTableConfig } from '../lists/table/DataTableTypes';

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
    config.update((currentConfig: DataTableConfig) => {
      Math.max(minValue, currentConfig.pageSize + direction * incrementStep)
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
    value.set(isNaN(inputValue) ? minValue : Math.max(minValue, inputValue));
  };

  onMount(() => {
    // Add listeners to the input element
    inputElement.addEventListener('keydown', handleKeydown);
    inputElement.addEventListener('keyup', handleKeyup);

    return () => {
      inputElement.removeEventListener('keydown', handleKeydown);
      inputElement.removeEventListener('keyup', handleKeyup);
    };
  });
</script>

    <input
        type="number"
        bind:value={$value}
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
  