import { derived } from 'svelte/store';
import { checks } from './checks.js'; 

export const softwares = derived(checks, ($checks) => {
  const software = new Set();

  $checks.forEach((check) => {
    if(check?.software)
        software.add(check.software);
  });

  return Array.from(software);
});