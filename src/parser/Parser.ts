import { ASTKind, type ASTNode, type ParserError, type Position, type ProgramNode } from './ASTType';
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

const EOF_TOKEN: Token = {
  type: TokenType.EOF,
  value: '\0',
  start: -1,
  end: -1,
  line: -1,
  column: -1,
};

export class Parser {
  private _tokens: Token[] = [];
  private _errors: ParserError[] = [];
  private _position: number = 0;

  private _previous(): Token {
    if (this._position <= 0) {
      return EOF_TOKEN;
    }
    return this._tokens[this._position - 1];
  }

  private _current(): Token {
    if (this._position >= this._tokens.length) {
      return EOF_TOKEN;
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

  private _match(...items: ICheckItem[]): boolean {
    for (let i = 0; i < items.length; i += 1) {
      if (this._check(items[i].type, items[i].value)) {
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

  parse(tokens: Token[]): ParserOutput {
    this._tokens = tokens;
    this._errors = [];
    this._position = 0;
    const body: ASTNode[] = [];
    const startToken = this._current();

    while (this._position < this._tokens.length) {

    }

    const program: ProgramNode = {
      kind: ASTKind.PROGRAM,
      body,
      position: this._createPosition(startToken.start, this._previous().end, startToken),
    };
    return { program, errors: this._errors };
  }
}
