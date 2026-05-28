import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const {
  POSTGRES_HOST = 'localhost',
  POSTGRES_PORT = '5432',
  POSTGRES_USER = 'qnya',
  POSTGRES_PASSWORD,
  POSTGRES_DB = 'qnya'
} = process.env;

export default defineConfig({
  out: './drizzle',
  schema: './src/db/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`
  }
});
