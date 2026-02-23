import {
  ASTKind,
  type AssignmentNode,
  type AssignmentOperator,
  type ASTNode,
  type BinaryExpressionNode,
  type BinaryOperator,
  type ConditionalExpressionNode,
  type ExpressionStatementNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ParserError,
  type Position,
  type ProgramNode,
  type SequenceExpressionNode,
  type UnaryExpressionNode,
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
      if (this._match(TokenType.PUNCTUATION, ';')) {
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

    if (this._check(TokenType.PUNCTUATION, ',')) {
      const expressions: ASTNode[] = [expression];
      while (this._check(TokenType.PUNCTUATION, ',')) {
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
    if (this._check(TokenType.PUNCTUATION, ';')) {
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
      this._check(TokenType.OPERATOR, '=') ||
      this._check(TokenType.OPERATOR, '+=') ||
      this._check(TokenType.OPERATOR, '-=') ||
      this._check(TokenType.OPERATOR, '*=') ||
      this._check(TokenType.OPERATOR, '/=') ||
      this._check(TokenType.OPERATOR, '%=') ||
      this._check(TokenType.OPERATOR, '&=') ||
      this._check(TokenType.OPERATOR, '|=') ||
      this._check(TokenType.OPERATOR, '^=') ||
      this._check(TokenType.OPERATOR, '<<=') ||
      this._check(TokenType.OPERATOR, '>>=')
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
    if (this._check(TokenType.OPERATOR, '?')) {
      this._advance();
      const whenTrue = this._parseExpression();
      this._expect(TokenType.PUNCTUATION, ':', `Expected ':' on conditional expression`);
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

    if (
      startToken.type === TokenType.FLOAT_LITERAL ||
      startToken.type === TokenType.INTEGER_LITERAL
    ) {
      this._advance();
      const numberNode: NumberLiteralNode = {
        kind: ASTKind.NUMBER_LITERAL,
        value: Number(startToken.value),
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      node = numberNode;
    } else if (
      startToken.type === TokenType.SYNTAX_KEYWORD &&
      (startToken.value === 'true' || startToken.value === 'false')
    ) {
      this._advance();
      const booleanNode: NumberLiteralNode = {
        kind: ASTKind.NUMBER_LITERAL,
        value: startToken.value === 'true' ? 1 : 0,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      node = booleanNode;
    } else if (
      startToken.type === TokenType.IDENTIFIER ||
      startToken.type === TokenType.BUILTIN_VALUE
    ) {
      this._advance();
      const identifierNode: IdentifierNode = {
        kind: ASTKind.IDENTIFIER,
        name: startToken.value,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      node = identifierNode;
    } else if (startToken.type === TokenType.BRACKET && startToken.value === '(') {
      this._advance();
      node = this._parseExpression();
      this._expect(TokenType.BRACKET, ')', `Expected ')' after expression start with '('`);
    } else if (
      startToken.type === TokenType.OPERATOR &&
      (startToken.value === '+' ||
        startToken.value === '-' ||
        startToken.value === '!' ||
        startToken.value === '~')
    ) {
      this._advance();
      const operand = this._parsePrimary();
      const unaryNode: UnaryExpressionNode = {
        kind: ASTKind.UNARY_EXPRESSION,
        operator: startToken.value,
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
    while (this._check(TokenType.OPERATOR, '.')) {
      this._advance(); // skip '.'
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
