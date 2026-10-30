import 'dotenv/config';
import { db } from '@/db';
import { users, helpArticles, tickets, ticketEvents, conversations, messages, drafts } from '@/db/schema';
import path from 'path';
import fs from 'fs';

async function reset() {
  console.log('Resetting database...');

  await db.delete(messages);
  await db.delete(conversations);
  await db.delete(ticketEvents);
  await db.delete(tickets);
  await db.delete(helpArticles);
  await db.delete(users);

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'nexo-assist.db');
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;

  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  console.log('Database reset completed!');
}

reset().catch(console.error);