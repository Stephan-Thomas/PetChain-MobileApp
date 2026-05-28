import http from 'http';

import { createApp } from './app';

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();
const server = http.createServer(app);

// ---- Graceful shutdown ---------------------------------------------------
//
// When PM2 (or any supervisor) sends SIGINT / SIGTERM it expects in-flight
// requests to finish within `kill_timeout` before the process is hard-killed.
// We stop accepting new connections immediately, then wait for the existing
// ones to drain before exiting.

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.warn(`[server] Received ${signal} — starting graceful shutdown`);

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      console.error('[server] Error while closing server:', err);
      process.exit(1);
    }
    console.warn('[server] All connections drained — exiting cleanly');
    process.exit(0);
  });

  // Hard-exit fallback: if connections don't drain within 9 s we force quit
  // (PM2 kill_timeout is 10 s, so this fires just before the SIGKILL)
  setTimeout(() => {
    console.error('[server] Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 9_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---- Startup -------------------------------------------------------------

server.listen(PORT, () => {
  console.warn(`PetChain REST API listening on http://localhost:${PORT}/api`);
  console.warn(`Health:  http://localhost:${PORT}/api/health`);
  console.warn(`Ready:   http://localhost:${PORT}/api/ready`);

  // Tell PM2 the process is ready to receive traffic
  if (process.send) process.send('ready');
});
