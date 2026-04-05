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
        // Design system surface tiers (light)
        "void": "#ffffff",
        "surface-lowest": "#f8fafc",
        "surface-low": "#f1f5f9",
        "surface": "#e8edf2",
        "surface-high": "#dde3ea",
        "surface-highest": "#cdd5df",
        // Accent colors (deepened for light-mode contrast)
        "primary": "#0891b2",
        "primary-container": "#0e7490",
        "secondary": "#7c3aed",
        "secondary-container": "#ede9fe",
        // Text colors
        "on-surface": "#0f172a",
        "on-surface-variant": "#475569",
        "on-primary": "#ffffff",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#4c1d95",
        "outline-variant": "#94a3b8",
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
