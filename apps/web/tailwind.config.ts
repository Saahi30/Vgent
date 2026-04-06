import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        /* Carbon layer tokens */
        "layer-01": "hsl(var(--cds-layer-01))",
        "layer-02": "hsl(var(--cds-layer-02))",
        "layer-hover": "hsl(var(--cds-layer-hover))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius)",
        sm: "var(--radius)",
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex-sans)", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "Menlo", "Courier", "monospace"],
      },
      fontSize: {
        /* Carbon type scale */
        "caption-01": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.32px", fontWeight: "400" }],
        "body-short-01": ["0.875rem", { lineHeight: "1.125rem", letterSpacing: "0.16px", fontWeight: "400" }],
        "body-long-01": ["1rem", { lineHeight: "1.5rem", letterSpacing: "0", fontWeight: "400" }],
        "heading-03": ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "0", fontWeight: "400" }],
        "heading-04": ["1.5rem", { lineHeight: "2rem", letterSpacing: "0", fontWeight: "400" }],
        "heading-05": ["2rem", { lineHeight: "2.5rem", letterSpacing: "0", fontWeight: "300" }],
        "display-01": ["2.625rem", { lineHeight: "3.125rem", letterSpacing: "0", fontWeight: "300" }],
      },
      spacing: {
        /* Carbon 8px grid */
        "carbon-01": "2px",
        "carbon-02": "4px",
        "carbon-03": "8px",
        "carbon-04": "12px",
        "carbon-05": "16px",
        "carbon-06": "24px",
        "carbon-07": "32px",
        "carbon-08": "40px",
        "carbon-09": "48px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
