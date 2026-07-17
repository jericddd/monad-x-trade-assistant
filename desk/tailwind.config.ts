import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        mp: {
          bg: "var(--mp-bg)",
          surface: "var(--mp-surface)",
          "surface-raised": "var(--mp-surface-raised)",
          border: "var(--mp-border)",
          violet: "var(--mp-violet)",
          "violet-bright": "var(--mp-violet-bright)",
          gold: "var(--mp-gold)",
          muted: "var(--mp-muted)",
          text: "var(--mp-text)",
          "text-secondary": "var(--mp-text-secondary)",
        },
        status: {
          unclaimed: "var(--mp-status-unclaimed)",
          claimed: "var(--mp-status-claimed)",
          expired: "var(--mp-status-expired)",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -8px var(--mp-glow)",
        card: "0 8px 32px -8px rgba(0, 0, 0, 0.5)",
      },
      transitionTimingFunction: {
        "mp-out": "var(--mp-ease-out)",
        "mp-spring": "var(--mp-ease-spring)",
      },
      animation: {
        "pack-shake": "pack-shake 0.6s ease-in-out infinite",
        "reveal-pop": "reveal-pop 0.45s var(--mp-ease-spring) forwards",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "progress-indeterminate": "progress-indeterminate 1.2s ease-in-out infinite",
        "fade-in": "fade-in var(--mp-duration-normal) var(--mp-ease-out) both",
        "slide-up": "slide-up var(--mp-duration-slow) var(--mp-ease-out) both",
        "slide-up-sheet": "slide-up-sheet var(--mp-duration-normal) var(--mp-ease-out) both",
        "scale-in": "scale-in var(--mp-duration-normal) var(--mp-ease-spring) both",
        "backdrop-fade-in": "fade-in var(--mp-duration-normal) ease-out both",
        "backdrop-fade-out": "fade-out var(--mp-duration-fast) ease-in both",
        "sheet-slide-out": "slide-down-sheet var(--mp-duration-fast) ease-in both",
      },
      keyframes: {
        "pack-shake": {
          "0%, 100%": { transform: "rotate(-1deg) scale(1)" },
          "50%": { transform: "rotate(1deg) scale(1.02)" },
        },
        "reveal-pop": {
          "0%": { opacity: "0", transform: "scale(0.92) translateY(12px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up-sheet": {
          from: { opacity: "0", transform: "translateY(100%)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down-sheet": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(100%)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
