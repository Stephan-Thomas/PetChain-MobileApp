import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/UserRole';

/**
 * Shape of the JWT payload after verification.
 * Extend this if your JWT library attaches more fields.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

/**
 * Minimal JWT verification — replace the body with your real JWT library
 * (e.g. jsonwebtoken.verify) once the auth service is wired in.
 */
function verifyJwt(token: string): AuthenticatedRequest['user'] | null {
  try {
    // TODO: replace with real JWT verification
    // const payload = jwt.verify(token, process.env.JWT_SECRET!);
    // return payload as AuthenticatedRequest['user'];

    // Stub: decode the base64 payload segment for local dev
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    );
    return payload as AuthenticatedRequest['user'];
  } catch {
    return null;
  }
}

/**
 * Middleware: verifies the Bearer JWT and attaches `req.user`.
 * Returns 401 if the token is missing or invalid.
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const user = verifyJwt(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = user;
  next();
}

/**
 * Middleware: requires the authenticated user to have the ADMIN role.
 * Must be used after `authenticate`.
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.role !== UserRole.ADMIN) {
    res.status(403).json({ error: 'Admin role required' });
    return;
  }
  next();
}
