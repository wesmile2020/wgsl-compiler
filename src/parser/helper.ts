import {
  ASTKind,
  type ASTNode,
  type NumberLiteralNode,
  type UnaryExpressionNode,
  type BinaryExpressionNode,
  type ConditionalExpressionNode,
  type IdentifierNode,
} from './ASTType';

export function isNumberLiteral(node: ASTNode): node is NumberLiteralNode {
  return node.kind === ASTKind.NUMBER_LITERAL;
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

export function isIdentifier(node: ASTNode): node is IdentifierNode {
  return node.kind === ASTKind.IDENTIFIER;
}
