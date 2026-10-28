# Nexo Assist - Dockerfile para deploy com SQLite persistente
# Requer volume persistente em /app/data

FROM node:20-alpine AS base

# Instalar dependências do sistema para better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY drizzle.config.ts ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY src ./src
COPY public ./public
COPY next.config.js ./
COPY tsconfig.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./

# Build
RUN npm run build

# Criar diretório de dados
RUN mkdir -p /app/data

# Expor porta
EXPOSE 3000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV DB_PATH=/app/data/nexod.db

# Comando de inicialização
CMD ["npm", "run", "start"]