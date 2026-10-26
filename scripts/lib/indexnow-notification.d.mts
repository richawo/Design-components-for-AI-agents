export class TransientNotificationError extends Error {}
export function notificationHttpError(stage: string, response: Response): Error;
export function retryNotification<T>(stage: string, operation: () => Promise<T>, options?: {
  pause?: (milliseconds: number) => Promise<unknown>;
  log?: (message: string) => void;
  attempts?: number;
}): Promise<T>;
export function deploymentMatches(marker: unknown, publicCommit: string, request?: {
  privateContentCommit: string;
  requestId: string;
  sourceInputsSha256: string;
}): boolean;
export function runConfirmedNotification<T>(confirm: () => Promise<void>, notify: () => Promise<T>, options?: {allowDeferred?: boolean}): Promise<
  {status: 'received'; result: T} | {status: 'deferred'; reason: string; publication: string}
>;
