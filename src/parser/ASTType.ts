import { type TokenType } from '@/lexer/TokenType';

export enum ASTKind {
  ERROR,
  PROGRAM,
  VARIABLE_MODIFIER,
  VARIABLE_DECLARATION,
  VARIABLE_TYPE,
  VARIABLE_DECORATOR,
  BLOCK_STATEMENT,
  EXPRESSION_STATEMENT,
  SEQUENCE_EXPRESSION,
  ASSIGNMENT_EXPRESSION,
  CONDITIONAL_EXPRESSION,
  BINARY_EXPRESSION,
  UNARY_EXPRESSION,
  UPDATE_EXPRESSION,
  CALL_EXPRESSION,
  MEMBER_EXPRESSION,
  NUMBER_LITERAL,
  BOOLEAN_LITERAL,
  STRING_LITERAL,
  IDENTIFIER,
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

export type Modifier = 'let' | 'const' | 'var';

export interface VariableModifierNode extends ASTNode<ASTKind.VARIABLE_MODIFIER> {
  name: Modifier;
  arguments: ASTNode[];
}

export interface VariableDeclarationNode extends ASTNode<ASTKind.VARIABLE_DECLARATION> {
  declarations: VariableDecoratorNode[];
  modifier: VariableModifierNode;
}

export interface VariableTypeNode extends ASTNode<ASTKind.VARIABLE_TYPE> {
  name: string;
  arguments: ASTNode[];
}

export interface VariableDecoratorNode extends ASTNode<ASTKind.VARIABLE_DECORATOR> {
  identifier: IdentifierNode;
  type: VariableTypeNode | null;
  initializer: ASTNode | null;
}

export interface BlockStatementNode extends ASTNode<ASTKind.BLOCK_STATEMENT> {
  body: ASTNode[];
}

export interface ExpressionStatementNode extends ASTNode<ASTKind.EXPRESSION_STATEMENT> {
  expression: ASTNode;
}

export interface SequenceExpressionNode extends ASTNode<ASTKind.SEQUENCE_EXPRESSION> {
  expressions: ASTNode[];
}

/* oxfmt-ignore */
export type AssignmentOperator = '=' | '+=' | '-=' | '*=' | '/=' | '%='  // math assignment operators
  | '&=' | '|=' | '^=' // bitwise assignment operators
  | '<<=' | '>>='; // shift assignment operators

export interface AssignmentExpressionNode extends ASTNode<ASTKind.ASSIGNMENT_EXPRESSION> {
  left: ASTNode;
  right: ASTNode;
  operator: AssignmentOperator;
}

export interface ConditionalExpressionNode extends ASTNode<ASTKind.CONDITIONAL_EXPRESSION> {
  condition: ASTNode;
  whenTrue: ASTNode;
  whenFalse: ASTNode;
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

export type UnaryOperator = '+' | '-' | '!' | '~';

export interface UnaryExpressionNode extends ASTNode<ASTKind.UNARY_EXPRESSION> {
  operator: UnaryOperator;
  operand: ASTNode;
}

export type UpdateOperator = '++' | '--';

export interface UpdateExpressionNode extends ASTNode<ASTKind.UPDATE_EXPRESSION> {
  operator: UpdateOperator;
  operand: ASTNode;
  prefix: boolean;
}

export interface CallExpressionNode extends ASTNode<ASTKind.CALL_EXPRESSION> {
  callee: ASTNode;
  arguments: ASTNode[];
}

export interface MemberExpressionNode extends ASTNode<ASTKind.MEMBER_EXPRESSION> {
  object: ASTNode;
  property: ASTNode;
}

export interface NumberLiteralNode extends ASTNode<ASTKind.NUMBER_LITERAL> {
  value: number;
  raw: string;
}

export interface BooleanLiteralNode extends ASTNode<ASTKind.BOOLEAN_LITERAL> {
  value: boolean;
  raw: string;
}

export interface StringLiteralNode extends ASTNode<ASTKind.STRING_LITERAL> {
  value: string;
  raw: string;
}

export interface IdentifierNode extends ASTNode<ASTKind.IDENTIFIER> {
  name: string;
}
