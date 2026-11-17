import { createDataSource } from './database.config.js';
// CLI needs only DATABASE_URL. JWT and HTTP settings are irrelevant to schema management.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
export default createDataSource(databaseUrl);
