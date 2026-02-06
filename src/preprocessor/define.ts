import { TokenType } from '@/lexer/TokenType';

export interface MacroToken {
  type: TokenType;
  value: string;
}

export interface MacroParameter {
  body: string;
  tokens: MacroToken[];
}

interface BaseMacro {
  flatted: boolean;
  name: string;
  body: string;
  tokens: MacroToken[];
}

export interface ValueMacro extends BaseMacro {
  type: 'value';
}

export interface FunctionMacro extends BaseMacro {
  type: 'function';
  formalParameters: MacroParameter[];
}

export type Macro = ValueMacro | FunctionMacro;

export interface OperatorInfo {
  priority: number;
  associativity: 'left' | 'right';
  arity: number;
}

/**
 * Operator priority Reference from js/TypeScript
 * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Operator_precedence
 */
export const OPERATORS: Record<string, OperatorInfo> = {
  // one operand right associative
  '!': { priority: 14, associativity: 'right', arity: 1 },
  '~': { priority: 14, associativity: 'right', arity: 1 },

  // two operand left associative
  '*': { priority: 13, associativity: 'left', arity: 2 },
  '/': { priority: 13, associativity: 'left', arity: 2 },
  '%': { priority: 13, associativity: 'left', arity: 2 },
  '+': { priority: 12, associativity: 'left', arity: 2 },
  '-': { priority: 12, associativity: 'left', arity: 2 },
  // bitwise move
  '<<': { priority: 11, associativity: 'left', arity: 2 },
  '>>': { priority: 11, associativity: 'left', arity: 2 },

  // relational
  '<': { priority: 10, associativity: 'left', arity: 2 },
  '<=': { priority: 10, associativity: 'left', arity: 2 },
  '>': { priority: 10, associativity: 'left', arity: 2 },
  '>=': { priority: 10, associativity: 'left', arity: 2 },
  '==': { priority: 9, associativity: 'left', arity: 2 },
  '!=': { priority: 9, associativity: 'left', arity: 2 },

  // bitwise AND
  '&': { priority: 8, associativity: 'left', arity: 2 },
  '^': { priority: 7, associativity: 'left', arity: 2 },
  '|': { priority: 6, associativity: 'left', arity: 2 },

  // logical
  '&&': { priority: 5, associativity: 'left', arity: 2 },
  '||': { priority: 4, associativity: 'left', arity: 2 },

  // three operand right associative
  '?': { priority: 3, associativity: 'right', arity: 3 },
  ':': { priority: 3, associativity: 'right', arity: 3 },

  // assignment right associative
  '=': { priority: 2, associativity: 'right', arity: 2 },
  '+=': { priority: 2, associativity: 'right', arity: 2 },
  '-=': { priority: 2, associativity: 'right', arity: 2 },
  '*=': { priority: 2, associativity: 'right', arity: 2 },
  '/=': { priority: 2, associativity: 'right', arity: 2 },
  '%=': { priority: 2, associativity: 'right', arity: 2 },
  '<<=': { priority: 2, associativity: 'right', arity: 2 },
  '>>=': { priority: 2, associativity: 'right', arity: 2 },
  '&=': { priority: 2, associativity: 'right', arity: 2 },
  '^=': { priority: 2, associativity: 'right', arity: 2 },
  '|=': { priority: 2, associativity: 'right', arity: 2 },
};
