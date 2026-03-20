export enum TokenType {
  ERROR,
  LINE_COMMENT,
  BLOCK_COMMENT,

  /* literals */
  INT_LITERAL,
  FLOAT_LITERAL,
  BOOLEAN_LITERAL,
  STRING_LITERAL,

  /* keywords */
  ALIAS,
  BREAK,
  CASE,
  CONST,
  CONST_ASSERT,
  CONTINUE,
  CONTINUING,
  DEFAULT,
  DIAGNOSTIC,
  DISCARD,
  ELSE,
  ENABLE,
  FALSE,
  FN,
  FOR,
  IF,
  LET,
  LOOP,
  OVERRIDE,
  REQUIRES,
  RETURN,
  STRUCT,
  SWITCH,
  TRUE,
  VAR,
  WHILE,

  /* reserved words */
  RESERVED_WORD,

  /* syntactic tokens */
  /** ? */
  QUESTION,
  /** & */
  AND,
  /** && */
  LOGICAL_AND,
  /** -> */
  ARROW,
  /** @ */
  AT,
  /** / */
  SLASH,
  /** ! */
  NOT,
  /** [ */
  LEFT_BRACKET,
  /** ] */
  RIGHT_BRACKET,
  /** { */
  LEFT_BRACE,
  /** } */
  RIGHT_BRACE,
  /** : */
  COLON,
  /** , */
  COMMA,
  /** = */
  EQUALS,
  /** == */
  EQUALS_EQUALS,
  /** != */
  NOT_EQUALS,
  /** > */
  GREATER_THAN,
  /** >= */
  GREATER_THAN_EQUALS,
  /** >> */
  SHIFT_RIGHT,
  /** < */
  LESS_THAN,
  /** <= */
  LESS_THAN_EQUALS,
  /** << */
  SHIFT_LEFT,
  /** % */
  MODULUS,
  /** - */
  MINUS,
  /** -- */
  MINUS_MINUS,
  /** . */
  DOT,
  /** + */
  PLUS,
  /** ++ */
  PLUS_PLUS,
  /** | */
  OR,
  /** || */
  LOGICAL_OR,
  /** ( */
  LEFT_PAREN,
  /** ) */
  RIGHT_PAREN,
  /** ; */
  SEMICOLON,
  /** * */
  STAR,
  /** ~ */
  TILDE,
  /** _ */
  UNDERSCORE,
  /** ^ */
  XOR,
  /** += */
  PLUS_EQUALS,
  /** -= */
  MINUS_EQUALS,
  /** *= */
  STAR_EQUALS,
  /** /= */
  SLASH_EQUALS,
  /** %= */
  MODULUS_EQUALS,
  /** &= */
  AND_EQUALS,
  /** |= */
  OR_EQUALS,
  /** ^= */
  XOR_EQUALS,
  /** >>= */
  SHIFT_RIGHT_EQUALS,
  /** <<= */
  SHIFT_LEFT_EQUALS,

  IDENTIFIER,
  EOF,
}

export interface Token {
  type: TokenType;
  value: string;
  raw: string;
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

export interface Template {
  name: string;
  tokens: Token[];
}
