import "dotenv/config";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { ConfigError, loadConfig } from "./config.js";
import { openDatabase } from "./db.js";

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`Configuration error:\n${err.message}\nSee .env.example.`);
    process.exit(1);
  }
  throw err;
}

const db = openDatabase(config.databasePath);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = createApp({ db, config, staticDir: join(root, "dist", "web") });

const server = app.listen(config.port, () => {
  console.log(`HumanFactor API listening on http://localhost:${config.port} (db: ${config.databasePath})`);
  if (config.demoInstance) {
    console.log("DEMO INSTANCE: serving the synthetic demonstration dataset. These are not real participants.");
  }
  if (!config.adminPassword) console.warn("ADMIN_PASSWORD is not set: the team dashboard login is disabled.");
  if (config.production && !config.trustProxy) {
    console.warn("TRUST_PROXY is not true. Behind a hosting proxy, every visitor shares one rate-limit budget — set TRUST_PROXY=true.");
  }
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${config.port} is already in use. Stop the other server or set API_PORT.`);
    process.exit(1);
  }
  throw err;
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
