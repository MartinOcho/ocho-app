import type { Config } from "tailwindcss";
import { withUt } from "uploadthing/tw";

const config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        logo: {
          foreground: "hsl(var(--logo-foreground))",
          DEFAULT: "hsl(var(--logo))",
          background: "hsl(var(--logo-background))",
          text: "hsl(var(--logo-text))",
          icon: {
            DEFAULT: "hsl(var(--logo-icon))",
          },
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
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
        scale: {
          from: { transform: "scale(0)" },
          to: { transform: "scale(1)" },
        },
        "scale-down": {
          from: { transform: "scale(1)" },
          to: { transform: "scale(0)" },
        },
        "appear-x": {
          from: { opacity: "0", transform: "translateX(-100%)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "appear-y": {
          from: { opacity: "0", transform: "translateY(-100%)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "appear-r": {
          from: { opacity: "0", transform: "translateX(100%)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "appear-b": {
          from: { opacity: "0", transform: "translateY(100%)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        progress: {
          "0%": { transform: " translateX(0) scaleX(0)" },
          "40%": { transform: "translateX(0) scaleX(0.4)" },
          "100%": { transform: "translateX(100%) scaleX(0.5)" },
        },
        "bounce-half": {
          "0%, 100%": { transform: "translateY(25%)", opacity: "0.7" },
          "50%": { transform: "translateY(-25%)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        scale: "scale 300ms forwards",
        "scale-down": "scale-down 300ms forwards",
        "appear-x": "appear-x 300ms forwards",
        "appear-y": "appear-y 300ms forwards",
        "appear-r": "appear-r 300ms forwards",
        "appear-b": "appear-b 300ms forwards",
        progress: "progress 1s infinite linear",
        "bounce-half": "bounce-half 1s infinite",
      },
      transformOrigin: {
        'left-right': '0% 50%',
      },
      fontFamily: {
        emoji: ["var(--font-emoji)", "sans-serif"],
      }
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("tailwind-scrollbar")({ nocompatible: true }),
    require("@tailwindcss/container-queries"),
  ],
} satisfies Config;

export default withUt(config);
