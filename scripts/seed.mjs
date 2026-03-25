/**
 * Database seed script — run ONCE to create the users table and add the admin user.
 *
 * Usage:
 *   1. Make sure .env.local has DATABASE_URL=<your-neon-connection-string>
 *   2. Run: node scripts/seed.mjs
 */

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";

// Manually load .env.local (Node doesn't auto-load it)
try {
  const env = readFileSync(".env.local", "utf-8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not found — assume env vars are already set
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function seed() {
  console.log("📦  Creating users table...");
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(50)  UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      email         VARCHAR(255) UNIQUE,
      role          VARCHAR(20)  NOT NULL DEFAULT 'user',
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓  Table ready.");

  console.log("🔐  Hashing admin password...");
  const hash = await bcrypt.hash("admin", 12);

  console.log("👤  Seeding admin user...");
  await sql`
    INSERT INTO users (username, password_hash, role)
    VALUES ('admin', ${hash}, 'admin')
    ON CONFLICT (username) DO NOTHING
  `;
  console.log("✓  Admin user ready  (username: admin  /  password: admin)");
  console.log("\n✅  Seed complete.");
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
