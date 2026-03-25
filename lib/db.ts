/**
 * Neon PostgreSQL client.
 * Uses @neondatabase/serverless which works in serverless and edge environments.
 */

import { neon } from "@neondatabase/serverless";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export const sql = getDb();
