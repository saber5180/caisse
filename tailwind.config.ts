import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        md: "6px",
        lg: "8px",
        xl: "8px",
        "2xl": "10px",
        "3xl": "12px",
      },
      colors: {
        rose: {
          50: "#F8F4F2",
          100: "#F3EBE7",
          200: "#E6D5CE",
          300: "#D4B8AD",
          400: "#C08E80",
          500: "#B07A6C",
          600: "#8E5A4E",
          700: "#73483F",
          800: "#5A382F",
          900: "#3E261F",
          950: "#2A1915",
        },
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.03), 0 6px 20px -4px rgb(15 23 42 / 0.05)",
        "card-lg":
          "0 4px 12px -2px rgb(15 23 42 / 0.06), 0 18px 36px -6px rgb(15 23 42 / 0.11)",
        obsidian:
          "0 12px 32px -6px rgb(2 6 23 / 0.45), inset 0 1px 0 0 rgb(255 255 255 / 0.08)",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.28s cubic-bezier(0.16, 1, 0.3, 1) backwards",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) backwards",
      },
    },
  },
  plugins: [],
};
export default config;
