/**
 * NFR-08: an error as it may be logged or stored. Prisma puts the query's arguments — names,
 * phone numbers — in its messages, so those keep only their class and code; our own short
 * single-line messages are kept. Stack frames carry no data and stay.
 */
export function safeErrorSummary(error: unknown): string {
  if (!(error instanceof Error)) return 'Non-Error thrown';
  const code = (error as { code?: unknown }).code;
  const head = `${error.name}${typeof code === 'string' ? ` ${code}` : ''}`;
  const fromPrisma = error.name.startsWith('PrismaClient') || error.message.includes('invocation');
  if (fromPrisma || error.message.includes('\n')) return head;
  return `${head}: ${error.message.slice(0, 200)}`;
}

export function safeErrorStack(error: unknown): string {
  const frames = error instanceof Error ? (error.stack ?? '').split('\n').filter((l) => l.trimStart().startsWith('at ')) : [];
  return [safeErrorSummary(error), ...frames.slice(0, 10)].join('\n');
}
