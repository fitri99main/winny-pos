/** @type {import('tailwindcss').Config} */
const preset = require("./node_modules/nativewind/dist/tailwind/index");

module.exports = {
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [preset],
    theme: {
        extend: {
            colors: {
                'winny-primary': '#2563eb',
                'winny-secondary': '#4f46e5',
            },
        },
    },
    plugins: [],
}
