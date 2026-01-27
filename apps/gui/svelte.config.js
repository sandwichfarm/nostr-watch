import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [preprocess(), vitePreprocess({})],

  kit: {
    alias: {
      "$stores": "./src/lib/stores",
			"$utils": "./src/lib/utils",
      "$ui": "./src/lib/components/ui",
			"$components": "./src/components",
			"$layouts": "./src/layouts",
			"$routes": "./src/routes",
      "$relay": './src/routes/relays/[protocol]/[...relay]',
      "$relays": './src/routes/relays',
			"$lib": "./src/lib",
      "$src": "./src"
    },
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
        '/relays/software',
        '/relays/software/[name]',
        '/relays/geography',
        '/relays/geography/[country]',
        '/relays/isps',
        
        '/relays/[protocol]',
        '/relays/[protocol]/[...relay]',
        '/relays/[protocol]/[...relay]/audits',
        '/relays/[protocol]/[...relay]/checks',
        '/relays/[protocol]/[...relay]/feed',
        '/relays/[protocol]/[...relay]/insights',
        '/relays/[protocol]/[...relay]/nip-11',
        '/relays/[protocol]/[...relay]/operator',
        
        '/reload/[...path]',
        '/unsupported',
        '/mobile',
        
        '/relays/isps/[isp]',

        '/note/[id]',
        '/preferences',
      ]
    },
  }
};

export default config;
