/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Base surface scale — deep, neutral slate rather than a pure
        // "hacker terminal" black, so cards/borders/gradients have room
        // to read as premium instead of flat.
        void: {
          950: "#05060a",
          900: "#0a0c13",
          850: "#0d1019",
          800: "#12151f",
          700: "#181c28",
          600: "#212637",
          500: "#2c3346",
        },
        // Primary brand accent — a refined indigo-blue, replacing the
        // neon-cyan "cyber" look with something an enterprise dashboard
        // (Stripe/Linear/Mercury-adjacent) would actually ship.
        accent: {
          soft: "#8fa4ff",
          DEFAULT: "#5b6ef5",
          strong: "#4552d6",
        },
        // Secondary accent used only for gradient pairing / rare highlights.
        violet: {
          DEFAULT: "#9061f9",
          soft: "#b794f7",
        },
        signal: {
          amber: "#f0a63a",
          emerald: "#2fd487",
          crimson: "#f2495c",
        },
        ink: {
          50: "#f7f8fb",
          100: "#eceff5",
          300: "#a7aec2",
          500: "#727a90",
          700: "#454c60",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "aurora": "radial-gradient(60% 50% at 15% 0%, rgba(91,110,245,0.16), transparent 60%), radial-gradient(50% 40% at 85% 10%, rgba(144,97,249,0.12), transparent 60%)",
        "grid-fade": "radial-gradient(circle at 50% 0%, rgba(91,110,245,0.10), transparent 60%)",
        "card-sheen": "linear-gradient(150deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 40%)",
      },
      boxShadow: {
        soft: "0 1px 1px rgba(0,0,0,0.2), 0 16px 40px -16px rgba(0,0,0,0.55)",
        "soft-lg": "0 1px 1px rgba(0,0,0,0.25), 0 30px 70px -20px rgba(0,0,0,0.6)",
        glow: "0 12px 30px -10px rgba(91,110,245,0.45)",
        "glow-lg": "0 20px 50px -12px rgba(91,110,245,0.4)",
        "glow-amber": "0 12px 30px -10px rgba(240,166,58,0.35)",
        "glow-crimson": "0 12px 30px -10px rgba(242,73,92,0.35)",
        "glow-emerald": "0 12px 30px -10px rgba(47,212,135,0.35)",
      },
      keyframes: {
        pulseGlow: {
          "0%,100%": { opacity: 0.55 },
          "50%": { opacity: 1 },
        },
        floatSlow: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2.6s ease-in-out infinite",
        floatSlow: "floatSlow 6s ease-in-out infinite",
        fadeUp: "fadeUp 0.5s cubic-bezier(.22,1,.36,1) both",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};
