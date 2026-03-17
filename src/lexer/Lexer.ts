import { TokenType, type LexerError, type LexerOutput, type Token } from './TokenType';
import {
  KEYWORDS,
  RESERVED_WORDS,
  THREE_SYNTACTIC_TOKENS,
  TWO_SYNTACTIC_TOKENS,
  ONE_SYNTACTIC_TOKENS,
} from './define';

const REGEX_WHITESPACE = /^\s$/;
const REGEX_IDENTIFIER_START = /^[a-zA-Z_]$/;
const REGEX_IDENTIFIER_PART = /^[a-zA-Z0-9_]$/;
const REGEX_DIGIT = /^[0-9]$/;
const REGEX_HEX_DIGIT = /^[0-9a-fA-F_]$/;

const CHAR_CODE_LOOKUP = new Uint8Array(128);
for (let i = 0; i < 128; i++) {
  const char = String.fromCharCode(i);

  CHAR_CODE_LOOKUP[i] =
    (REGEX_WHITESPACE.test(char) ? 1 : 0) |
    (REGEX_IDENTIFIER_START.test(char) ? 2 : 0) |
    (REGEX_IDENTIFIER_PART.test(char) ? 4 : 0) |
    (REGEX_DIGIT.test(char) ? 8 : 0) |
    (REGEX_HEX_DIGIT.test(char) ? 16 : 0);
}

const IS_WHITESPACE = 1;
const IS_IDENTIFIER_START = 2;
const IS_IDENTIFIER_PART = 4;
const IS_DIGIT = 8;
const IS_HEX_DIGIT = 16;

export class Lexer {
  private _line: number = 1;
  private _column: number = 1;
  private _position: number = 0;
  private _source: string = '';
  private _errors: LexerError[] = [];

  constructor(source: string) {
    this._source = source;
  }

  tokenize(): LexerOutput {
    const tokens: Token[] = [];
    this._errors = [];

    while (this._position < this._source.length) {
      const code = this._source.charCodeAt(this._position);
      // skip whitespace
      if (code < 128 && CHAR_CODE_LOOKUP[code] & IS_WHITESPACE) {
        this._position += 1;
        if (code === 10) {
          // \n
          this._line += 1;
          this._column = 1;
        } else {
          this._column += 1;
        }
        continue;
      }

      // deal comment
      if (code === 47 && this._position + 1 < this._source.length) {
        // /
        const nextCode = this._source.charCodeAt(this._position + 1);
        if (nextCode === 47) {
          tokens[tokens.length] = this._readLineComment();
          continue;
        }
        if (nextCode === 42) {
          // *
          tokens[tokens.length] = this._readBlockComment();
          continue;
        }
      }

      // deal identifier and keyword
      if (code < 128 && CHAR_CODE_LOOKUP[code] & IS_IDENTIFIER_START) {
        tokens[tokens.length] = this._readIdentifierOrKeyword();
        continue;
      }

      // deal number literal
      if (
        (code >= 48 && code <= 57) ||
        (code === 46 &&
          this._position + 1 < this._source.length &&
          REGEX_DIGIT.test(this._source[this._position + 1]))
      ) {
        // 0-9 or .[0-9]
        tokens[tokens.length] = this._readNumberLiteral();
        continue;
      }

      // deal string literal
      if (code === 34 || code === 39) {
        tokens[tokens.length] = this._readStringLiteral(this._source[this._position]);
        continue;
      }

      tokens[tokens.length] = this._readOperatorOrPunctuation();
    }

    const eof = this._createToken(TokenType.EOF, '\0', this._position, this._line, this._column);
    tokens.push(eof);

    return { tokens, errors: this._errors };
  }

  private _readOperatorOrPunctuation(): Token {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    const char = this._source[this._position];
    // three operators
    if (this._position + 2 < this._source.length) {
      const threeChar = this._source.slice(this._position, this._position + 3);
      if (threeChar in THREE_SYNTACTIC_TOKENS) {
        this._position += 3;
        this._column += 3;
        return this._createToken(
          THREE_SYNTACTIC_TOKENS[threeChar],
          threeChar,
          start,
          startLine,
          startColumn,
        );
      }
    }
    // two operators
    if (this._position + 1 < this._source.length) {
      const twoChar = this._source.slice(this._position, this._position + 2);
      if (twoChar in TWO_SYNTACTIC_TOKENS) {
        this._position += 2;
        this._column += 2;
        return this._createToken(
          TWO_SYNTACTIC_TOKENS[twoChar],
          twoChar,
          start,
          startLine,
          startColumn,
        );
      }
    }
    // one operator
    if (char in ONE_SYNTACTIC_TOKENS) {
      this._position += 1;
      this._column += 1;
      return this._createToken(ONE_SYNTACTIC_TOKENS[char], char, start, startLine, startColumn);
    }

    this._addError(
      `Unexpected character '${this._source[this._position]}'`,
      this._line,
      this._column,
    );
    this._position += 1;
    this._column += 1;

    return this._createToken(TokenType.ERROR, '\0', start, startLine, startColumn);
  }

  private _addError(message: string, line?: number, column?: number): void {
    this._errors.push({
      message,
      line: line ?? this._line,
      column: column ?? this._column,
      position: this._position,
    });
  }

  private _createToken(
    type: TokenType,
    value: string,
    start: number,
    startLine: number,
    startColumn: number,
  ): Token {
    return {
      type,
      value,
      raw: this._source.slice(start, this._position),
      start,
      line: startLine,
      column: startColumn,
      end: this._position,
    };
  }

