import {
  ASTKind,
  type AssignmentNode,
  type AssignmentOperator,
  type ASTNode,
  type BinaryExpressionNode,
  type BinaryOperator,
  type BooleanLiteralNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ExpressionStatementNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ParserError,
  type Position,
  type ProgramNode,
  type SequenceExpressionNode,
  type StringLiteralNode,
  type UnaryExpressionNode,
  type UnaryOperator,
} from './ASTType';
import { OPERATOR_PRECEDENCE } from './define';
import { TokenType, type Token } from '@/lexer/TokenType';
import { parseNumber } from './helper';

export interface ParserOutput {
  program: ProgramNode;
  errors: ParserError[];
}

export class Parser {
  private _tokens: Token[] = [];
  private _errors: ParserError[] = [];
  private _position: number = 0;

  constructor(tokens: Token[]) {
    this._tokens = tokens;
  }

  private _isEnd(): boolean {
    return (
      this._position >= this._tokens.length || this._tokens[this._position].type === TokenType.EOF
    );
  }

  private _previous(): Token {
    if (this._position <= 0) {
      return this._tokens[this._tokens.length - 1];
    }
    return this._tokens[this._position - 1];
  }

  private _current(): Token {
    if (this._position >= this._tokens.length) {
      return this._tokens[this._tokens.length - 1];
    }
    return this._tokens[this._position];
  }

  private _advance(): Token {
    if (this._position < this._tokens.length) {
      this._position += 1;
    }
    return this._previous();
  }

  private _check(type: TokenType): boolean {
    if (this._position >= this._tokens.length) {
      return false;
    }
    const token = this._tokens[this._position];
    return token.type === type;
  }

  private _addError(message: string, expected?: TokenType[]): void {
    const token = this._current();
    this._errors.push({
      message,
      position: {
        line: token.line,
        column: token.column,
        start: token.start,
        end: token.end,
      },
      expected,
    });
  }

  private _expect(type: TokenType, message: string): Token {
    if (this._check(type)) {
      return this._advance();
    }
    this._addError(message, [type]);
    return this._current();
  }

  private _match(...types: TokenType[]): boolean {
    for (let i = 0; i < types.length; i++) {
      if (this._check(types[i])) {
        this._advance();
        return true;
      }
    }
    return false;
  }

  private _createPosition(start: number, end: number, startToken: Token): Position {
    return {
      line: startToken.line,
      column: startToken.column,
      start,
      end,
    };
  }

