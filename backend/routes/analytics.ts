import { Router, Response } from 'express';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/adminAuth';

const router = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AnalyticsResponse {
  activeUsers: {
    last7Days: number;
    last30Days: number;
  };
  petDistribution: {
    totalPets: number;
    avgPetsPerUser: number;
    /** Histogram: { "0": n, "1": n, "2": n, "3+": n } */
    buckets: Record<string, number>;
  };
  featureAdoption: {
    qrScanner: number;
    medicalRecords: number;
    appointments: number;
    medications: number;
    emergency: number;
  };
  subscriptionTiers: Record<string, number>;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helper: run a query against the DB pool.
// The pool is injected via app.locals so it can be swapped in tests.
// ---------------------------------------------------------------------------
async function query<T = Record<string, unknown>>(
  req: AuthenticatedRequest,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = req.app.locals.db as {
    query: (sql: string, params: unknown[]) => Promise<{ rows: T[] }>;
  };
  const result = await pool.query(sql, params);
  return result.rows;
}

// ---------------------------------------------------------------------------
// GET /admin/analytics
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // --- Active users ---
      const [dau7] = await query<{ count: string }>(
        req,
        `SELECT COUNT(DISTINCT id) AS count
         FROM users
         WHERE last_login_at >= NOW() - INTERVAL '7 days'`
      );
      const [dau30] = await query<{ count: string }>(
        req,
        `SELECT COUNT(DISTINCT id) AS count
         FROM users
         WHERE last_login_at >= NOW() - INTERVAL '30 days'`
      );

      // --- Pet distribution ---
      const petRows = await query<{ pet_count: string; user_count: string }>(
        req,
        `SELECT pet_count::text, COUNT(*) AS user_count
         FROM (
           SELECT user_id, COUNT(*) AS pet_count FROM pets GROUP BY user_id
         ) sub
         GROUP BY pet_count
         ORDER BY pet_count`
      );

      let totalPets = 0;
      let totalUsersWithPets = 0;
      const buckets: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3+': 0 };

      for (const row of petRows) {
        const count = parseInt(row.pet_count, 10);
        const users = parseInt(row.user_count, 10);
        totalPets += count * users;
        totalUsersWithPets += users;
        const key = count >= 3 ? '3+' : String(count);
        buckets[key] = (buckets[key] ?? 0) + users;
      }

      const avgPetsPerUser =
        totalUsersWithPets > 0
          ? parseFloat((totalPets / totalUsersWithPets).toFixed(2))
          : 0;

      // --- Feature adoption (distinct users who used each feature) ---
      const [featureRow] = await query<{
        qr_scanner: string;
        medical_records: string;
        appointments: string;
        medications: string;
        emergency: string;
      }>(
        req,
        `SELECT
           (SELECT COUNT(DISTINCT user_id) FROM feature_events WHERE feature = 'qr_scanner') AS qr_scanner,
           (SELECT COUNT(DISTINCT user_id) FROM feature_events WHERE feature = 'medical_records') AS medical_records,
           (SELECT COUNT(DISTINCT user_id) FROM feature_events WHERE feature = 'appointments') AS appointments,
           (SELECT COUNT(DISTINCT user_id) FROM feature_events WHERE feature = 'medications') AS medications,
           (SELECT COUNT(DISTINCT user_id) FROM feature_events WHERE feature = 'emergency') AS emergency`
      );

      // --- Subscription tiers ---
      const tierRows = await query<{ tier: string; count: string }>(
        req,
        `SELECT subscription_tier AS tier, COUNT(*) AS count
         FROM users
         GROUP BY subscription_tier`
      );
      const subscriptionTiers: Record<string, number> = {};
      for (const row of tierRows) {
        subscriptionTiers[row.tier] = parseInt(row.count, 10);
      }

      const payload: AnalyticsResponse = {
        activeUsers: {
          last7Days: parseInt(dau7?.count ?? '0', 10),
          last30Days: parseInt(dau30?.count ?? '0', 10),
        },
        petDistribution: {
          totalPets,
          avgPetsPerUser,
          buckets,
        },
        featureAdoption: {
          qrScanner: parseInt(featureRow?.qr_scanner ?? '0', 10),
          medicalRecords: parseInt(featureRow?.medical_records ?? '0', 10),
          appointments: parseInt(featureRow?.appointments ?? '0', 10),
          medications: parseInt(featureRow?.medications ?? '0', 10),
          emergency: parseInt(featureRow?.emergency ?? '0', 10),
        },
        subscriptionTiers,
        generatedAt: new Date().toISOString(),
      };

      res.json(payload);
    } catch (err) {
      console.error('[analytics] query failed', err);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  }
);

export default router;
