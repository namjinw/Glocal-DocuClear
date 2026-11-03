import type { IncomingMessage, ServerResponse } from 'node:http';
export const GROQ_MODEL: 'openai/gpt-oss-120b';
export function readGroqKey(rootDir: string): string;
export function createGroqMiddleware(options: {
  rootDir: string;
  fetchImpl?: typeof fetch;
  getKey?: () => string;
  timeoutMs?: number;
}): (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>;
