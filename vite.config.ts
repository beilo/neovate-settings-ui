import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 为什么：Tauri 配置里写死了 devUrl=5173，避免端口漂移导致 tauri dev 拉不起来。
    port: 5173,
    strictPort: true,
  },
})
