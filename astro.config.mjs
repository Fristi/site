import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import netlify from "@astrojs/netlify/functions";
import react from "@astrojs/react";

import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  site: "https://markdejong.org",
  integrations: [tailwind(), react(), mdx()],
  markdown: {
    shikiConfig: {
      theme: "github-light",
      wrap: false,
    },
  },
  output: "server",
  adapter: netlify(),
});
