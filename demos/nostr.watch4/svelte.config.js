import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRootDir = `${__dirname}/src`;

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: preprocess(),
	prerender: { enabled: false },

  kit: {
    adapter: adapter({ pages: "public", fallback: "index.html" })
  },
};

export default config;