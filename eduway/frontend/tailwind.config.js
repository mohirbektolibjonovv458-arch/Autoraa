/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"] },
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        muted: v("muted"),
        line: v("line"),
        ink: v("ink"),
        sub: v("sub"),
        brand: { DEFAULT: v("brand"), soft: v("brand-soft"), ink: v("brand-ink") },
        navy: { DEFAULT: "#0B1030", 800: "#121A45", 700: "#1B2560" },
        ok: v("ok"),
        warn: v("warn"),
        bad: v("bad"),
      },
      borderRadius: { xl: "14px", "2xl": "20px", "3xl": "28px" },
      boxShadow: {
        card: "0 1px 2px rgb(15 20 60 / 0.04), 0 8px 24px -12px rgb(15 20 60 / 0.12)",
        lift: "0 12px 32px -12px rgb(76 59 230 / 0.35)",
      },
      keyframes: {
        "fade-up": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
        float: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(-12px,10px) scale(1.08)" } },
        page: { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } },
        "pop": { "0%": { transform: "scale(.9)", opacity: 0 }, "60%": { transform: "scale(1.03)", opacity: 1 }, "100%": { transform: "scale(1)" } },
        "shimmer": { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        "float": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        "draw": { from: { strokeDashoffset: 120 }, to: { strokeDashoffset: 0 } },
      },
      animation: {
        "fade-up": "fade-up .35s cubic-bezier(.2,.7,.2,1) both",
        float: "float 7s ease-in-out infinite",
        page: "page .28s cubic-bezier(.2,.7,.2,1) both",
        pop: "pop .45s cubic-bezier(.2,.7,.2,1) both",
        shimmer: "shimmer 1.6s linear infinite",
        float: "float 4s ease-in-out infinite",
        draw: "draw 1.1s ease-out both",
      },
    },
  },
  plugins: [],
};
