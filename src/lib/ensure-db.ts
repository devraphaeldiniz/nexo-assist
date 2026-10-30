import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'nexo-assist.db');

let ensured: Promise<void> | null = null;

/**
 * Em ambientes efêmeros (ex.: funções serverless na Vercel), o arquivo
 * SQLite não existe ainda na primeira requisição de uma instância "fria" —
 * não há passo manual de `npm run db:migrate && npm run db:seed` como em
 * desenvolvimento local. Esta função garante que o schema e os dados de
 * demonstração existam antes de qualquer rota usar o banco.
 *
 * Em dev local o arquivo já existe (criado pelos scripts db:migrate/db:seed),
 * então isso é um no-op. Em produção com disco persistente (fora do escopo
 * deste desafio) também seria um no-op após a primeira execução.
 */
export function ensureDb(): Promise<void> {
  if (!ensured) {
    ensured = ensureDbOnce().catch((err) => {
      // Permite tentar novamente na próxima chamada em vez de ficar
      // permanentemente "travado" com uma falha de uma tentativa anterior.
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

async function ensureDbOnce(): Promise<void> {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const { db } = await import('@/db');
  const { sql } = await import('drizzle-orm');

  // `@libsql/client` cria o arquivo (vazio) na primeira conexão, então a
  // existência do arquivo não indica que o schema já foi aplicado. Testamos
  // se a tabela `users` responde; se não, aplicamos migrations + seed.
  const schemaReady = await db
    .run(sql`select 1 from users limit 1`)
    .then(() => true)
    .catch(() => false);

  if (schemaReady) return;

  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const migrationsFolder = path.join(process.cwd(), 'drizzle');

  await migrate(db, { migrationsFolder });

  const { seed } = await import('../../scripts/seed');
  await seed();
}
