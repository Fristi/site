import type { Preview } from "@storybook/react";
import "../src/styles/global.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "void",
      values: [
        { name: "void", value: "#ffffff" },
        { name: "surface-low", value: "#f1f5f9" },
        { name: "dark", value: "#0c0e12" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
