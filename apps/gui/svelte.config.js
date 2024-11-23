import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [preprocess(), vitePreprocess({})],

  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      strict: false,
      fallback: 'index.html',
    }),
    prerender: {
      crawl: false,
      entries: ['/']  
    },
  }
};

export default config;
