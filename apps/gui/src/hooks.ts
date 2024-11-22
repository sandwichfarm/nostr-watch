import type { Handle } from "@sveltejs/kit";

// Following config makes sure we never do server side rendering and are a simple SPA instead
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event, {
    ssr: false,
  });
  return response;
};