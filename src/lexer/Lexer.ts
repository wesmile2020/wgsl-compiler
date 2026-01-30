import {
  type Token,
  type LexerError,
  type LexerOutput,
  TokenType,
} from './TokenType';
import {
  SYNTAX_KEYWORDS,
  TYPE_KEYWORDS,
  BUILTIN_FUNCTIONS,
  BUILTIN_VALUES,
  ATTRIBUTES,
  THREE_CHAR_OPERATORS,
  TWO_CHAR_OPERATORS,
  OPERATOR_CHARS,
  PUNCTUATION_CHARS,
  BRACKET_CHARS,
} from './define';
import {
  isWhitespace,
  isIdentifierStart,
  isIdentifierPart,
  isDigit,
  isHexDigit,
} from './helper';

export class Lexer {
  private _syntaxKeywords: Set<string> = new Set(SYNTAX_KEYWORDS);
  private _typeKeywords: Set<string> = new Set(TYPE_KEYWORDS);
  private _builtinFunctions: Set<string> = new Set(BUILTIN_FUNCTIONS);
  private _builtinValues: Set<string> = new Set(BUILTIN_VALUES);
  private _attributes: Set<string> = new Set(ATTRIBUTES);
  private _threeCharOperators: Set<string> = new Set(THREE_CHAR_OPERATORS);
  private _twoCharOperators: Set<string> = new Set(TWO_CHAR_OPERATORS);
  private _operatorChars: Set<string> = new Set(OPERATOR_CHARS);
  private _punctuationChars: Set<string> = new Set(PUNCTUATION_CHARS);
  private _bracketChars: Set<string> = new Set(BRACKET_CHARS);

  private _position: number = 0;
  private _line: number = 1;
  private _column: number = 1;
  private _source: string = '';
  private _tokens: Token[] = [];
  private _errors: LexerError[] = [];

  tokenize(source: string): LexerOutput {
    this._position = 0;
    this._line = 1;
    this._column = 1;
    this._source = source;
    this._tokens = [];
    this._errors = [];

    while (this._position < this._source.length) {
      const char = this._source[this._position];
      if (isWhitespace(char)) {
        this._skipWhitespace();
        continue;
      }

      if (char === '/' && this._peek(1) === '/') {
        this._readLineComment();
        continue;
      }
      if (char === '/' && this._peek(1) === '*') {
        this._readBlockComment();
        continue;
      }
      if (char === '@') {
        this._readAttribute();
        continue;
      }
      if (isIdentifierStart(char)) {
        this._readIdentifierOrKeyword();
        continue;
      }
      if (isDigit(char) ||
        (char === '.' && isDigit(this._peek(1)))
      ) {
        this._readNumber();
        continue;
      }

      if (char === '"') {
        this._readString();
        continue;
      }

      this._readOperatorOrPunctuation();
    }

    return {
      tokens: this._tokens,
      errors: this._errors,
    };
  }

  private _readOperatorOrPunctuation(): void {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    // check three operator
    if (this._position + 2 < this._source.length) {
      const value = this._source.slice(this._position, this._position + 3);
      if (this._threeCharOperators.has(value)) {
        this._position += 3;
        this._column += 3;

        const token = this._createToken(TokenType.OPERATOR, value, start, startLine, startColumn);
        this._tokens.push(token);
        return;
      }
    }

    // check two operator
    if (this._position + 1 < this._source.length) {
      const value = this._source.slice(this._position, this._position + 2);
      if (this._twoCharOperators.has(value)) {
        this._position += 2;
        this._column += 2;

        const token = this._createToken(TokenType.OPERATOR, value, start, startLine, startColumn);
        this._tokens.push(token);
        return;
      }
    }

    // check one operator
    const char = this._source[this._position];
    this._position += 1;
    this._column += 1;
    let token: Token | null = null;
    if (this._punctuationChars.has(char)) {
      token = this._createToken(TokenType.PUNCTUATION, char, start, startLine, startColumn);
    } else if (this._bracketChars.has(char)) {
      token = this._createToken(TokenType.BRACKET, char, start, startLine, startColumn);
    } else if (this._operatorChars.has(char)) {
      token = this._createToken(TokenType.OPERATOR, char, start, startLine, startColumn);
    }
    if (token) {
      this._tokens.push(token);
    } else {
      // unexpected character
      this._addError(`Unexpected character '${char}'`, startLine, startColumn);
    }
  }

  private _readString(): void {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    this._position += 1;
    this._column += 1;

    let value = '';
    while (this._position < this._source.length && this._source[this._position] !== '"') {
      const char = this._source[this._position];
      if (char === '\\' && this._position + 1 < this._source.length) {
        const nextChar = this._source[this._position + 1];
        if (nextChar === 'n') {
          value += '\n';
        } else if (nextChar === 't') {
          value += '\t';
        } else if (nextChar === 'r') {
          value += '\r';
        } else if (nextChar === '\\') {
          value += '\\';
        } else if (nextChar === '"') {
          value += '"';
        } else {
          value += '\\' + nextChar;
        }
        this._position += 2;
        this._column += 2;
      } else {
        value += char;
        this._position += 1;
        this._column += 1;
      }
    }
    this._position += 1;
    this._column += 1;

    const token = this._createToken(TokenType.STRING_LITERAL, value, start, startLine, startColumn);
    this._tokens.push(token);
  }

