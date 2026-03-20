import {
  ASTKind,
  type AssignmentExpressionNode,
  type AssignmentOperator,
  type ASTNode,
  type BinaryExpressionNode,
  type BinaryOperator,
  type BlockStatementNode,
  type BooleanLiteralNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ExpressionStatementNode,
  type IdentifierNode,
  type MayBe,
  type MemberExpressionNode,
  type Modifier,
  type NumberLiteralNode,
  type ParserError,
  type Position,
  type ProgramNode,
  type SequenceExpressionNode,
  type StringLiteralNode,
  type TemplateIdentifier,
  type UnaryExpressionNode,
  type UnaryOperator,
  type UpdateExpressionNode,
  type UpdateOperator,
  type VariableDeclarationNode,
  type VariableDecoratorNode,
  type VariableModifierNode,
  type VariableTypeNode,
} from './ASTType';
import { BINARY_OPERATOR_PRECEDENCE } from './define';
import { TokenType, type Token } from '@/lexer/TokenType';
import { parseNumber } from './helper';
import { type ILexer } from '@/lexer/Lexer';

export interface ParserOutput {
  program: ProgramNode;
  errors: ParserError[];
}

const BEGIN_TOKEN: Token = {
  type: TokenType.ERROR,
  value: 'BEGIN',
  raw: 'BEGIN',
  line: -1,
  column: -1,
  start: -1,
  end: -1,
};

export class Parser {
  private _errors: ParserError[] = [];
  private _lexer: ILexer;
  private _previous: Token = BEGIN_TOKEN;
  private _current: Token = BEGIN_TOKEN;
  private _isEnd: boolean = false;

  constructor(lexer: ILexer) {
    this._lexer = lexer;
    this._advance();
  }

  private _advance(): Token {
    if (this._lexer.isEnd()) {
      this._isEnd = true;
      return this._current;
    }

    const next = this._lexer.next();
    console.log(next.value);
    // skip comment
    if (next.value.type === TokenType.LINE_COMMENT || next.value.type === TokenType.BLOCK_COMMENT) {
      return this._advance();
    }
    this._previous = this._current;
    this._current = next.value;
    if (next.error) {
      this._error(next.error.message);
    }
    return this._previous;
  }

  private _check(type: TokenType): boolean {
    if (this._isEnd) {
      return false;
    }
    return this._current.type === type;
  }

