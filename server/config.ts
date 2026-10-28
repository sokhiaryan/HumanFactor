// Reads configuration from environment variables (see .env.example).
// Secrets only ever come from the environment; nothing secret is bundled into the client.

import { randomBytes } from "node:crypto";

export interface Config {
  port: number;
  databasePath: string;
  production: boolean;
  /** Null disables the dashboard login entirely. */
  adminPassword: string | null;
  sessionSecret: string;
  trustProxy: boolean;
  /** Marks this server as a synthetic demonstration instance (DEMO_INSTANCE=true). */
  demoInstance: boolean;
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === "production";
  const problems: string[] = [];

  const adminPassword = env.ADMIN_PASSWORD?.trim() || null;
  if (adminPassword && adminPassword.length < 12) problems.push("ADMIN_PASSWORD must be at least 12 characters.");
  if (production && !adminPassword) problems.push("ADMIN_PASSWORD is required in production.");
  if (adminPassword && /change-me/i.test(adminPassword)) {
    problems.push("ADMIN_PASSWORD still has the example value.");
  }

  let sessionSecret = env.SESSION_SECRET?.trim() ?? "";
  if (sessionSecret.length < 32 || /replace-with/i.test(sessionSecret)) {
    if (production) problems.push("SESSION_SECRET must be set to at least 32 random characters in production.");
    // Development fallback: a per-process secret (dashboard sessions reset on restart).
    sessionSecret = randomBytes(32).toString("hex");
  }

  // API_PORT wins so a dev tool that sets PORT for the web dev server cannot clash with the API.
  const port = Number(env.API_PORT ?? env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) problems.push("API_PORT/PORT must be a positive integer.");

  if (problems.length) throw new ConfigError(problems.join("\n"));

  return {
    port,
    databasePath: env.DATABASE_PATH?.trim() || "./data/hlac.db",
    production,
    adminPassword,
    sessionSecret,
    trustProxy: env.TRUST_PROXY === "true",
    demoInstance: env.DEMO_INSTANCE === "true",
  };
}
