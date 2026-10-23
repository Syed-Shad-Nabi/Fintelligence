/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   "#f1f5f9",
          secondary: "#ffffff",
          card:      "#ffffff",
          hover:     "#f8fafc",
        },
        brand: {
          blue:   "#2563eb",
          purple: "#4f46e5",
          cyan:   "#0891b2",
        },
        fin: {
          green:  "#16a34a",
          red:    "#dc2626",
          amber:  "#d97706",
          yellow: "#ca8a04",
        },
        slate: {
          text:   "#64748b",
          muted:  "#94a3b8",
          border: "#e2e8f0",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card:  "0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.05)",
        "card-md": "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
      },
    },
  },
  plugins: [],
};
