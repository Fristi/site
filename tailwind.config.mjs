import defaultTheme from "tailwindcss/defaultTheme.js";
import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
    "./.storybook/**/*.{ts,tsx}",
  ],
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
      display: ["Manrope", ...defaultTheme.fontFamily.sans],
      body: ["Inter", ...defaultTheme.fontFamily.sans],
    },
    extend: {
      colors: {
        // Design system surface tiers
        "void": "#0c0e12",
        "surface-lowest": "#0e1014",
        "surface-low": "#111318",
        "surface": "#161a20",
        "surface-high": "#1d2025",
        "surface-highest": "#232830",
        // Accent colors
        "primary": "#99f7ff",
        "primary-container": "#00f1fe",
        "secondary": "#a68cff",
        "secondary-container": "#2d2060",
        // Text colors
        "on-surface": "#e2e3e8",
        "on-surface-variant": "#aaabb0",
        "on-primary": "#0c0e12",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#d0c0ff",
        "outline-variant": "#44464f",
      },
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
