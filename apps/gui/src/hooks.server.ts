import type { Handle } from "@sveltejs/kit";

// Following config makes sure we never do server side rendering and are a simple SPA instead
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event, {
    ssr: false,
  });

  // OPFS/SQLite requires SharedArrayBuffer/Atomics, which requires cross-origin isolation.
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");

  return response;
};
