export function splitPrefix(val: string) {
  return val?.startsWith('0x') ? val.slice(2) : val;
}

function canonicalStringify(x: any): string {
  if (x === null || typeof x !== 'object') {
    return JSON.stringify(x);
  }

  if (Array.isArray(x)) {
    return '[' + x.map(canonicalStringify).join(',') + ']';
  }

  const keys = Object.keys(x).sort();

  return (
    '{'
    + keys
      .map((k) => JSON.stringify(k) + ':' + canonicalStringify(x[k]))
      .join(',')
    + '}'
  );
}

export function jsonToHex(obj: any): `0x${string}` {
  console.log('jsonToHex',obj);

  const json = canonicalStringify(obj);
  const bytes = new TextEncoder().encode(json);

  let hex = '0x';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex as `0x${string}`;
}
