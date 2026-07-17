/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          950: "#070a12",
          900: "#0a0e17",
          800: "#0f1420",
          700: "#141a29",
          600: "#1b2333",
        },
        cyan: {
          glow: "#22d3ee",
        },
        signal: {
          amber: "#f5a623",
          emerald: "#34d399",
          crimson: "#f4415e",
        },
        ink: {
          100: "#e7ecf3",
          300: "#aab4c4",
          500: "#7c8797",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "grid-fade": "radial-gradient(circle at 50% 0%, rgba(34,211,238,0.08), transparent 60%)",
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(34,211,238,0.35)",
        "glow-amber": "0 0 40px -8px rgba(245,166,35,0.35)",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        pulseGlow: {
          "0%,100%": { opacity: 0.6 },
          "50%": { opacity: 1 },
        },
        floatSlow: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        scanline: "scanline 2.8s ease-in-out infinite",
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        floatSlow: "floatSlow 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
