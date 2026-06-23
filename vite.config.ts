import { defineConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: 'vue',
      formats: ['es'],
      fileName: () => 'vue.js',
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: [
        '@endge/core',
        '@endge/utils',
        '@endge/raph',
        'vue',
        'pinia',
        'primevue',
        '@primevue/themes',
        'primeicons',
        'class-transformer',
        'class-validator',
        'reflect-metadata',
      ],
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'vue.css'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  plugins: [
    vue(),
    vueJsx(),
    dts({
      rollupTypes: false,
      tsconfigPath: path.resolve(__dirname, 'tsconfig.json'),
      include: ['src'],
      exclude: ['vite.config.ts', 'vitest.config.*'],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
