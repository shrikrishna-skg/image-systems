/**
 * Single batch / workspace ceiling for listing imports.
 * Keeps memory, UI, and API payloads bounded; raise here (and backend config) if ops scale queues.
 */
export const MAX_WORKSPACE_ASSETS = 25;

export function remainingWorkspaceSlots(sessionCount: number): number {
  return Math.max(0, MAX_WORKSPACE_ASSETS - Math.max(0, sessionCount));
}

export function isWorkspaceFull(sessionCount: number): boolean {
  return sessionCount >= MAX_WORKSPACE_ASSETS;
}
