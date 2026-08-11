/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1200px" },
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        ring: "var(--ring)",
        input: {
          DEFAULT: "var(--input)",
          background: "var(--input-background)",
        },
        // Warm neutrals aligned with prototype foreground / surfaces
        sawaka: {
          50: "#faf9f7",
          100: "#f5f1ed",
          200: "#e8e3dd",
          300: "#d6cfc6",
          400: "#a8998c",
          500: "#ff6b35",
          600: "#e85a28",
          700: "#6b5d4f",
          800: "#4a3f35",
          900: "#3d3028",
        },
        cream: {
          50: "#fffcf8",
          100: "#f9f6f3",
          200: "#f5f1ed",
          300: "#e8e3dd",
          400: "rgba(107, 93, 79, 0.2)",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "Lora",
          "ui-serif",
          "Georgia",
          "serif",
        ],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "calc(var(--radius) - 2px)",
        md: "var(--radius)",
        lg: "calc(var(--radius) + 0.125rem)",
        xl: "calc(var(--radius) + 0.25rem)",
        "2xl": "calc(var(--radius) + 0.5rem)",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(61, 48, 40, 0.06)",
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.08)",
      },
      ringColor: {
        DEFAULT: "var(--ring)",
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            color: theme("colors.foreground"),
            a: { color: theme("colors.primary.DEFAULT") },
            h1: { fontFamily: theme("fontFamily.display").join(",") },
            h2: { fontFamily: theme("fontFamily.display").join(",") },
            h3: { fontFamily: theme("fontFamily.display").join(",") },
            h4: { fontFamily: theme("fontFamily.display").join(",") },
          },
        },
      }),
    },
  },
  plugins: [require("@tailwindcss/typography"), require("@tailwindcss/forms")],
};
