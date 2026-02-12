import { type TokenType } from '@/lexer/TokenType';

export const enum ASTKind {
  ERROR,
  PROGRAM,
  NUMBER_LITERAL,
  STRING_LITERAL,
  UNARY_EXPRESSION,
  BINARY_EXPRESSION,
  CONDITIONAL_EXPRESSION,
  IDENTIFIER,
  ASSIGNMENT,
}

export interface Position {
  line: number;
  column: number;
  start: number;
  end: number;
}

export interface ParserError {
  message: string;
  position: Position;
  expected?: TokenType[];
}

export interface ASTNode<T extends ASTKind = ASTKind> {
  kind: T;
  position: Position;
}

export interface ProgramNode extends ASTNode<ASTKind.PROGRAM> {
  body: ASTNode[];
}

export interface NumberLiteralNode extends ASTNode<ASTKind.NUMBER_LITERAL> {
  value: number;
}

export interface StringLiteralNode extends ASTNode<ASTKind.STRING_LITERAL> {
  value: string;
}

type UnaryOperator = '+' | '-' | '!' | '~';

export interface UnaryExpressionNode extends ASTNode<ASTKind.UNARY_EXPRESSION> {
  operator: UnaryOperator;
  operand: ASTNode;
}

/* oxfmt-ignore */
export type BinaryOperator = '+' | '-' | '*' | '/' | '%' // math operators
  | '&&' | '||' // logical operators
  | '&' | '|' | '^' | '<<' | '>>' // bitwise operators
  | '==' | '!=' | '<' | '>' | '<=' | '>='; // relational operators

export interface BinaryExpressionNode extends ASTNode<ASTKind.BINARY_EXPRESSION> {
  operator: BinaryOperator;
  left: ASTNode;
  right: ASTNode;
}

export interface ConditionalExpressionNode extends ASTNode<ASTKind.CONDITIONAL_EXPRESSION> {
  condition: ASTNode;
  whenTrue: ASTNode;
  whenFalse: ASTNode;
}

export interface IdentifierNode extends ASTNode<ASTKind.IDENTIFIER> {
  name: string;
}

/* oxfmt-ignore */
export type AssignmentOperator = '=' | '+=' | '-=' | '*=' | '/=' | '%='  // math assignment operators
  | '&=' | '|=' | '^=' // bitwise assignment operators
  | '<<=' | '>>='; // shift assignment operators

export interface AssignmentNode extends ASTNode<ASTKind.ASSIGNMENT> {
  left: ASTNode;
  right: ASTNode;
  operator: AssignmentOperator;
}
