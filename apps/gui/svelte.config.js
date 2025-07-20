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
      precompress: true
    }),
    prerender: {
      entries: [] // Disable prerendering for pure SPA
    },
  }
};

export default config;
