/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './studio.html', './assets/**/*.js'],
    theme: {
        extend: {
            colors: { navy: '#121C26', terra: '#A65B45', light: '#F8F9FA', sand: '#F3D2BF' },
            fontFamily: { sans: ['Inter', 'sans-serif'], serif: ['Cormorant Garamond', 'serif'] }
        }
    },
    plugins: []
};
