// Refuses to start the dev servers when the API port is already taken. Otherwise the
// web dev server would silently proxy to whatever old server holds the port, which
// may be pointed at a different database.
import { createServer } from "node:net";

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
const probe = createServer();
probe.once("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${port} is already in use, probably by another HumanFactor server.`);
    console.error("Stop it first (Ctrl+C in its terminal), or set API_PORT to a free port.\n");
    process.exit(1);
  }
  throw err;
});
probe.listen(port, () => probe.close());
