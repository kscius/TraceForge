const TASK_ID_PATTERN = /^([A-Z][A-Z0-9]{0,9})-(\d+)$/i;

export function formatTaskIdentifier(projectKey: string, number: number): string {
  const key = projectKey.toUpperCase();
  return `${key}-${number}`;
}

export function parseTaskIdentifier(identifier: string): { projectKey: string; number: number } | null {
  const match = TASK_ID_PATTERN.exec(identifier.trim());
  if (!match?.[1] || !match[2]) return null;
  return { projectKey: match[1].toUpperCase(), number: Number.parseInt(match[2], 10) };
}

/** Discover task IDs in branch names, commits, PR titles, etc. */
export function extractTaskIdentifiers(text: string): string[] {
  const pattern = /\b([A-Z][A-Z0-9]{0,9}-\d+)\b/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m[1]) found.add(m[1].toUpperCase());
  }
  return [...found];
}
