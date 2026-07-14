/** @type {import('tailwindcss').Config} */
// FLOW tasarım sistemi — "Yüksek kontrastlı monokrom + Signal Blue" (Stitch).
// brand = Signal Blue: uygulama genelinde bg-brand/text-brand/border-brand kullanıldığı
// için tek yerden tüm arayüz bu renge geçer.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#276EF1', // Signal Blue — birincil aksiyon/aktif durum
          dark: '#0054cb', // hover
          light: '#dae2ff', // açık tint zemin
        },
        ink: '#1a1c1c', // ana metin (on-surface)
        muted: '#4c4546', // ikincil metin
        faint: '#7e7576', // en soluk metin / ikon
        line: '#e2e2e2', // kenarlık
        'line-strong': '#cfc4c5',
        surface: {
          DEFAULT: '#f9f9f9', // uygulama zemini
          card: '#ffffff', // kart zemini
          low: '#f3f3f3',
          high: '#e8e8e8',
        },
        sidebar: {
          DEFAULT: '#0a0a0a', // siyah sidebar
          hover: '#1f1f1f',
          muted: '#9a9a9a', // pasif nav metni
        },
        success: { DEFAULT: '#05a357', light: '#d7f5e6', fg: '#00391c' },
        danger: { DEFAULT: '#ba1a1a', light: '#ffdad6', fg: '#93000a' },
        warning: { DEFAULT: '#b45309', light: '#fef3c7' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Keskin, profesyonel: buton/input 4px, kart 8-10px.
        xl: '0.5rem', // 8px (varsayılan 12px'ten sertleştirildi)
        '2xl': '0.625rem', // 10px (varsayılan 16px'ten)
      },
      boxShadow: {
        // Minimal derinlik — yalnız yüzen öğeler (modal) için yumuşak gölge.
        card: '0 1px 2px rgba(0,0,0,0.04)',
        float: '0 4px 12px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
