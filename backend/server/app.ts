import path from 'path';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { errBody } from './response';
import analyticsRouter from './routes/analytics';
import appointmentsRouter from './routes/appointments';
import auditLogsRouter from './routes/auditLogs';
import auditTrailRouter from './routes/auditTrail';
import authRouter from './routes/auth';
import backupsRouter from './routes/backups';
import breedsRouter from './routes/breeds';
import communityRouter from './routes/community';
import docsRouter from './routes/docs';
import emergencyRouter from './routes/emergency';
import forumRouter from './routes/forum';
import importRouter from './routes/import';
import insuranceRouter from './routes/insurance';
import healthAlertsRouter from './routes/healthAlerts';
import medicalRecordsRouter from './routes/medicalRecords';
import medicationsRouter from './routes/medications';
import paymentsRouter from './routes/payments';
import petsRouter from './routes/pets';
import photosRouter from './routes/photos';
import privacyRouter from './routes/privacy';
import reconciliationRouter from './routes/reconciliation';
import referralsRouter from './routes/referrals';
import reportsRouter from './routes/reports';
import searchRouter from './routes/search';
import syncRouter from './routes/sync';
import telemedicineRouter from './routes/telemedicine';
import travelCertificatesRouter from './routes/travelCertificates';
import usersRouter from './routes/users';
import vaccinationsRouter from './routes/vaccinations';
import vetsRouter from './routes/vets';
import vitalsRouter from './routes/vitals';
import appRouter from './routes/app';
import adminRouter from '../src/routes/admin';
import supportRouter from './routes/support';
import { attachAudit } from '../middleware/auditLog';
import anchorRouter from '../src/routes/anchor';
import apiKeysRouter from '../src/routes/apiKeys';
import documentsRouter from '../src/routes/documents';
import notificationsRouter from '../src/routes/notifications';
import oauthRouter from '../src/routes/oauth';
import familySharingRouter from './routes/familySharing';
import federationRouter from '../src/routes/federation';
import integrationsRouter from '../src/routes/integrations';
import { authRateLimiter, dataRateLimiter } from '../middleware/rateLimiter';

// Readiness probe state — set to false while the process is draining
let isReady = true;
export function setReadiness(ready: boolean): void {
  isReady = ready;
}

type CacheService = {
  getCacheMetrics: () => unknown;
  warmCache: () => Promise<void>;
};

let cacheService: CacheService | null | undefined;

function getCacheService(): CacheService | null {
  if (cacheService !== undefined) return cacheService;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cacheService = require('../services/cacheService') as CacheService;
  } catch {
    cacheService = null;
  }
  return cacheService;
}

export function createApp(): Express {
  const app = express();

  // Security headers (Helmet + CSP + HSTS) — applied before any routes
  applySecurityHeaders(app);

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);
  app.use(sanitizeInputs);
  // performance logging middleware (Sentry)
  app.use(performanceLogger);
  app.use(createRedisSessionMiddleware());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(attachAudit as any);

  // Serve stellar.toml for federation discovery
  app.use(
    '/.well-known',
    express.static(path.join(__dirname, '../.well-known'), { dotfiles: 'allow' }),
  );

  app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

  // ── Versioned routes ──────────────────────────────────────────────────────
  app.use('/api/v1', createV1Router());
  app.use('/api/v2', createV2Router());

  // ── Legacy /api prefix — kept for backward compatibility (routes to v1) ──
  const api = express.Router();

  // Rate limiting — public: 30 req/min per IP; authenticated routes use authRateLimiter
  api.use(publicRateLimiter);

  // Authenticated routes get a higher limit (300 req/min per user)
  // Applied after authenticateJWT so req.user is available for key generation
  api.use((req, res, next) => {
    if ((req as import('../middleware/auth').AuthenticatedRequest).user) {
      return authRateLimiter(req, res, next);
    }
    next();
  });

  // --- Cache metrics (unauthenticated) ----------------------------------------
  api.get('/cache/metrics', (_req, res) => {
    const service = getCacheService();
    res.json(service ? service.getCacheMetrics() : { hits: 0, misses: 0, warm: false });
  });

  // --- Health & readiness probes (unauthenticated, exempt from rate limiting) --
  api.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'petchain-api', timestamp: new Date().toISOString() });
  });
  app.use('/api', api);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json(errBody('INTERNAL_ERROR', err.message || 'An unexpected error occurred'));
  });

  app.use((_req, res) => {
    res.status(404).json(errBody('NOT_FOUND', 'Route not found'));
  });

  // Initiate Redis connection and warm the cache safely
  getRedisClient()
    .connect()
    .catch(() => {});
  getCacheService()?.warmCache().catch((err: any) => console.error('[app] warmCache failed:', err.message));

  return app;
}
