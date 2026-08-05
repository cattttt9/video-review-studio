import { invoke } from '@tauri-apps/api/core';

export interface AppErrorPayload {
  category: string;
  message: string;
  recoverable: boolean;
}

export class CommandError extends Error {
  category: string;
  recoverable: boolean;

  constructor(payload: AppErrorPayload) {
    super(payload.message);
    this.category = payload.category;
    this.recoverable = payload.recoverable;
  }
}

export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (raw) {
    if (typeof raw === 'object' && raw !== null && 'category' in raw && 'message' in raw) {
      throw new CommandError(raw as unknown as AppErrorPayload);
    }
    throw new CommandError({
      category: 'unknown',
      message: String(raw),
      recoverable: true,
    });
  }
}

export function describeError(err: unknown): string {
  if (err instanceof CommandError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
