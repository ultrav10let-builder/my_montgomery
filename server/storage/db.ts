import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "cache.sqlite");
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize DB from schema.sql
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// The schema is in the same directory as this file (server/storage)
const schemaPath = path.join(__dirname, "schema.sql");

if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
}

export default db;
