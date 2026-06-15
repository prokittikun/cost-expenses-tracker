import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F5F6F8",
        card: "#FFFFFF",
        ink: "#1B2A4A",
        gold: "#D8A24A",
        jade: "#2F8F83",
        warn: "#C0492F",
        muted: "#6B7280",
      },
      fontFamily: {
        sans: ["var(--font-sans-thai)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
