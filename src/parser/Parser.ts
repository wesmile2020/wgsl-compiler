import {
  ASTKind,
  type AssignmentNode,
  type AssignmentOperator,
  type ASTNode,
  type BinaryExpressionNode,
  type BinaryOperator,
  type BooleanLiteralNode,
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
    let expression = this._parseAssignmentOrExpression();

    if (this._check(TokenType.COMMA)) {
      const expressions: ASTNode[] = [expression];
      while (this._check(TokenType.COMMA)) {
        this._advance();
        const nextExpression = this._parseAssignmentOrExpression();
        expressions.push(nextExpression);
      }
      const nextNode: SequenceExpressionNode = {
        kind: ASTKind.SEQUENCE_EXPRESSION,
        expressions,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      expression = nextNode;
    }
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

  private _parseAssignmentOrExpression(): ASTNode {
    const startToken = this._current();
    let expression = this._parseExpression();
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
      const right = this._parseExpression();
      const nextNode: AssignmentNode = {
        kind: ASTKind.ASSIGNMENT,
        left: expression,
        operator: operator as AssignmentOperator,
        right,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      expression = nextNode;
    }
    return expression;
  }

  private _parseExpression(): ASTNode {
    const startToken = this._current();

    let node = this._parseBinary();
    if (this._check(TokenType.QUESTION)) {
      this._advance();
      const whenTrue = this._parseExpression();
      this._expect(TokenType.COLON, `Expected ':' on conditional expression`);
      const whenFalse = this._parseExpression();
      const nextNode: ConditionalExpressionNode = {
        kind: ASTKind.CONDITIONAL_EXPRESSION,
        condition: node,
        whenTrue,
        whenFalse,
        position: this._createPosition(node.position.start, whenFalse.position.end, startToken),
      };
      node = nextNode;
    }

    return node;
  }

  private _parseBinary(minPrecedence: number = 0): ASTNode {
    const startToken = this._current();

    let left = this._parsePrimary();
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
      const nextLeft: BinaryExpressionNode = {
        kind: ASTKind.BINARY_EXPRESSION,
        operator: operator as BinaryOperator,
        left,
        right,
        position: this._createPosition(left.position.start, right.position.end, startToken),
      };
      left = nextLeft;
    }

    return left;
  }

  private _parsePrimary(): ASTNode {
    const startToken = this._current();

    let node: ASTNode | null = null;

    if (startToken.type === TokenType.FLOAT_LITERAL || startToken.type === TokenType.INT_LITERAL) {
      this._advance();
      const numberNode: NumberLiteralNode = {
        kind: ASTKind.NUMBER_LITERAL,
        value: Number(startToken.value),
        raw: startToken.raw,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      node = numberNode;
    } else if (startToken.type === TokenType.BOOLEAN_LITERAL) {
      this._advance();
      const booleanNode: BooleanLiteralNode = {
        kind: ASTKind.BOOLEAN_LITERAL,
        value: startToken.value === 'true',
        raw: startToken.raw,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      node = booleanNode;
    } else if (startToken.type === TokenType.STRING_LITERAL) {
      this._advance();
      const stringNode: StringLiteralNode = {
        kind: ASTKind.STRING_LITERAL,
        value: startToken.value,
        raw: startToken.raw,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      node = stringNode;
    } else if (startToken.type === TokenType.IDENTIFIER) {
      this._advance();
      const identifierNode: IdentifierNode = {
        kind: ASTKind.IDENTIFIER,
        name: startToken.value,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      node = identifierNode;
    } else if (startToken.type === TokenType.LEFT_PAREN) {
      this._advance();
      node = this._parseExpression();
      this._expect(TokenType.RIGHT_PAREN, `Expected ')' after expression start with '('`);
    } else if (
      startToken.type === TokenType.PLUS ||
      startToken.type === TokenType.MINUS ||
      startToken.type === TokenType.NOT ||
      startToken.type === TokenType.TILDE
    ) {
      this._advance();
      const operand = this._parsePrimary();
      const unaryNode: UnaryExpressionNode = {
        kind: ASTKind.UNARY_EXPRESSION,
        operator: startToken.value as UnaryOperator,
        operand,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      node = unaryNode;
    } else {
      this._advance();
      this._addError(`Unexpected token '${startToken.value}' in primary expression`);
      const errorNode: ASTNode = {
        kind: ASTKind.ERROR,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      node = errorNode;
    }

    // Parse member expressions (a.b.c)
    while (this._match(TokenType.DOT)) {
      const memberToken = this._current();
      if (memberToken.type !== TokenType.IDENTIFIER) {
        this._advance();
        this._addError(`Expected identifier after '.' in member expression`);
        break;
      }
      this._advance(); // skip identifier
      const propertyNode: IdentifierNode = {
        kind: ASTKind.IDENTIFIER,
        name: memberToken.value,
        position: this._createPosition(memberToken.start, this._previous().end, memberToken),
      };
      const memberNode: MemberExpressionNode = {
        kind: ASTKind.MEMBER_EXPRESSION,
        object: node,
        property: propertyNode,
        position: {
          line: node.position.line,
          column: node.position.column,
          start: node.position.start,
          end: this._previous().end,
        },
      };
      node = memberNode;
    }

    return node;
  }
}
