// Fails fast with a clear message on Node < 22, where the SQLite driver crashes.
const major = Number(process.versions.node.split(".")[0]);
if (major < 22) {
  console.error(`\nThis project needs Node.js 22 or newer (you have ${process.version}).`);
  console.error("Run `nvm use` (reads .nvmrc) or install Node 22, then run `npm install` again.\n");
  process.exit(1);
}