  private _readNumber(): void {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    let isFloat = false;

    if (this._source[this._position] === '0' && this._peek(1).toLowerCase() === 'x') {
      this._position += 2;
      this._column += 2;

      while (this._position < this._source.length && isHexDigit(this._source[this._position])) {
        this._position += 1;
        this._column += 1;
      }
    } else {
      while (this._position < this._source.length && isDigit(this._source[this._position])) {
        this._position += 1;
        this._column += 1;
      }

      // deal float
      if (this._position < this._source.length && this._source[this._position] === '.') {
        isFloat = true;
        this._position += 1;
        this._column += 1;

        while (this._position < this._source.length && isDigit(this._source[this._position])) {
          this._position += 1;
          this._column += 1;
        }
      }

      // deal exponent
      if (this._position < this._source.length && this._source[this._position].toLowerCase() === 'e') {
        this._position += 1;
        this._column += 1;

        // deal sign
        const sign = this._source[this._position];
        if (sign === '+' || sign === '-') {
          this._position += 1;
          this._column += 1;
        }

        while (this._position < this._source.length && isDigit(this._source[this._position])) {
          this._position += 1;
          this._column += 1;
        }
      }

      // deal suffix
      if (this._position < this._source.length) {
        const suffix = this._source[this._position];
        if (suffix === 'f' || suffix === 'h' || suffix === 'u' || suffix === 'i') {
          if (suffix === 'f' || suffix === 'h') {
            isFloat = true;
          }
          this._position += 1;
        }
      }
    }

    const value = this._source.substring(start, this._position);
    const type = isFloat ? TokenType.FLOAT_LITERAL : TokenType.INTEGER_LITERAL;
    const token = this._createToken(type, value, start, startLine, startColumn);
    this._tokens.push(token);
  }

  private _readIdentifierOrKeyword(): void {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    const identifier = this._loadIdentifier();

    let type = TokenType.IDENTIFIER;
    if (this._syntaxKeywords.has(identifier)) {
      type = TokenType.SYNTAX_KEYWORD;
    } else if (this._typeKeywords.has(identifier)) {
      type = TokenType.TYPE_KEYWORD;
    } else if (this._builtinFunctions.has(identifier)) {
      type = TokenType.BUILTIN_FUNCTION;
    } else if (this._builtinValues.has(identifier)) {
      type = TokenType.BUILTIN_VALUE;
    }

    const token = this._createToken(type, identifier, start, startLine, startColumn);
    this._tokens.push(token);
  }

  private _readAttribute(): void {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    this._position += 1;
    this._column += 1;

    const name = this._loadIdentifier();
    if (this._attributes.has(name)) {
      const token = this._createToken(TokenType.ATTRIBUTE, name, start, startLine, startColumn);
      this._tokens.push(token);
    } else {
      this._addError(`Unknown attribute '${name}'`, startLine, startColumn);
    }
  }

  private _loadIdentifier(): string {
    const start = this._position;
    while (this._position < this._source.length && isIdentifierPart(this._source[this._position])) {
      this._position += 1;
      this._column += 1;
    }
    return this._source.slice(start, this._position);
  }

  private _readBlockComment(): void {
    const start = this._position;
    const startLine = this._line;
    const startColumn = this._column;

    this._position += 2;
    this._column += 2;

    while (this._position < this._source.length) {
      if (this._source[this._position] === '\n') {
        this._line += 1;
        this._column = 1;
      } else {
        this._column += 1;
      }
      if (this._source[this._position] === '*' && this._peek(1) === '/') {
        this._column += 2;
        this._position += 2;
        break;
      }

      this._position += 1;
    }

    if (this._position >= this._source.length) {
      this._addError('Unterminated block comment', startLine, startColumn);
      return;
    }

    const value = this._source.slice(start + 2, this._position);
    const token = this._createToken(TokenType.BLOCK_COMMENT, value, start, startLine, startColumn);
    this._tokens.push(token);
  }

  private _readLineComment(): void {
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
    const token = this._createToken(TokenType.LINE_COMMENT, value, start, startLine, startColumn);
    this._tokens.push(token);
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
      start,
      line: startLine,
      column: startColumn,
      end: this._position,
    };
  }

  private _peek(n: number): string {
    if (this._position + n >= this._source.length) {
      return '\0';
    }
    return this._source[this._position + n];
  }

  private _addError(message: string, line?: number, column?: number): void {
    this._errors.push({
      message,
      line: line ?? this._line,
      column: column ?? this._column,
      position: this._position,
    });
  }

  private _skipWhitespace(): void {
    while (this._position < this._source.length && isWhitespace(this._source[this._position])) {
      if (this._source[this._position] === '\n') {
        this._line += 1;
        this._column = 1;
      } else {
        this._column += 1;
      }
      this._position += 1;
    }
  }
}
