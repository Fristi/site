import defaultTheme from "tailwindcss/defaultTheme.js";
import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    fontFamily: {
      mono: ["Iosevka", ...defaultTheme.fontFamily.mono],
      condensed: [
        '"IBM Plex Sans Condensed"',
        '"Barlow Condensed"',
        '"Roboto Condensed"',
        '"HelveticaNeue-CondensedBold"',
        ...defaultTheme.fontFamily.sans,
      ],
    },
    extend: {
      animation: {
        "meteor-effect": "meteor 5s linear infinite",
      },
      keyframes: {
        meteor: {
          "0%": { transform: "rotate(215deg) translateX(0)", opacity: "1" },
          "70%": { opacity: "1" },
          "100%": {
            transform: "rotate(215deg) translateX(-500px)",
            opacity: "0",
          },
        },
      },
    },
  },
  plugins: [typography],
};