  private _readStringLiteral(quote: string): Token {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    this._position += 1;
    this._column += 1;

    let value = '';
    let isEnd = false;

    while (this._position < this._source.length) {
      const char = this._source[this._position];
      if (char === quote) {
        isEnd = true;
        this._position += 1;
        this._column += 1;
        break;
      }
      if (char === '\\') {
        this._position += 1;
        this._column += 1;
        if (this._position < this._source.length) {
          const next = this._source[this._position];
          if (next === 'n') {
            value += '\n';
          } else if (next === 't') {
            value += '\t';
          } else if (next === 'r') {
            value += '\r';
          } else if (next === '"') {
            value += '"';
          } else if (next === '\\') {
            value += '\\';
          } else if (next === "'") {
            value += "'";
          } else if (next === '0') {
            value += '\0';
          } else {
            value += '\\' + next;
          }
          this._position += 1;
          this._column += 1;
        }
      } else {
        value += char;
        this._position += 1;
        this._column += 1;
      }
    }

    if (!isEnd) {
      this._addError('Unterminated string literal', startLine, startColumn);
      return this._createToken(TokenType.ERROR, '\0', start, startLine, startColumn);
    }

    return this._createToken(TokenType.STRING_LITERAL, value, start, startLine, startColumn);
  }

  private _readNumberLiteral(): Token {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    let type: TokenType = TokenType.INT_LITERAL;
    let DIGHT_CODE = IS_DIGIT;

    if (
      this._source[this._position] === '0' &&
      this._position + 1 < this._source.length &&
      this._source[this._position + 1].toLowerCase() === 'x'
    ) {
      // Hexadecimal number
      this._position += 2;
      this._column += 2;

      DIGHT_CODE = IS_HEX_DIGIT;
    }
    while (this._position < this._source.length) {
      const code = this._source.charCodeAt(this._position);
      if (!(code < 128 && CHAR_CODE_LOOKUP[code] & DIGHT_CODE)) {
        break;
      }
      this._position += 1;
      this._column += 1;
    }

    // deal float
    if (this._position < this._source.length && this._source[this._position] === '.') {
      this._position += 1;
      this._column += 1;

      type = TokenType.FLOAT_LITERAL;
      while (this._position < this._source.length) {
        const code = this._source.charCodeAt(this._position);
        if (!(code < 128 && CHAR_CODE_LOOKUP[code] & DIGHT_CODE)) {
          break;
        }
        this._position += 1;
        this._column += 1;
      }
    }

    // deal exponent
    if (
      this._position < this._source.length &&
      (this._source[this._position].toLowerCase() === 'e' ||
        this._source[this._position].toLowerCase() === 'p')
    ) {
      this._position += 1;
      this._column += 1;

      // deal sign
      const sign = this._source[this._position];
      if (sign === '+' || sign === '-') {
        this._position += 1;
        this._column += 1;
      }

      while (this._position < this._source.length) {
        const code = this._source.charCodeAt(this._position);
        if (!(code < 128 && CHAR_CODE_LOOKUP[code] & IS_DIGIT)) {
          break;
        }
        this._position += 1;
        this._column += 1;
      }
    }

    // deal suffix
    if (this._position < this._source.length) {
      const suffix = this._source[this._position];
      if (suffix === 'f' || suffix === 'h' || suffix === 'u' || suffix === 'i') {
        if (suffix === 'f' || suffix === 'h') {
          type = TokenType.FLOAT_LITERAL;
        }
        this._position += 1;
      }
    }

    const value = this._source.substring(start, this._position);
    return this._createToken(type, value, start, startLine, startColumn);
  }

  private _readIdentifierOrKeyword(): Token {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    this._position += 1;
    this._column += 1;
    while (this._position < this._source.length) {
      const code = this._source.charCodeAt(this._position);
      if (!(code < 128 && CHAR_CODE_LOOKUP[code] & IS_IDENTIFIER_PART)) {
        break;
      }
      this._position += 1;
      this._column += 1;
    }
    const value = this._source.slice(start, this._position);
    let type: TokenType = TokenType.IDENTIFIER;
    if (value === 'true' || value === 'false') {
      type = TokenType.BOOLEAN_LITERAL;
    } else if (value in KEYWORDS) {
      type = KEYWORDS[value];
    } else if (value in RESERVED_WORDS) {
      type = RESERVED_WORDS[value];
    }

    return this._createToken(type, value, start, startLine, startColumn);
  }

  private _readLineComment(): Token {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    this._position += 2;
    this._column += 2;

    while (this._position < this._source.length && this._source[this._position] !== '\n') {
      this._position += 1;
      this._column += 1;
    }

    const value = this._source.slice(start + 2, this._position);
    return this._createToken(TokenType.LINE_COMMENT, value, start, startLine, startColumn);
  }

  private _readBlockComment(): Token {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    this._position += 2;
    this._column += 2;

    let isEnd = false;

    while (this._position + 1 < this._source.length) {
      if (this._source[this._position] === '\n') {
        this._line += 1;
        this._column = 1;
      } else {
        this._column += 1;
      }
      if (this._source[this._position] === '*' && this._source[this._position + 1] === '/') {
        this._position += 2;
        this._column += 2;
        isEnd = true;
        break;
      }
      this._position += 1;
    }

    if (!isEnd) {
      this._addError('Unterminated block comment', startLine, startColumn);
    }

    const value = this._source.slice(start + 2, this._position - 2);
    return this._createToken(TokenType.BLOCK_COMMENT, value, start, startLine, startColumn);
  }
}
