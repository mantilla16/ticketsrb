import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Ruta pública bajo la que se sirve la aplicación. Va por entorno y no por
  // el flag --base: un argumento que empieza por «/» lo pueden reescribir
  // algunos shells antes de que Vite lo vea, y el fallo es silencioso —el
  // build termina bien pero los assets apuntan a otro sitio.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173 },
});