  private _expect(type: TokenType, message: string): MayBe<Token> {
    if (this._check(type)) {
      const token = this._advance();
      return { matched: true, errored: false, value: token };
    }
    this._error(message, [type]);
    return { matched: false, errored: true };
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

  private _snapshotPosition(): Position {
    const token = this._current;
    return {
      line: token.line,
      column: token.column,
      start: token.start,
      end: token.end,
    };
  }

  private _makePosition(start: Position): Position {
    return {
      line: start.line,
      column: start.column,
      start: start.start,
      end: this._previous.end,
    };
  }

  private _makeTokenPosition(token: Token): Position {
    return {
      line: token.line,
      column: token.column,
      start: token.start,
      end: token.end,
    };
  }

  private _error(message: string, expected?: TokenType[]): void {
    this._errors.push({
      message,
      position: this._snapshotPosition(),
      expected,
    });
  }

  private _synchronize(): void {
    while (!this._isEnd) {
      const token = this._advance();
      switch (token.type) {
        case TokenType.SEMICOLON:
          this._advance();
          return;
        case TokenType.CONST:
        case TokenType.FN:
        case TokenType.FOR:
        case TokenType.IF:
        case TokenType.LET:
        case TokenType.LOOP:
        case TokenType.STRUCT:
        case TokenType.SWITCH:
        case TokenType.VAR:
        case TokenType.WHILE:
          return;
      }
      this._advance();
    }
  }

  parse(): ParserOutput {
    const body: ASTNode[] = [];
    const start = this._snapshotPosition();

    while (!this._isEnd) {
      if (this._match(TokenType.SEMICOLON)) {
        continue;
      }

      body.push(this._translation_unit());
    }

    const program: ProgramNode = {
      kind: ASTKind.PROGRAM,
      body,
      position: this._makePosition(start),
    };
    return { program, errors: this._errors };
  }

  private _translation_unit(): ASTNode {
    const start = this._snapshotPosition();
    const node = this._module();
    if (node.matched) {
      return node.value;
    }
    if (node.errored) {
      this._synchronize();
    }
    const error: ASTNode<ASTKind.ERROR> = {
      kind: ASTKind.ERROR,
      position: this._makePosition(start),
    };
    return error;
  }

  private _module(): MayBe<ASTNode> {
    return this._expression();
  }

  private _expression(): MayBe<ASTNode> {
    return this._conditional_expression();
  }

  private _conditional_expression(): MayBe<ASTNode> {
    const start = this._snapshotPosition();
    let expression = this._binary_expression();
    if (expression.errored) {
      return expression;
    }
    if (this._match(TokenType.QUESTION)) {
      const whenTrue = this._expression();
      if (whenTrue.errored) {
        return whenTrue;
      }
      const expected = this._expect(
        TokenType.COLON,
        `Expected ':' after '?' in conditional expression`,
      );
      if (expected.errored) {
        return expected;
      }
      const whenFalse = this._conditional_expression();
      if (whenFalse.errored) {
        return whenFalse;
      }
      if (expression.matched && whenTrue.matched && whenFalse.matched) {
        const node: ConditionalExpressionNode = {
          kind: ASTKind.CONDITIONAL_EXPRESSION,
          condition: expression.value,
          whenTrue: whenTrue.value,
          whenFalse: whenFalse.value,
          position: this._makePosition(start),
        };
        expression = { matched: true, errored: false, value: node };
      }
    }
    return expression;
  }

  private _binary_expression(minPrecedence: number = 0): MayBe<ASTNode> {
    const start = this._snapshotPosition();
    let expression = this._unary_expression();
    if (expression.errored) {
      return expression;
    }
    while (!this._isEnd) {
      const operatorToken = this._current;
      const operator = operatorToken.value;
      if (!(operator in BINARY_OPERATOR_PRECEDENCE)) {
        break;
      }
      const precedence = BINARY_OPERATOR_PRECEDENCE[operator];
      if (precedence < minPrecedence) {
        break;
      }
      this._advance();
      const right = this._binary_expression(precedence + 1);
      if (right.errored) {
        return right;
      }
      if (expression.matched && right.matched) {
        const node: BinaryExpressionNode = {
          kind: ASTKind.BINARY_EXPRESSION,
          operator: operator as BinaryOperator,
          left: expression.value,
          right: right.value,
          position: this._makePosition(start),
        };
        expression = { matched: true, errored: false, value: node };
      }
    }

    return expression;
  }

  private _unary_expression(): MayBe<ASTNode> {
    const start = this._snapshotPosition();
    if (
      this._match(
        TokenType.PLUS,
        TokenType.MINUS,
        TokenType.NOT,
        TokenType.TILDE,
        TokenType.STAR,
        TokenType.AND,
      )
    ) {
      const operatorToken = this._previous;
      const operand = this._unary_expression();
      if (operand.errored) {
        return operand;
      }
      if (operand.matched) {
        const node: UnaryExpressionNode = {
          kind: ASTKind.UNARY_EXPRESSION,
          operator: operatorToken.value as UnaryOperator,
          operand: operand.value,
          position: this._makePosition(start),
        };
        return { matched: true, errored: false, value: node };
      }
    }

    return this._singular_expression();
  }

  private _singular_expression(): MayBe<ASTNode> {
    const start = this._snapshotPosition();

    const primary = this._primary();
    if (primary.errored) {
      return primary;
    }
    if (primary.matched) {
      return this._component_or_swizzle_specifier(primary.value, start);
    }
    return primary;
  }

  private _component_or_swizzle_specifier(object: ASTNode, start: Position): MayBe<ASTNode> {
    if (this._match(TokenType.DOT)) {
      const expected = this._expect(TokenType.IDENTIFIER, `Expected identifier after '.'`);
      if (expected.errored) {
        return expected;
      }
      if (expected.matched) {
        const propertyToken = expected.value;
        const property: IdentifierNode = {
          kind: ASTKind.IDENTIFIER,
          name: propertyToken.value,
          position: this._makeTokenPosition(propertyToken),
        };
        const member: MemberExpressionNode = {
          kind: ASTKind.MEMBER_EXPRESSION,
          object,
          property,
          position: this._makePosition(start),
        };
        return this._component_or_swizzle_specifier(member, start);
      }
    }
    if (this._match(TokenType.LEFT_BRACKET)) {
      const index = this._expression();
      if (index.errored) {
        return index;
      }
      const expected = this._expect(TokenType.RIGHT_BRACKET, `Expected ']' after index expression`);
      if (expected.errored) {
        return expected;
      }
      if (expected.matched && index.matched) {
        const member: MemberExpressionNode = {
          kind: ASTKind.MEMBER_EXPRESSION,
          object,
          property: index.value,
          position: this._makePosition(start),
        };
        return this._component_or_swizzle_specifier(member, start);
      }
    }

    return { matched: true, errored: false, value: object };
  }

  private _primary(): MayBe<ASTNode> {
    const literal = this._literal();
    if (literal.matched || literal.errored) {
      return literal;
    }
    const parenExpression = this._paren_expression();
    if (parenExpression.errored || parenExpression.matched) {
      return parenExpression;
    }

    const call = this._call_expression();
    if (call.errored || call.matched) {
      return call;
    }
    if (this._isEnd) {
      this._error(`Unexpected token ${this._previous.value}`);
    } else {
      this._error(`Unexpected token ${this._current.value}`);
      this._advance(); // skip the unexpected token
    }
    return { matched: false, errored: true };
  }

  private _paren_expression(): MayBe<ASTNode> {
    if (this._match(TokenType.LEFT_PAREN)) {
      const expression = this._expression();
      const expected = this._expect(
        TokenType.RIGHT_PAREN,
        `Expected ')' after expression start with '('`,
      );
      if (expected.errored) {
        return expected;
      }
      if (expected.matched) {
        return expression;
      }
    }
    return { matched: false, errored: false };
  }

  private _literal(): MayBe<ASTNode> {
    const start = this._snapshotPosition();
    if (this._match(TokenType.INT_LITERAL, TokenType.FLOAT_LITERAL)) {
      const node: NumberLiteralNode = {
        kind: ASTKind.NUMBER_LITERAL,
        value: parseNumber(this._previous.value),
        raw: this._previous.raw,
        position: this._makePosition(start),
      };
      return { matched: true, errored: false, value: node };
    }
    if (this._match(TokenType.BOOLEAN_LITERAL)) {
      const node: BooleanLiteralNode = {
        kind: ASTKind.BOOLEAN_LITERAL,
        value: this._previous.value === 'true',
        raw: this._previous.raw,
        position: this._makePosition(start),
      };
      return { matched: true, errored: false, value: node };
    }
    if (this._match(TokenType.STRING_LITERAL)) {
      const node: StringLiteralNode = {
        kind: ASTKind.STRING_LITERAL,
        value: this._previous.value,
        raw: this._previous.raw,
        position: this._makePosition(start),
      };
      return { matched: true, errored: false, value: node };
    }

    return { matched: false, errored: false };
  }

  private _call_expression(): MayBe<ASTNode> {
    const start = this._snapshotPosition();
    const templateIdentifier = this._template_elaborated_ident();
    if (templateIdentifier.matched) {
      const args = this._argument_expression_list();
      if (args.errored) {
        return args;
      }
      if (args.matched) {
        const node: CallExpressionNode = {
          kind: ASTKind.CALL_EXPRESSION,
          callee: templateIdentifier.value,
          arguments: args.value,
          position: this._makePosition(start),
        };
        return { value: node, matched: true, errored: false };
      }
    }
    return templateIdentifier;
  }

  private _argument_expression_list(): MayBe<ASTNode[]> {
    if (this._match(TokenType.LEFT_PAREN)) {
      const args: ASTNode[] = [];
      if (!this._check(TokenType.RIGHT_PAREN)) {
        do {
          const expression = this._expression();
          if (expression.errored) {
            return expression;
          }
          if (expression.matched) {
            args.push(expression.value);
          }
        } while (this._match(TokenType.COMMA) && !this._check(TokenType.RIGHT_PAREN));
      }
      const expected = this._expect(TokenType.RIGHT_PAREN, `Expected ')' after arguments`);
      if (expected.errored) {
        return expected;
      }
      return { value: args, matched: true, errored: false };
    }
    return { matched: false, errored: false };
  }

  private _template_elaborated_ident(): MayBe<ASTNode> {
    const start = this._snapshotPosition();
    const identifier = this._identifier();
    if (identifier.matched) {
      const templates = this._template_list();
      if (templates.errored) {
        return templates;
      }
      if (templates.matched) {
        const node: TemplateIdentifier = {
          kind: ASTKind.TEMPLATE_IDENTIFIER,
          name: identifier.value,
          templates: templates.value,
          position: this._makePosition(start),
        };
        return { value: node, matched: true, errored: false };
      }
    }

    return identifier;
  }

  private _identifier(): MayBe<IdentifierNode> {
    const start = this._snapshotPosition();

    if (this._match(TokenType.IDENTIFIER)) {
      const node: IdentifierNode = {
        kind: ASTKind.IDENTIFIER,
        name: this._previous.value,
        position: this._makePosition(start),
      };
      return { value: node, matched: true, errored: false };
    }
    return { matched: false, errored: false };
  }

  private _is_possible_template_end(token: Token): boolean {
    return (
      token.type === TokenType.GREATER_THAN ||
      token.type === TokenType.SHIFT_RIGHT_EQUALS ||
      token.type === TokenType.GREATER_THAN_EQUALS ||
      token.type === TokenType.SHIFT_RIGHT
    );
  }

  private _template_list(): MayBe<ASTNode[]> {
    if (this._match(TokenType.LESS_THAN)) {
      const args: ASTNode[] = [];
      if (!this._is_possible_template_end(this._current)) {
        do {
          const expression = this._expression();
          if (expression.errored) {
            return expression;
          }
          if (expression.matched) {
            args.push(expression.value);
          }
        } while (this._match(TokenType.COMMA) && !this._is_possible_template_end(this._current));
      }
      const expected = this._expect(TokenType.GREATER_THAN, 'Expected > after template list');
      if (expected.errored) {
        return { matched: false, errored: false };
      }
      return { matched: true, errored: false, value: args };
    }

    return { matched: false, errored: false };
  }
}
