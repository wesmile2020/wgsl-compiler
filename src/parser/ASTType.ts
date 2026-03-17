import { type TokenType } from '@/lexer/TokenType';

export enum ASTKind {
  ERROR,
  PROGRAM,
  IDENTIFIER,
  TEMPLATE_IDENTIFIER,
  STRING_LITERAL,
  BOOLEAN_LITERAL,
  NUMBER_LITERAL,
  MEMBER_EXPRESSION,
  CALL_EXPRESSION,
  UPDATE_EXPRESSION,
  UNARY_EXPRESSION,
  BINARY_EXPRESSION,
  CONDITIONAL_EXPRESSION,
  ASSIGNMENT_EXPRESSION,
  SEQUENCE_EXPRESSION,
  EXPRESSION_STATEMENT,
  BLOCK_STATEMENT,
  VARIABLE_DECORATOR,
  VARIABLE_TYPE,
  VARIABLE_DECLARATION,
  VARIABLE_MODIFIER,
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

interface MyBeMatched<T> {
  value: T;
  matched: true;
  errored: false;
}

interface MyBeErrored {
  matched: false;
  errored: boolean;
}

export type MayBe<T> = MyBeMatched<T> | MyBeErrored;

export interface ProgramNode extends ASTNode<ASTKind.PROGRAM> {
  body: ASTNode[];
}

export interface IdentifierNode extends ASTNode<ASTKind.IDENTIFIER> {
  name: string;
}

export interface TemplateIdentifier extends ASTNode<ASTKind.TEMPLATE_IDENTIFIER> {
  name: IdentifierNode;
  templates: ASTNode[];
}

export interface StringLiteralNode extends ASTNode<ASTKind.STRING_LITERAL> {
  value: string;
  raw: string;
}

export interface BooleanLiteralNode extends ASTNode<ASTKind.BOOLEAN_LITERAL> {
  value: boolean;
  raw: string;
}

export interface NumberLiteralNode extends ASTNode<ASTKind.NUMBER_LITERAL> {
  value: number;
  raw: string;
}

export interface MemberExpressionNode extends ASTNode<ASTKind.MEMBER_EXPRESSION> {
  object: ASTNode;
  property: ASTNode;
}

export interface CallExpressionNode extends ASTNode<ASTKind.CALL_EXPRESSION> {
  callee: ASTNode;
  arguments: ASTNode[];
}

export type UpdateOperator = '++' | '--';

export interface UpdateExpressionNode extends ASTNode<ASTKind.UPDATE_EXPRESSION> {
  operator: UpdateOperator;
  operand: ASTNode;
  prefix: boolean;
}

export type UnaryOperator = '+' | '-' | '!' | '~' | '*' | '&';

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

/* oxfmt-ignore */
export type AssignmentOperator = '=' | '+=' | '-=' | '*=' | '/=' | '%='  // math assignment operators
  | '&=' | '|=' | '^=' // bitwise assignment operators
  | '<<=' | '>>='; // shift assignment operators

export interface AssignmentExpressionNode extends ASTNode<ASTKind.ASSIGNMENT_EXPRESSION> {
  left: ASTNode;
  right: ASTNode;
  operator: AssignmentOperator;
}

export interface SequenceExpressionNode extends ASTNode<ASTKind.SEQUENCE_EXPRESSION> {
  expressions: ASTNode[];
}

export interface ExpressionStatementNode extends ASTNode<ASTKind.EXPRESSION_STATEMENT> {
  expression: ASTNode;
}

export interface BlockStatementNode extends ASTNode<ASTKind.BLOCK_STATEMENT> {
  body: ASTNode[];
}

export interface VariableDecoratorNode extends ASTNode<ASTKind.VARIABLE_DECORATOR> {
  identifier: IdentifierNode;
  type: VariableTypeNode | null;
  initializer: ASTNode | null;
}

export interface VariableTypeNode extends ASTNode<ASTKind.VARIABLE_TYPE> {
  name: string;
  arguments: ASTNode[] | null;
}

export type Modifier = 'let' | 'const' | 'var';

export interface VariableDeclarationNode extends ASTNode<ASTKind.VARIABLE_DECLARATION> {
  declarations: VariableDecoratorNode[];
  modifier: VariableModifierNode;
}

export interface VariableModifierNode extends ASTNode<ASTKind.VARIABLE_MODIFIER> {
  name: Modifier;
  arguments: ASTNode[] | null;
}
