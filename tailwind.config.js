/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bna: {
          anthracite: "#23272B",
          copper: {
            DEFAULT: "#D97732",
            hover: "#C36525",
            light: "#F5E4D6",
            dark: "#75401F",
          },
          offwhite: "#F5F4F0",
          border: "#E6E3DC",
          muted: "#777A78",
          warn: "#A96516",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-manrope)", "sans-serif"],
      },
      maxWidth: {
        mobile: "430px",
      },
      boxShadow: {
        copper: "0 4px 14px 0 rgba(217, 119, 50, 0.35)",
        floating: "0 4px 20px rgba(35, 39, 43, 0.15)",
      },
    },
  },
  plugins: [],
};
