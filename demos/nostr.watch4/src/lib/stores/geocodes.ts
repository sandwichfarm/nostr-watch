import { derived } from 'svelte/store';
import { events } from './events.js'; 

export const geocodes = derived(events, ($events) => {
  const codes = new Set();

  $events.forEach((event) => {
    event.tags.forEach((tag: string[]) => {
        if (tag[0] === 'l' && tag[2].toLowerCase().includes('country'))  {
            codes.add(tag[1]);
        }
    })
  });

  return Array.from(codes).map((code) => {
    code = String(code).trim()
    const isNumber = !isNaN(Number(code)) && code !== ''
    return {
        code,
        type: 'ISO-3166-1',
        format: isNumber? 'numeric' : 'alpha',
        length: isNumber? undefined: (code as unknown as string).length
    }
  });
});