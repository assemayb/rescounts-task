import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase } from "./store/db.js";

const app = createApp();
let isShuttingDown = false;

const server = app.listen(config.PORT, () => {
  console.log(`rescounts-task listening on port ${config.PORT}`);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Received ${signal}, shutting down gracefully...`);

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await closeDatabase();
    console.log("Graceful shutdown complete.");
    process.exit(0);
  } catch (error) {
    console.error("Graceful shutdown failed.", error);
    process.exit(1);
  }
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
