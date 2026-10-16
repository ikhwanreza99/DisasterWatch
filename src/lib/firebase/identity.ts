// Pure identity checks: rendering the header must not load Firebase SDKs.
import type { UserIdentity } from '../../domain/intelligence';

export function mockUser(): UserIdentity {
  return { uid: 'local-demo-user', isAnonymous: true, displayName: 'Demo User', isMock: true };
}
export function isGoogleUser(u: UserIdentity): boolean {
  return !u.isAnonymous && !u.isMock;
}

export function canReport(user: UserIdentity): boolean {
  return !!user.uid && (!user.isMock || !!(import.meta.env?.DEV && user.uid === 'local-report-preview'));
}
