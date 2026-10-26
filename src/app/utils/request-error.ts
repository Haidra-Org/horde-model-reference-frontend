/** Render structured API failures without losing nested field paths to [object Object]. */
export function formatRequestError(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatRequestError).join('; ');
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    const location = Array.isArray(item['loc'])
      ? item['loc']
          .filter((part) => part !== 'body')
          .map((part, i) =>
            typeof part === 'number' ? `[${part}]` : `${i ? '.' : ''}${String(part)}`,
          )
          .join('')
      : typeof item['path'] === 'string'
        ? item['path']
        : '';
    const message = item['msg'] ?? item['message'] ?? item['detail'] ?? item['errors'];
    if (message !== undefined)
      return `${location ? `${location}: ` : ''}${formatRequestError(message)}`;
    return JSON.stringify(value);
  }
  return value == null ? 'Unknown server error' : String(value);
}
