/// <reference types="svelte" />

declare namespace svelte.JSX {
    interface HTMLAttributes<T> {
      'on:viewportchange'?: (event: CustomEvent<{ isIntersecting: boolean; intersectionRatio: number }>) => void;
    }
  }