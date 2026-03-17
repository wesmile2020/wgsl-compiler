export const BINARY_OPERATOR_PRECEDENCE: Record<string, number> = {
  // math operators
  '*': 13,
  '/': 13,
  '%': 13,
  '+': 12,
  '-': 12,
  '<<': 11,
  '>>': 11,
  // relational operators
  '<': 10,
  '>': 10,
  '<=': 10,
  '>=': 10,
  '==': 9,
  '!=': 9,
  // bitwise operators
  '&': 8,
  '^': 7,
  '|': 6,
  // logical operators
  '&&': 5,
  '||': 4,
};
