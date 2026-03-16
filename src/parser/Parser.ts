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
import { OPERATOR_PRECEDENCE } from './define';
import { TokenType, type Token } from '@/lexer/TokenType';
import { dealCloseTemplateToken, parseNumber } from './helper';

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

  private _expect(type: TokenType, message: string): MayBe<void> {
    if (this._check(type)) {
      this._advance();
      return { matched: true, errored: false, value: void(0) };
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
    const token = this._current();
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
      end: this._previous().end,
    }
  }

  private _error(message: string, expected?: TokenType[]): void {
    this._errors.push({
      message,
      position: this._snapshotPosition(),
      expected,
    });
  }

  private _synchronize(): void {
    while (!this._isEnd()) {
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
    this._synchronize();
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
    const start = this._snapshotPosition();

    while (!this._isEnd()) {
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
    return this._primary();
  }

  private _parseDeclaration(): ASTNode {
    if (this._match(TokenType.LET, TokenType.VAR, TokenType.CONST)) {
      return this._parseVariableDeclaration();
    }

    return this._parseStatement();
  }

  private _parseTemplateList(): ASTNode[] | null {
    if (this._match(TokenType.LESS_THAN)) {
      const list: ASTNode[] = [];
      if (!this._check(TokenType.GREATER_THAN)) {
        do {
          list.push(this._parseExpression());
        } while (this._match(TokenType.COMMA) && !this._check(TokenType.GREATER_THAN));
      }
      this._expect(TokenType.GREATER_THAN, `Expected '>' after template list`);
      return list;
    }
    return null;
  }

  private _parseVariableDeclaration(): ASTNode {
    const startToken = this._previous();
    const modifier: VariableModifierNode = {
      kind: ASTKind.VARIABLE_MODIFIER,
      name: startToken.value as Modifier,
      arguments: this._parseTemplateList(),
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
    const declarations: VariableDecoratorNode[] = [];
    do {
      const variable = this._parseVariableDecorator(startToken.value as Modifier);
      declarations.push(variable);
    } while (this._match(TokenType.COMMA));

    const declaration: VariableDeclarationNode = {
      kind: ASTKind.VARIABLE_DECLARATION,
      declarations,
      modifier,
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
    return declaration;
  }

  private _parseTypeSpecifier(): VariableTypeNode {
    const startToken = this._current();
    const nameToken = this._expect(TokenType.IDENTIFIER, 'Expected type name');
    const name = nameToken.value;
    const argumentsList = this._parseTemplateList();
    const type: VariableTypeNode = {
      kind: ASTKind.VARIABLE_TYPE,
      name,
      arguments: argumentsList,
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
    return type;
  }

  private _parseVariableDecorator(modifier: Modifier): VariableDecoratorNode {
    const identifierToken = this._expect(TokenType.IDENTIFIER, `Expected identifier after ${modifier}`);
    const identifier: IdentifierNode = {
      kind: ASTKind.IDENTIFIER,
      name: identifierToken.value,
      position: this._createPosition(identifierToken.start, this._previous().end, identifierToken),
    };

    let type: VariableTypeNode | null = null;
    if (this._match(TokenType.COLON)) {
      type = this._parseTypeSpecifier();
    }

    let initializer: ASTNode | null = null;
    if (this._match(TokenType.EQUALS)) {
      initializer = this._parseAssignment();
    }
    const variable: VariableDecoratorNode = {
      kind: ASTKind.VARIABLE_DECORATOR,
      identifier,
      type,
      initializer,
      position: this._createPosition(identifierToken.start, this._previous().end, identifierToken),
    };
    return variable;
  }

  private _parseStatement(): ASTNode {
    if (this._check(TokenType.LEFT_BRACE)) {
      return this._parseBlock();
    }
    return this._parseExpressionStatement();
  }

  private _parseBlock(): ASTNode {
    const startToken = this._current();
    this._advance();
    const body: ASTNode[] = [];
    while (!this._check(TokenType.RIGHT_BRACE)) {
      body.push(this._parseStatement());
    }
    this._expect(TokenType.RIGHT_BRACE, `Expected '}' after block`);
    const block: BlockStatementNode = {
      kind: ASTKind.BLOCK_STATEMENT,
      body,
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
    return block;
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
      const next: AssignmentExpressionNode = {
        kind: ASTKind.ASSIGNMENT_EXPRESSION,
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

    if (this._match(TokenType.PLUS_PLUS, TokenType.MINUS_MINUS)) {
      const operand = this._parseUnary();
      const update: UpdateExpressionNode = {
        kind: ASTKind.UPDATE_EXPRESSION,
        operator: startToken.value as UpdateOperator,
        operand,
        prefix: true,
        position: this._createPosition(startToken.start, this._previous().end, startToken),
      };
      return update;
    }

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
      } else if (this._match(TokenType.PLUS_PLUS, TokenType.MINUS_MINUS)) {
        expression = this._finishUpdate(expression, startToken);
      } else {
        break;
      }
    }

    return expression;
  }

  private _finishUpdate(operand: ASTNode, startToken: Token): ASTNode {
    const updateToken = this._previous();
    const update: UpdateExpressionNode = {
      kind: ASTKind.UPDATE_EXPRESSION,
      operator: updateToken.value as UpdateOperator,
      operand,
      prefix: false,
      position: this._createPosition(startToken.start, this._previous().end, updateToken),
    };
    return update;
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

  private _expression(): MayBe<ASTNode> {
    return this._primary();
  }

  private _primary(): MayBe<ASTNode> {
    const literal = this._literal();
    if (literal.matched || literal.errored) {
      return literal;
    }
    const parenExpression = this._paren_expression();
    if (parenExpression.matched || parenExpression.errored) {
      return parenExpression;
    }

    return this._call_expression();
  }

  private _paren_expression(): MayBe<ASTNode> {
    if (this._match(TokenType.LEFT_PAREN)) {
      const expression = this._expression();
      const expected = this._expect(TokenType.RIGHT_PAREN, `Expected ')' after expression start with '('`);
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
        value: parseNumber(this._previous().value),
        raw: this._previous().raw,
        position: this._makePosition(start),
      };
      return { matched: true, errored: false, value: node };
    }
    if (this._match(TokenType.BOOLEAN_LITERAL)) {
      const node: BooleanLiteralNode = {
        kind: ASTKind.BOOLEAN_LITERAL,
        value: this._previous().value === 'true',
        raw: this._previous().raw,
        position: this._makePosition(start),
      };
      return { matched: true, errored: false, value: node };
    }
    if (this._match(TokenType.STRING_LITERAL)) {
      const node: StringLiteralNode = {
        kind: ASTKind.STRING_LITERAL,
        value: this._previous().value,
        raw: this._previous().raw,
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
        name: this._previous().value,
        position: this._makePosition(start),
      };
      return { value: node, matched: true, errored: false };
    }
    return { matched: false, errored: false };
  }

  private _template_list(): MayBe<ASTNode[]> {
    if (this._match(TokenType.LESS_THAN)) {
      const args: ASTNode[] = [];
      if (!this._check(TokenType.GREATER_THAN)) {
        do {
          const expression = this._expression();
          if (expression.errored) {
            return expression;
          }
          if (expression.matched) {
            args.push(expression.value);
          }
        } while (this._match(TokenType.COMMA) && !this._check(TokenType.GREATER_THAN));
      }
      const [next, suffix] = dealCloseTemplateToken(this._current());
      this._tokens[this._position] = next;
      if (suffix) {
        this._tokens.splice(this._position + 1, 0, suffix);
      }
      const expected = this._expect(TokenType.GREATER_THAN, 'Expected > after template list');
      if (expected.errored) {
        return expected;
      }
      return { matched: true, errored: false, value: args };;
    }

    return { matched: false, errored: false };
  }
}
