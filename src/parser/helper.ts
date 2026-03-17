import { TokenType, type Token } from '@/lexer/TokenType';
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
  type BooleanLiteralNode,
} from './ASTType';

function getSuffixType(value: string): [TokenType, string] {
  if (value === '>=') {
    return [TokenType.GREATER_THAN_EQUALS, '>='];
  }
  if (value === '>') {
    return [TokenType.GREATER_THAN, '>'];
  }
  if (value === '=') {
    return [TokenType.EQUALS, '='];
  }
  return [TokenType.ERROR, value];
}

export function dealCloseTemplateToken(token: Token): [Token, Token?] {
  if (
    token.type === TokenType.SHIFT_RIGHT_EQUALS ||
    token.type === TokenType.GREATER_THAN_EQUALS ||
    token.type === TokenType.SHIFT_RIGHT
  ) {
    const next: Token = {
      type: TokenType.GREATER_THAN,
      value: '>',
      raw: '>',
      line: token.line,
      column: token.column,
      start: token.start,
      end: token.start + 1,
    };
    const [suffixType, suffixRaw] = getSuffixType(token.value.slice(1));
    const suffix: Token = {
      type: suffixType,
      value: suffixRaw,
      raw: suffixRaw,
      line: token.line,
      column: token.column + 1,
      start: token.start + 1,
      end: token.end,
    };
    return [next, suffix];
  }

  return [token];
}

export function parseNumber(value: string): number {
  // TODO: parse wgsl number string
  return Number(value);
}

export function isIdentifier(node: ASTNode): node is IdentifierNode {
  return node.kind === ASTKind.IDENTIFIER;
}

export function isBooleanLiteral(node: ASTNode): node is BooleanLiteralNode {
  return node.kind === ASTKind.BOOLEAN_LITERAL;
}

export function isNumberLiteral(node: ASTNode): node is NumberLiteralNode {
  return node.kind === ASTKind.NUMBER_LITERAL;
}

export function isMemberExpression(node: ASTNode): node is MemberExpressionNode {
  return node.kind === ASTKind.MEMBER_EXPRESSION;
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

export function isExpressionStatement(node: ASTNode): node is ExpressionStatementNode {
  return node.kind === ASTKind.EXPRESSION_STATEMENT;
}
