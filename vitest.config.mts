import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    // Os testes de integração batem no mesmo banco que `npm run dev` usa
    // (populado por `npm run db:seed`), então precisam do mesmo DB_PATH
    // do .env — vitest não carrega .env sozinho, então repassamos aqui.
    env: {
      DB_PATH: process.env.DB_PATH ?? './data/nexod.db',
    },
  },
});
