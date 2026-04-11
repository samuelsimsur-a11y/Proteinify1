/**
 * Incrementally extract complete JSON objects from the `versions` array while the model streams output.
 */

function skipWs(s: string, i: number): number {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j++;
  return j;
}

/** Extract one balanced `{ ... }` from s[start..], respecting JSON strings. */
export function extractBalancedJsonObject(s: string, start: number): { text: string; end: number } | null {
  let i = skipWs(s, start);
  if (i >= s.length || s[i] !== "{") return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  const objStart = i;
  for (; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { text: s.slice(objStart, i + 1), end: i + 1 };
    }
  }
  return null;
}

/**
 * Parse all *complete* leading elements of the `versions` array (in order).
 * Stops at the first incomplete object or invalid structure.
 */
export function parseCompleteVersionsFromBuffer(buffer: string): unknown[] {
  const key = '"versions"';
  const keyIdx = buffer.indexOf(key);
  if (keyIdx === -1) return [];

  let i = skipWs(buffer, keyIdx + key.length);
  if (i >= buffer.length || buffer[i] !== ":") return [];
  i = skipWs(buffer, i + 1);
  if (i >= buffer.length || buffer[i] !== "[") return [];

  i++;
  const out: unknown[] = [];

  while (true) {
    i = skipWs(buffer, i);
    if (i < buffer.length && buffer[i] === "]") break;
    if (i < buffer.length && buffer[i] === ",") {
      i++;
      continue;
    }
    const obj = extractBalancedJsonObject(buffer, i);
    if (!obj) break;
    try {
      out.push(JSON.parse(obj.text));
    } catch {
      break;
    }
    i = obj.end;
  }

  return out;
}
