import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0B3C8C",
        secondary: "#1DA1F2",
        light: "#F5F9FF",
        accent: "#4FC3F7",
      },
    },
  },
  plugins: [],
};

export default config;