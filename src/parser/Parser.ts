import { ASTKind, type ASTNode, type BinaryExpressionNode, type BinaryOperator, type ExpressionNode, type NumberLiteralNode, type ParserError, type Position, type ProgramNode, type UnaryExpressionNode } from './ASTType';
import { OPERATOR_PRECEDENCE } from './define';
import { TokenType, type Token } from '@/lexer/TokenType';

export interface ParserOutput {
  program: ProgramNode;
  errors: ParserError[];
}

interface ICheckItem {
  type: TokenType;
  value: string;
}

export class Parser {
  private _tokens: Token[] = [];
  private _errors: ParserError[] = [];
  private _position: number = 0;

  constructor(tokens: Token[]) {
    this._tokens = tokens;
  }

  private _isEnd(): boolean {
    return this._position >= this._tokens.length || this._tokens[this._position].type === TokenType.EOF;
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

  private _check(type: TokenType, value: string): boolean {
    if (this._position >= this._tokens.length) {
      return false;
    }
    const token = this._tokens[this._position];
    return token.type === type && token.value === value;
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

  private _expect(type: TokenType, value: string, message: string): Token {
    if (this._check(type, value)) {
      return this._advance();
    }
    this._addError(message, [type]);
    return this._current();
  }

  private _match(type: TokenType, value: string): boolean {
    if (this._check(type, value)) {
      this._advance();
      return true;
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
      if (this._check(TokenType.PUNCTUATION, ';')) {
        this._advance();
        continue;
      }
      body.push(this._parseExpression());
    }

    const program: ProgramNode = {
      kind: ASTKind.PROGRAM,
      body,
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
    return { program, errors: this._errors };
  }

  private _parseExpression(): ASTNode {
    const startToken = this._current();

    let node = this._parseBinary();
    if (this._check(TokenType.OPERATOR, '?')) {
      this._advance();
      const whenTrue = this._parseExpression();
      this._expect(TokenType.PUNCTUATION, ':', `Expected ':' on conditional expression`);
      const whenFalse = this._parseExpression();
      const nextNode = {
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
      const nextLeft = {
        kind: ASTKind.BINARY_EXPRESSION,
        operator,
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

    if (startToken.type === TokenType.FLOAT_LITERAL ||startToken.type === TokenType.INTEGER_LITERAL) {
      this._advance();
      const node: NumberLiteralNode = {
        kind: ASTKind.NUMBER_LITERAL,
        value: Number(startToken.value),
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      return node;
    }
    if (startToken.type === TokenType.BRACKET && startToken.value === '(') {
      this._advance();
      const node = this._parseExpression();
      this._expect(TokenType.BRACKET, ')', `Expected ')' after expression start with '('`);
      return node;
    }
    if (
      startToken.type === TokenType.OPERATOR &&
      (
        startToken.value === '+' ||
        startToken.value === '-' ||
        startToken.value === '!' ||
        startToken.value === '~'
      )
    ) {
      this._advance();
      const operand = this._parsePrimary();
      const node: UnaryExpressionNode = {
        kind: ASTKind.UNARY_EXPRESSION,
        operator: startToken.value,
        operand,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      return node;
    }

    this._addError(`Unexpected token in primary expression ${startToken.value}`);

    return {
      kind: ASTKind.ERROR,
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
  }
}
