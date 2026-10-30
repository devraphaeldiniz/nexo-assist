import 'dotenv/config';
import { db } from '@/db';
import { migrate } from 'drizzle-orm/libsql/migrator';
import path from 'path';

const migrationsFolder = path.join(process.cwd(), 'drizzle');

console.log('Running migrations from:', migrationsFolder);

migrate(db, { migrationsFolder });

console.log('Migrations completed!');