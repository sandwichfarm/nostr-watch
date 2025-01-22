import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [preprocess(), vitePreprocess({})],

  kit: {
    adapter: adapter({
      pages: "dist",
      assets: "dist",
      strict: false,
      fallback: 'index.html',
    }),
    prerender: {
      crawl: false,
      entries: [
        '/',
        '/monitors',
        '/monitors/[pubkey]',
        '/note/[id]',
        '/preferences',
        '/relays',
        '/relays/map',
        '/relays/[protocol]/[...relay]',
        '/reload/[...path]',
        '/unsupported',
        '/mobile',
        '/software',
        '/software/[name]'
      ]
    },
  }
};

export default config;
