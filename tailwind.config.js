/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        ufc: {
          red: "#D20A0A",
          "red-bright": "#FF2525",
          "red-dark": "#A00808",
          "red-glow": "rgba(210, 10, 10, 0.35)",
          gold: "#F5A623",
          // Deep blue-dark palette — more vibrant than pure black
          dark: "#0D0F18",
          "dark-2": "#131520",
          "dark-3": "#1B1D2C",
          "dark-4": "#232538",
          gray: "#30324A",
          "gray-2": "#43456A",
          "gray-light": "#8E90B0",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-bebas)", "Impact", "sans-serif"],
      },
      // ── Global font-size bump (+1–2px across the board for WCAG readability) ──
      fontSize: {
        "2xs": ["11px", { lineHeight: "16px" }],
        xs:    ["13px", { lineHeight: "18px" }],
        sm:    ["15px", { lineHeight: "22px" }],
        base:  ["17px", { lineHeight: "26px" }],
        lg:    ["19px", { lineHeight: "28px" }],
        xl:    ["22px", { lineHeight: "30px" }],
        "2xl": ["26px", { lineHeight: "34px" }],
        "3xl": ["30px", { lineHeight: "38px" }],
        "4xl": ["36px", { lineHeight: "44px" }],
        "5xl": ["48px", { lineHeight: "1" }],
        "6xl": ["60px", { lineHeight: "1" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-red": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(210, 10, 10, 0)" },
          "50%": { boxShadow: "0 0 24px 6px rgba(210, 10, 10, 0.45)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s infinite linear",
        "pulse-red": "pulse-red 2.5s infinite",
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      backgroundImage: {
        "shimmer-gradient":
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
        "card-gradient":
          "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)",
        "red-gradient":
          "linear-gradient(135deg, #D20A0A 0%, #FF2525 100%)",
      },
      boxShadow: {
        "card": "0 2px 16px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3)",
        "card-hover": "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)",
        "red-glow": "0 0 24px rgba(210,10,10,0.3), 0 0 8px rgba(210,10,10,0.2)",
        "red-glow-lg": "0 0 40px rgba(210,10,10,0.35), 0 0 16px rgba(210,10,10,0.2)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
