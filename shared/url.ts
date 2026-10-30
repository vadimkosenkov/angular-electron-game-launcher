/**
 * The launcher only ever hands `https://` links to the operating system.
 * The same check guards the catalog data and, from stage 5, `shell.openExternal`,
 * so a malformed or `javascript:` URL cannot reach either path.
 */
export function isHttpsUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:';
}
