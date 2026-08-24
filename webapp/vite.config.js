import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/matches": "http://127.0.0.1:8000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.js",
    // Sin esto, vi.fn() de vi.mock() acarrea llamadas entre tests del mismo
    // archivo (ver mesa.test.jsx: un test de auto-play/timers detectó esto
    // al chocar con una llamada de un test previo que seguía en el historial).
    clearMocks: true,
  },
});
