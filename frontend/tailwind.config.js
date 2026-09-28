/** @type {import('tailwindcss').Config} */

// SECURIX 2.0 design tokens. A near-black graphite environment with soft
// white type, one electric indigo accent and three signal colours. Glow is
// reserved for meaning (a live state, a decision), never decoration.
const palette = {
  void: {
    950: "#040508",
    900: "#07080c", // page
    850: "#0a0c11",
    800: "#0e1016", // graphite
    700: "#14171f", // surface
    600: "#1b1f29", // elevated
    500: "#262b37", // hairline / track
  },
  accent: {
    soft: "#9db0ff",
    DEFAULT: "#6478ff",
    strong: "#4a5cf0",
  },
  violet: {
    DEFAULT: "#8d6bff",
    soft: "#b9a4ff",
  },
  signal: {
    amber: "#f3ad4b",
    emerald: "#35d99a",
    crimson: "#ff5468",
  },
  ink: {
    50: "#f8f9fc",
    100: "#eef0f6",
    300: "#a9b0c3",
    500: "#737b91",
    700: "#434a5d",
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
        // raised dark surface used by the app shell / cards ("paper" on the dark theme)
        paper: "#0d0f15",
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
        "primary-sweep": "linear-gradient(100deg, #6478ff 0%, #7d70ff 55%, #8d6bff 100%)",
      },
      boxShadow: {
        soft: "0 1px 0 rgba(255,255,255,0.04) inset, 0 18px 40px -18px rgba(0,0,0,0.7)",
        "soft-lg": "0 1px 0 rgba(255,255,255,0.05) inset, 0 40px 90px -30px rgba(0,0,0,0.85)",
        ambient: "0 30px 80px -40px rgba(0,0,0,0.9)",
        elevated: "0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 60px -24px rgba(0,0,0,0.85)",
        glow: "0 10px 34px -12px rgba(100,120,255,0.55)",
        "glow-lg": "0 24px 60px -18px rgba(100,120,255,0.5)",
        "glow-amber": "0 12px 34px -12px rgba(243,173,75,0.4)",
        "glow-crimson": "0 12px 34px -12px rgba(255,84,104,0.42)",
        "glow-emerald": "0 12px 34px -12px rgba(53,217,154,0.4)",
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
