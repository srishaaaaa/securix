/** @type {import('tailwindcss').Config} */

// SECURIX 2.0 design tokens. A near-black graphite environment with soft
// white type, one electric indigo accent and three signal colours. Glow is
// reserved for meaning (a live state, a decision), never decoration.
// SECURIX 4 - light premium. "void" stays the background scale and "ink"
// the text scale, so every component flips with the tokens.
const palette = {
  void: {
    950: "#ffffff",
    900: "#f5f6fa", // page
    850: "#f0f2f7",
    800: "#e9ecf3",
    700: "#e2e6ef",
    600: "#d5dae6",
    500: "#c3c9d8",
  },
  accent: {
    soft: "#4f46e5",
    DEFAULT: "#3d3dff", // electric indigo - the one "neon" accent
    strong: "#2a2ad9",
  },
  violet: {
    DEFAULT: "#7c3aed",
    soft: "#7c3aed",
  },
  signal: {
    amber: "#c26a00",
    emerald: "#047857",
    crimson: "#d61f45",
  },
  ink: {
    50: "#07080d",
    100: "#14161f",
    300: "#474d60",
    500: "#6d7488",
    700: "#a0a6b6",
  },
};

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      screens: {
        xs: "400px",
        "3xl": "1800px",
      },
      colors: {
        ...palette,
        // "white" is only used as a hairline / tint colour (border-white/[0.07],
        // bg-white/[0.03] ...). On the light theme those must be dark tints.
        white: "#0b0d14",
        paper: "#ffffff",
        // semantic aliases
        graphite: palette.void[800],
        surface: palette.void[700],
        elevated: palette.void[600],
        hairline: "rgba(255,255,255,0.08)",
        primary: { DEFAULT: palette.accent.DEFAULT, soft: palette.accent.soft },
        success: palette.signal.emerald,
        warning: palette.signal.amber,
        danger: palette.signal.crimson,
        muted: palette.ink[500],
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        // fluid editorial scale: phone -> large desktop
        "mega": ["clamp(3.4rem, 13vw, 12.5rem)", { lineHeight: "0.86", letterSpacing: "-0.055em" }],
        "giant": ["clamp(2.7rem, 8.5vw, 8rem)", { lineHeight: "0.9", letterSpacing: "-0.045em" }],
        "huge": ["clamp(2.2rem, 5.6vw, 5rem)", { lineHeight: "0.95", letterSpacing: "-0.04em" }],
        "big": ["clamp(1.75rem, 3.4vw, 3rem)", { lineHeight: "1", letterSpacing: "-0.03em" }],
        "micro": ["0.625rem", { lineHeight: "1rem", letterSpacing: "0.18em" }],
      },
      borderRadius: {
        pill: "999px",
        card: "1.25rem",
        panel: "1.75rem",
      },
      backgroundImage: {
        aurora:
          "radial-gradient(55% 45% at 12% 0%, rgba(100,120,255,0.13), transparent 62%), radial-gradient(45% 40% at 88% 6%, rgba(141,107,255,0.09), transparent 62%)",
        "grid-fade": "radial-gradient(circle at 50% 0%, rgba(100,120,255,0.09), transparent 60%)",
        "card-sheen": "linear-gradient(150deg, rgba(255,255,255,0.055), rgba(255,255,255,0) 38%)",
        "primary-sweep": "linear-gradient(100deg, #3d3dff 0%, #5b3df5 55%, #7c3aed 100%)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,20,40,0.05), 0 12px 32px -16px rgba(16,20,40,0.18)",
        "soft-lg": "0 1px 2px rgba(16,20,40,0.06), 0 30px 70px -30px rgba(16,20,40,0.28)",
        ambient: "0 30px 80px -40px rgba(16,20,40,0.3)",
        elevated: "0 1px 0 rgba(255,255,255,0.9) inset, 0 24px 60px -28px rgba(16,20,40,0.3)",
        glow: "0 10px 30px -12px rgba(61,61,255,0.45)",
        "glow-lg": "0 24px 60px -18px rgba(61,61,255,0.4)",
        "glow-amber": "0 12px 34px -12px rgba(194,106,0,0.3)",
        "glow-crimson": "0 12px 34px -12px rgba(214,31,69,0.3)",
        "glow-emerald": "0 12px 34px -12px rgba(4,120,87,0.3)",
      },
      transitionTimingFunction: {
        cine: "cubic-bezier(.22,1,.36,1)",
      },
      keyframes: {
        pulseGlow: { "0%,100%": { opacity: 0.5 }, "50%": { opacity: 1 } },
        floatSlow: { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-12px)" } },
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(14px)", filter: "blur(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
        },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        scan: { "0%": { transform: "translateY(-10%)" }, "100%": { transform: "translateY(1000%)" } },
        scanY: { "0%": { top: "0%" }, "50%": { top: "calc(100% - 2px)" }, "100%": { top: "0%" } },
        spinSlow: { to: { transform: "rotate(360deg)" } },
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "20%,60%": { transform: "translateX(-4px)" },
          "40%,80%": { transform: "translateX(4px)" },
        },
        blink: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.25 } },
        drawIn: { from: { strokeDashoffset: "var(--dash, 60)" }, to: { strokeDashoffset: "0" } },
      },
      animation: {
        pulseGlow: "pulseGlow 2.6s ease-in-out infinite",
        floatSlow: "floatSlow 7s ease-in-out infinite",
        fadeUp: "fadeUp 0.7s cubic-bezier(.22,1,.36,1) both",
        shimmer: "shimmer 2.5s linear infinite",
        scanY: "scanY 3.2s cubic-bezier(.45,0,.55,1) infinite",
        spinSlow: "spinSlow 24s linear infinite",
        spinSlower: "spinSlow 60s linear infinite",
        shake: "shake 0.45s cubic-bezier(.36,.07,.19,.97) both",
        blink: "blink 1.4s ease-in-out infinite",
        drawIn: "drawIn 0.6s cubic-bezier(.22,1,.36,1) both",
      },
    },
  },
  plugins: [],
};
