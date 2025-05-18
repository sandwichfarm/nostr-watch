import { error } from '@sveltejs/kit';
import type { LoadEvent } from '@sveltejs/kit';

export function load({ params }: LoadEvent) {
  const { protocol } = params;

  // Only allow 'ws' or 'wss' as valid protocols
  if (protocol !== 'ws' && protocol !== 'wss') {
    throw error(400, {
      message: `Invalid protocol: ${protocol}. Only 'ws' and 'wss' are supported.`
    });
  }

  return {
    protocol
  };
} 