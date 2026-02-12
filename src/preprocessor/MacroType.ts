import { type Token } from '@/lexer/TokenType';

export interface MacroParameter {
  body: string;
  tokens: Token[];
}

export const enum MacroType {
  VALUE,
  FUNCTION,
}

interface BaseMacro<T extends MacroType = MacroType> {
  type: T;
  flatted: boolean;
  name: string;
  body: string;
  tokens: Token[];
}

export type ValueMacro = BaseMacro<MacroType.VALUE>;

export interface FunctionMacro extends BaseMacro<MacroType.FUNCTION> {
  formalParameters: MacroParameter[];
}

export type Macro = ValueMacro | FunctionMacro;

export interface OperatorInfo {
  priority: number;
  associativity: 'left' | 'right';
  arity: number;
}
