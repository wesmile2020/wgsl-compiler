export const enum TokenType {
  SYNTAX_KEYWORD,
  TYPE_KEYWORD,
  BUILTIN_FUNCTION,
  BUILTIN_VALUE,
  ATTRIBUTE,
  IDENTIFIER,
  INTEGER_LITERAL,
  FLOAT_LITERAL,
  STRING_LITERAL,
  OPERATOR,
  PUNCTUATION,
  BRACKET,
  LINE_COMMENT,
  BLOCK_COMMENT,
  EOF,
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

export interface LexerError {
  message: string;
  line: number;
  column: number;
  position: number;
}

export interface LexerOutput {
  tokens: Token[];
  errors: LexerError[];
}
