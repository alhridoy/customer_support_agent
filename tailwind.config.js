/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'aven-blue': '#1e40af',
        'aven-green': '#10b981',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
