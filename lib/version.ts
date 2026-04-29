/**
 * App version. Bumped manually for human-readable releases (v0.X.Y).
 * The optional short SHA is set automatically by Vercel via VERCEL_GIT_COMMIT_SHA
 * so every deploy is uniquely identifiable even between manual bumps.
 *
 * Convention:
 *   - PATCH (0.2.x): hotfix / small polish
 *   - MINOR (0.x.0): new feature / phase complete
 *   - MAJOR (x.0.0): redesign / breaking flow change
 */
export const APP_VERSION = 'v0.10.82'

/** First 7 chars of the deployed git commit, when available */
export const APP_BUILD =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  null

/** Combined: "v0.2.0 · 6872384" or just "v0.2.0" locally */
export function fullVersion(): string {
  return APP_BUILD ? `${APP_VERSION} · ${APP_BUILD}` : APP_VERSION
}
