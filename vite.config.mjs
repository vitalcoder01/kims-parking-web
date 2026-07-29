import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// tsconfigRaw pins the only TS transform options esbuild needs, which stops
// it walking up the directory tree and tripping over the unrelated
// C:\Users\<user>\tsconfig.json (a React Native config whose base package
// isn't installed there — the "Cannot find base config file" warning).
const tsconfigRaw = {
  compilerOptions: {
    target: 'ES2020',
    useDefineForClassFields: true,
  },
};

export default defineConfig({
  plugins: [react()],
  // host: true binds 0.0.0.0 so a phone on the same Wi-Fi can reach this via
  // the machine's LAN IP (not just localhost) — needed to test the PWA
  // install flow on an actual mobile device.
  server: {port: 5173, host: true},
  esbuild: {tsconfigRaw},
  optimizeDeps: {esbuildOptions: {tsconfigRaw: JSON.stringify(tsconfigRaw)}},
});
