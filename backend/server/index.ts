import http from 'http';

import { createApp } from './app';
import apiKeyService from '../services/apiKeyService';
import logger from '../utils/logger';
import { createGraphQLServer, buildGraphQLMiddleware } from './graphql';
import { checkDatabaseConnection, runMigrations } from '../config/database';

const PORT = Number(process.env.PORT) || 3000;

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals, server: http.Server): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Received ${signal} — starting graceful shutdown`);

  server.close((err) => {
    if (err) {
      logger.error('Error while closing server', { error: err.message });
      process.exit(1);
    }
    logger.info('All connections drained — exiting cleanly');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 9_000).unref();
}

async function start(): Promise<void> {
  await checkDatabaseConnection();
  logger.info('[server] Database connection verified.');

  // Run pending migrations (idempotent, advisory-locked by node-pg-migrate)
  await runMigrations();

  const app = createApp();
  const server = http.createServer(app);

  // Apollo Server with WebSocket subscriptions
  const apolloServer = createGraphQLServer(server);
  await apolloServer.start();
  app.use('/graphql', buildGraphQLMiddleware(apolloServer));

  process.on('SIGTERM', () => shutdown('SIGTERM', server));
  process.on('SIGINT', () => shutdown('SIGINT', server));

  server.listen(PORT, () => {
    logger.info(`PetChain REST API  → http://localhost:${PORT}/api`);
    logger.info(`GraphQL HTTP       → http://localhost:${PORT}/graphql`);
    logger.info(`GraphQL WebSocket  → ws://localhost:${PORT}/graphql`);
    logger.info(`Health:  http://localhost:${PORT}/api/health`);
    logger.info(`Admin:   http://localhost:${PORT}/admin/api-keys.html`);

    // Revoke rotated keys automatically once their overlap window ends
    setInterval(() => apiKeyService.processRotationExpiry(), 60_000).unref();

    if (process.send) process.send('ready');
  });
}

start().catch((err) => {
  logger.error('[server] Startup failed:', err);
  process.exit(1);
});
