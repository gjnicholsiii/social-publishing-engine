import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not configured');

export const sql = postgres(connectionString, {
  ssl: 'require',
  max: 4,
  idle_timeout: 20,
  connect_timeout: 10,
});
