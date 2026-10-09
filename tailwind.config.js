/**
 * The colour families Casy's components use directly, read from variables so
 * dark mode can change them in one place (src/theme.css): Tailwind's own
 * values in light mode, each scale mirrored in dark mode.
 */
const THEMED_FAMILIES = [
  "amber",
  "blue",
  "emerald",
  "green",
  "neutral",
  "orange",
  "red",
  "rose",
  "sky",
  "violet",
  "zinc",
];
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const themed = Object.fromEntries(
  THEMED_FAMILIES.map((family) => [
    family,
    Object.fromEntries(
      SHADES.map((shade) => [shade, `rgb(var(--c-${family}-${shade}) / <alpha-value>)`]),
    ),
  ]),
);

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  // dark: is dark mode as src/theme.css decides it: the system's, unless the
  // profile forced light (theme-light) or dark (theme-dark) on <html>.
  darkMode: [
    "variant",
    [
      "@media (prefers-color-scheme: dark) { &:not(.theme-light, .theme-light *) }",
      "&:is(.theme-dark, .theme-dark *)",
    ],
  ],
  theme: {
    extend: {
      colors: {
        ...themed,
        // The main buttons: deep orange with white text in both themes (theme.css).
        cta: {
          DEFAULT: "rgb(var(--cta) / <alpha-value>)",
          hover: "rgb(var(--cta-hover) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        everyone: "hsl(var(--everyone))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
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
    },
  },
  plugins: [],
};
