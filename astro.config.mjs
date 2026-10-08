import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  session: false, // 자체 쿠키 기반 관리자 인증만 사용 — 불필요한 KV 바인딩 요구 방지
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: 'compile',
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
