import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'nexo-assist.db');

const client = createClient({
  url: `file:${DB_PATH}`,
});

export const db = drizzle(client, { schema });

export function getDb() {
  return db;
}