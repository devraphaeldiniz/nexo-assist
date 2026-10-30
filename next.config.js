const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Garante que as migrations SQL e o script de seed sejam incluídos no
  // bundle da função serverless — são lidos via `fs`/`import` dinâmico em
  // runtime (src/lib/ensure-db.ts), não via import estático, então o
  // tracing automático do Next não os detectaria por conta própria.
  outputFileTracingIncludes: {
    '/api/**': ['./drizzle/**/*', './scripts/seed.ts'],
  },
};

module.exports = nextConfig;
