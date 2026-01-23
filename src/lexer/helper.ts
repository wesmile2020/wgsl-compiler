export function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n';
}

export function isIdentifierStart(char: string): boolean {
  return /[a-zA-Z_]/.test(char);
}

export function isIdentifierPart(char: string): boolean {
  return /[a-zA-Z0-9_]/.test(char);
}

export function isDigit(char: string): boolean {
  return /[0-9]/.test(char);
}

export function isHexDigit(char: string): boolean {
  return /[0-9a-fA-F]/.test(char);
}
