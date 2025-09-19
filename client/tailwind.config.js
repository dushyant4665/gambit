
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1a1a1a',
          surface: '#2a2a2a',
          border: '#404040',
          text: '#ffffff',
          accent: '#4a90e2'
        }
      }
    },
  },
  plugins: [],
}