  parse(): ParserOutput {
    const body: ASTNode[] = [];
    const startToken = this._current();

    while (!this._isEnd()) {
      if (this._match(TokenType.SEMICOLON)) {
        continue;
      }
      body.push(this._parseExpressionStatement());
    }

    const program: ProgramNode = {
      kind: ASTKind.PROGRAM,
      body,
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
    return { program, errors: this._errors };
  }

  private _parseExpressionStatement(): ExpressionStatementNode {
    const startToken = this._current();
    const expression = this._parseExpression();
    if (this._check(TokenType.SEMICOLON)) {
      this._advance();
    }
    const state: ExpressionStatementNode = {
      kind: ASTKind.EXPRESSION_STATEMENT,
      expression,
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
    return state;
  }

  private _parseExpression(): ASTNode {
    const startToken = this._current();
    let expression = this._parseAssignment();
    if (this._check(TokenType.COMMA)) {
      const expressions: ASTNode[] = [expression];
      while (this._match(TokenType.COMMA)) {
        const nextExpression = this._parseAssignment();
        expressions.push(nextExpression);
      }
      const next: SequenceExpressionNode = {
        kind: ASTKind.SEQUENCE_EXPRESSION,
        expressions,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      expression = next;
    }

    return expression;
  }

  private _parseAssignment(): ASTNode {
    const startToken = this._current();
    let expression = this._parseConditional();
    if (
      this._check(TokenType.EQUALS) ||
      this._check(TokenType.PLUS_EQUALS) ||
      this._check(TokenType.MINUS_EQUALS) ||
      this._check(TokenType.STAR_EQUALS) ||
      this._check(TokenType.SLASH_EQUALS) ||
      this._check(TokenType.MODULUS_EQUALS) ||
      this._check(TokenType.AND_EQUALS) ||
      this._check(TokenType.OR_EQUALS) ||
      this._check(TokenType.XOR_EQUALS) ||
      this._check(TokenType.SHIFT_LEFT_EQUALS) ||
      this._check(TokenType.SHIFT_RIGHT_EQUALS)
    ) {
      const operator = this._advance().value;
      const right = this._parseAssignment();
      const next: AssignmentNode = {
        kind: ASTKind.ASSIGNMENT,
        left: expression,
        operator: operator as AssignmentOperator,
        right,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      expression = next;
    }
    return expression;
  }

  private _parseConditional(): ASTNode {
    const startToken = this._current();
    let expression = this._parseBinary();
    if (this._match(TokenType.QUESTION)) {
      const whenTrue = this._parseExpression();
      this._expect(TokenType.COLON, `Expected ':' after then`);
      const whenFalse = this._parseConditional();
      const conditional: ConditionalExpressionNode = {
        kind: ASTKind.CONDITIONAL_EXPRESSION,
        condition: expression,
        whenTrue: whenTrue,
        whenFalse,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      expression = conditional;
    }
    return expression;
  }

  private _parseBinary(minPrecedence: number = 0): ASTNode {
    const startToken = this._current();

    let expression = this._parseUnary();
    while (!this._isEnd()) {
      const operator = this._current().value;
      if (!(operator in OPERATOR_PRECEDENCE)) {
        break;
      }
      const precedence = OPERATOR_PRECEDENCE[operator];
      if (precedence < minPrecedence) {
        break;
      }
      this._advance();
      const right = this._parseBinary(precedence + 1);
      const binary: BinaryExpressionNode = {
        kind: ASTKind.BINARY_EXPRESSION,
        operator: operator as BinaryOperator,
        left: expression,
        right,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      expression = binary;
    }

    return expression;
  }

  private _parseUnary(): ASTNode {
    const startToken = this._current();

    if (this._match(TokenType.PLUS, TokenType.MINUS, TokenType.NOT, TokenType.TILDE)) {
      const operand = this._parseUnary();
      const unary: UnaryExpressionNode = {
        kind: ASTKind.UNARY_EXPRESSION,
        operator: startToken.value as UnaryOperator,
        operand,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      return unary;
    }

    return this._parseCall();
  }

  private _parseCall(): ASTNode {
    const startToken = this._current();

    let expression = this._parsePrimary();
    while (!this._isEnd()) {
      if (this._match(TokenType.LEFT_PAREN)) {
        expression = this._finishCall(expression, startToken);
      } else if (this._match(TokenType.DOT)) {
        expression = this._finishMember(expression, startToken);
      } else {
        break;
      }
    }

    return expression;
  }

  private _finishMember(object: ASTNode, startToken: Token): ASTNode {
    const propertyToken = this._expect(TokenType.IDENTIFIER, 'Expected property name after dot');
    const property: IdentifierNode = {
      kind: ASTKind.IDENTIFIER,
      name: propertyToken.value,
      position: this._createPosition(propertyToken.start, this._previous().end, propertyToken),
    };
    const member: MemberExpressionNode = {
      kind: ASTKind.MEMBER_EXPRESSION,
      object,
      property,
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
    return member;
  }

  private _finishCall(callee: ASTNode, startToken: Token): ASTNode {
    const args: ASTNode[] = [];

    if (!this._check(TokenType.RIGHT_PAREN)) {
      do {
        args.push(this._parseExpression());
      } while (this._match(TokenType.DOT) && !this._check(TokenType.RIGHT_PAREN));
    }
    this._expect(TokenType.RIGHT_PAREN, `Expected ')' after call arguments`);

    const callExpression: CallExpressionNode = {
      kind: ASTKind.CALL_EXPRESSION,
      callee,
      arguments: args,
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
    return callExpression;
  }

  private _parsePrimary(): ASTNode {
    const startToken = this._current();

    if (this._match(TokenType.FLOAT_LITERAL, TokenType.INT_LITERAL)) {
      const numberLiteral: NumberLiteralNode = {
        kind: ASTKind.NUMBER_LITERAL,
        value: parseNumber(startToken.value),
        raw: startToken.raw,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      return numberLiteral;
    }
    if (this._match(TokenType.BOOLEAN_LITERAL)) {
      const booleanLiteral: BooleanLiteralNode = {
        kind: ASTKind.BOOLEAN_LITERAL,
        value: startToken.value === 'true',
        raw: startToken.raw,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      return booleanLiteral;
    }
    if (this._match(TokenType.STRING_LITERAL)) {
      const stringLiteral: StringLiteralNode = {
        kind: ASTKind.STRING_LITERAL,
        value: startToken.value,
        raw: startToken.raw,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      return stringLiteral;
    }
    if (this._match(TokenType.IDENTIFIER)) {
      const identifier: IdentifierNode = {
        kind: ASTKind.IDENTIFIER,
        name: startToken.value,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      return identifier;
    }
    if (this._match(TokenType.LEFT_PAREN)) {
      const expression = this._parseExpression();
      this._expect(TokenType.RIGHT_PAREN, `Expected ')' after expression start with '('`);
      return expression;
    }

    this._advance();
    this._addError(`Unexpected token '${startToken.value}' in primary expression`);
    const errorNode: ASTNode = {
      kind: ASTKind.ERROR,
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
    return errorNode;
  }
}
