// Creates the database file (if needed) and applies all migrations.
import "dotenv/config";
import { openDatabase } from "../db.js";

const path = process.env.DATABASE_PATH?.trim() || "./data/hlac.db";
const db = openDatabase(path);
const version = db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number };
console.log(`Database ready at ${path} (schema version ${version.v}).`);
db.close();
