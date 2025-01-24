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
        '/operators',
        '/operators/[operator]',
        '/relays',
        '/relays/map',
        '/relays/[protocol]/[...relay]',
        '/reload/[...path]',
        '/unsupported',
        '/mobile',
        '/relays/software',
        '/relays/software/[name]',
        '/relays/geography',
        '/relays/geography/[country]',
        '/relays/isps',
        '/relays/isps/[isp]',

        '/note/[id]',
        '/preferences',
      ]
    },
  }
};

export default config;
