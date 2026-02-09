export function isWhitespace(code: number): boolean {
  // ' ', \t, \n
  return code === 32 || code === 9 || code === 10;
}

export function isIdentifierStart(code: number): boolean {
  // _, A-Z, a-z
  return code === 95 || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

export function isIdentifierPart(code: number): boolean {
  // A-Z, a-z, 0-9, _
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 95;
}

export function isDigit(code: number): boolean {
  // 0-9
  return code >= 48 && code <= 57;
}

export function isHexDigit(code: number): boolean {
  // 0-9, a-f, A-F
  return (code >= 48 && code <= 57) || (code >= 97 && code <= 102) || (code >= 65 && code <= 70);
}
