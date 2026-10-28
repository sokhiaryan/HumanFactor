// Deletes every demonstration row (is_demo = 1). Real participant data is untouched.
import "dotenv/config";
import { openDatabase, purgeDemoData } from "../db.js";

const path = process.env.DATABASE_PATH?.trim() || "./data/hlac.db";
const db = openDatabase(path);
const { responses, sessions } = purgeDemoData(db);
console.log(`Removed ${responses} demo responses and ${sessions} demo sessions from ${path}.`);
db.close();
