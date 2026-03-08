import {
  ASTKind,
  type ASTNode,
  type NumberLiteralNode,
  type UnaryExpressionNode,
  type BinaryExpressionNode,
  type ConditionalExpressionNode,
  type IdentifierNode,
  type ExpressionStatementNode,
  type MemberExpressionNode,
} from './ASTType';

export function parseNumber(value: string): number {
  // TODO: parse wgsl number string
  return Number(value);
}

export function isNumberLiteral(node: ASTNode): node is NumberLiteralNode {
  return node.kind === ASTKind.NUMBER_LITERAL;
}

export function isIdentifier(node: ASTNode): node is IdentifierNode {
  return node.kind === ASTKind.IDENTIFIER;
}

export function isUnaryExpression(node: ASTNode): node is UnaryExpressionNode {
  return node.kind === ASTKind.UNARY_EXPRESSION;
}

export function isBinaryExpression(node: ASTNode): node is BinaryExpressionNode {
  return node.kind === ASTKind.BINARY_EXPRESSION;
}

export function isConditionalExpression(node: ASTNode): node is ConditionalExpressionNode {
  return node.kind === ASTKind.CONDITIONAL_EXPRESSION;
}

export function isMemberExpression(node: ASTNode): node is MemberExpressionNode {
  return node.kind === ASTKind.MEMBER_EXPRESSION;
}

export function isExpressionStatement(node: ASTNode): node is ExpressionStatementNode {
  return node.kind === ASTKind.EXPRESSION_STATEMENT;
}
