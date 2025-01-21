import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config({
  path: '.local.env',
});

const cnf = defineConfig({
  dialect: 'postgresql',
  out: 'db/migrations',
  schema: 'db/schema',
  dbCredentials: {
    url: String(process.env['DATABASE_URL']),
  },
});

export default cnf;
