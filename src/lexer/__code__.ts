// ============= wgsl-tokenizer.ts =============
// 词法分析器实现（修正版）

export type TokenType =
  | 'SYNTAX_KEYWORD'     // 语法关键字：fn, let, if, return 等
  | 'TYPE_KEYWORD'       // 类型关键字：i32, vec3, mat4x4 等
  | 'BUILTIN_FUNCTION'   // 内置函数：sin, cos, textureSample 等
  | 'BUILTIN_VALUE'      // 内置值：position, vertex_index 等
  | 'ATTRIBUTE'          // 属性：@group, @binding 等
  | 'IDENTIFIER'         // 用户定义的标识符
  | 'INTEGER_LITERAL'    // 整数字面量
  | 'FLOAT_LITERAL'      // 浮点数字面量
  | 'STRING_LITERAL'     // 字符串字面量
  | 'OPERATOR'           // 操作符：+, -, *, /, =, == 等
  | 'PUNCTUATION'        // 标点符号：(), {}, [], ,, ;, : 等
  | 'BRACKET'            // 尖括号：<, >
  | 'LINE_COMMENT'       // 单行注释
  | 'BLOCK_COMMENT'      // 块注释
  | 'EOF';               // 文件结束

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  hex?: boolean;
  known?: boolean;
}

export interface TokenizerOptions {
  preserveComments?: boolean;
  strictMode?: boolean;
}

// WGSL 关键字和内置函数定义
const SYNTAX_KEYWORDS = new Set<string>([
  // 声明关键字
  'fn', 'let', 'var', 'const', 'override',
  // 控制流
  'if', 'else', 'loop', 'for', 'while', 'break', 'continue', 'return',
  'switch', 'case', 'default', 'continuing', 'discard',
  // 存储类和访问模式
  'private', 'workgroup', 'uniform', 'storage', 'function',
  'read', 'write', 'read_write',
  // 其他语法元素
  'struct', 'true', 'false'
]);

const TYPE_KEYWORDS = new Set<string>([
  // 标量类型
  'i32', 'u32', 'f32', 'f16', 'bool',
  // 向量类型
  'vec2', 'vec3', 'vec4',
  // 矩阵类型
  'mat2x2', 'mat2x3', 'mat2x4', 'mat3x2', 'mat3x3', 'mat3x4',
  'mat4x2', 'mat4x3', 'mat4x4',
  // 原子类型
  'atomic',
  // 指针类型
  'ptr',
  // 数组类型
  'array',
  // 采样器类型
  'sampler', 'sampler_comparison'
]);

const TEXTURE_TYPES = new Set<string>([
  'texture_1d', 'texture_2d', 'texture_2d_array', 'texture_3d',
  'texture_cube', 'texture_cube_array', 'texture_multisampled_2d',
  'texture_storage_1d', 'texture_storage_2d', 'texture_storage_2d_array',
  'texture_storage_3d', 'texture_depth_2d', 'texture_depth_2d_array',
  'texture_depth_cube', 'texture_depth_cube_array'
]);

const BUILTIN_FUNCTIONS = new Set<string>([
  // 角度与三角函数
  'radians', 'degrees', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  // 指数函数
  'exp', 'exp2', 'log', 'log2', 'pow',
  // 几何函数
  'dot', 'cross', 'length', 'distance', 'normalize', 'faceForward',
  'reflect', 'refract',
  // 向量与矩阵函数
  'transpose', 'determinant', 'inverse',
  // 常用数学函数
  'abs', 'sign', 'floor', 'ceil', 'round', 'trunc', 'fract', 'mod',
  'min', 'max', 'clamp', 'mix', 'step', 'smoothstep',
  // 浮点数函数
  'frexp', 'ldexp', 'modf',
  // 整数函数
  'countLeadingZeros', 'countTrailingZeros', 'populationCount',
  'reverseBits',
  // 数据打包/解包
  'pack4x8snorm', 'pack4x8unorm', 'pack2x16snorm', 'pack2x16unorm',
  'pack2x16float', 'unpack4x8snorm', 'unpack4x8unorm',
  'unpack2x16snorm', 'unpack2x16unorm', 'unpack2x16float',
  // 纹理操作
  'textureDimensions', 'textureNumLayers', 'textureNumLevels',
  'textureLoad', 'textureStore', 'textureSample',
  'textureSampleBias', 'textureSampleLevel', 'textureSampleGrad',
  'textureSampleCompare', 'textureSampleCompareLevel',
  'textureGather', 'textureGatherCompare',
  // 原子操作
  'atomicLoad', 'atomicStore', 'atomicAdd', 'atomicSub',
  'atomicMax', 'atomicMin', 'atomicAnd', 'atomicOr', 'atomicXor',
  // 衍生函数（片段着色器）
  'dpdx', 'dpdy', 'fwidth', 'dpdxCoarse', 'dpdyCoarse', 'fwidthCoarse',
  'dpdxFine', 'dpdyFine', 'fwidthFine',
  // 其他
  'select', 'all', 'any'
]);

const BUILTIN_VALUES = new Set<string>([
  'vertex_index', 'instance_index', 'position', 'front_facing',
  'frag_depth', 'local_invocation_id', 'local_invocation_index',
  'global_invocation_id', 'workgroup_id', 'num_workgroups',
  'sample_index', 'sample_mask', 'subgroup_invocation_id',
  'subgroup_size'
]);

const ATTRIBUTES = new Set<string>([
  // 函数属性
  'vertex', 'fragment', 'compute',
  // 绑定属性
  'group', 'binding', 'location',
  // 内置属性
  'builtin', 'interpolate', 'invariant',
  // 结构体属性
  'size', 'align', 'stride',
  // 其他属性
  'must_use', 'binding_array', 'blend_src', 'color',
  'compute_grid_size', 'id', 'input_attachment_index',
  'inner', 'outer', 'position', 'sample',
  'storage_class', 'type', 'workgroup_size'
]);

// 多字符操作符定义
const TWO_CHAR_OPERATORS = new Set<string>([
  '==', '!=', '<=', '>=', '&&', '||', '->', '::', '<<', '>>'
]);

const THREE_CHAR_OPERATORS = new Set<string>([
  '<<=', '>>=', '...'
]);

const PUNCTUATION_CHARS = new Set<string>([
  '(', ')', '[', ']', '{', '}', ',', ';', ':'
]);

const BRACKET_CHARS = new Set<string>(['<', '>']);

const OPERATOR_CHARS = new Set<string>([
  '=', '+', '-', '*', '/', '%', '!', '&', '|', '^', '~', '.', '?'
]);

interface NumberInfo {
  value: string;
  isFloat: boolean;
  isHex: boolean;
}

interface Position {
  line: number;
  column: number;
}

/**
 * WGSL 词法分析器（修正版）
 */
export class WGSLTokenizer {
  private source: string;
  private position: number;
  private line: number;
  private column: number;
  private options: Required<TokenizerOptions>;

  constructor(sourceCode: string, options: TokenizerOptions = {}) {
    this.source = sourceCode;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.options = {
      preserveComments: options.preserveComments ?? true,
      strictMode: options.strictMode ?? false
    };
  }

  /**
   * 主词法分析函数
   */
  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.position < this.source.length) {
      const char = this.source[this.position];

      // 跳过空白字符
      if (this.isWhitespace(char)) {
        this.advance();
        continue;
      }

      // 处理注释
      if (this.isLineCommentStart()) {
        if (this.options.preserveComments) {
          tokens.push(this.readLineComment());
        } else {
          this.skipLineComment();
        }
        continue;
      }

      if (this.isBlockCommentStart()) {
        if (this.options.preserveComments) {
          tokens.push(this.readBlockComment());
        } else {
          this.skipBlockComment();
        }
        continue;
      }

      // 处理属性（以@开头）
      if (char === '@') {
        tokens.push(this.readAttribute());
        continue;
      }

      // 处理标识符和关键字
      if (this.isIdentifierStart(char)) {
        tokens.push(this.readIdentifierOrKeyword());
        continue;
      }

      // 处理数字字面量
      if (this.isNumberStart(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      // 处理字符串字面量
      if (char === '"') {
        tokens.push(this.readString());
        continue;
      }

      // 处理操作符和标点符号
      tokens.push(this.readOperatorOrPunctuation());
    }

    tokens.push({
      type: 'EOF',
      value: '',
      line: this.line,
      column: this.column
    });

    return tokens;
  }

  /**
   * 读取属性（以@开头）
   */
  private readAttribute(): Token {
    const startPos = this.getCurrentPosition();

    this.advance(); // 跳过@符号

    const attrName = this.readIdentifier();
    const isKnownAttribute = ATTRIBUTES.has(attrName);

    return {
      type: 'ATTRIBUTE',
      value: attrName,
      known: isKnownAttribute,
      line: startPos.line,
      column: startPos.column
    };
  }

  /**
   * 读取标识符或关键字（修正版）
   */
  private readIdentifierOrKeyword(): Token {
    const startPos = this.getCurrentPosition();
    const identifier = this.readIdentifier();

    // 确定标识符类型（修正后的分类）
    let type: TokenType;

    if (SYNTAX_KEYWORDS.has(identifier)) {
      type = 'SYNTAX_KEYWORD';
    } else if (TYPE_KEYWORDS.has(identifier) || TEXTURE_TYPES.has(identifier)) {
      type = 'TYPE_KEYWORD';
    } else if (BUILTIN_FUNCTIONS.has(identifier)) {
      type = 'BUILTIN_FUNCTION';
    } else if (BUILTIN_VALUES.has(identifier)) {
      type = 'BUILTIN_VALUE';
    } else {
      type = 'IDENTIFIER';
    }

    return {
      type,
      value: identifier,
      line: startPos.line,
      column: startPos.column
    };
  }

  /**
   * 读取标识符（内部辅助方法）
   */
  private readIdentifier(): string {
    const start = this.position;

    while (this.position < this.source.length &&
           this.isIdentifierPart(this.source[this.position])) {
      this.advance();
    }

    return this.source.substring(start, this.position);
  }

  /**
   * 读取数字字面量
   */
  private readNumber(): Token {
    const startPos = this.getCurrentPosition();
    const numberInfo = this.readNumberLiteral();

    return {
      type: numberInfo.isFloat ? 'FLOAT_LITERAL' : 'INTEGER_LITERAL',
      value: numberInfo.value,
      hex: numberInfo.isHex,
      line: startPos.line,
      column: startPos.column
    };
  }

  /**
   * 读取数字字面量（内部实现）
   */
  private readNumberLiteral(): NumberInfo {
    const start = this.position;
    let isFloat = false;
    let isHex = false;

    // 处理十六进制数字
    if (this.source[this.position] === '0' &&
        this.peekNextChar()?.toLowerCase() === 'x') {
      isHex = true;
      this.advance(2); // 跳过0x

      while (this.position < this.source.length &&
             this.isHexDigit(this.source[this.position])) {
        this.advance();
      }
    }
    // 处理十进制数字
    else {
      while (this.position < this.source.length &&
             this.isDigit(this.source[this.position])) {
        this.advance();
      }

      // 处理小数部分
      if (this.source[this.position] === '.') {
        isFloat = true;
        this.advance();

        while (this.position < this.source.length &&
               this.isDigit(this.source[this.position])) {
          this.advance();
        }
      }

      // 处理指数部分
      const currentChar = this.source[this.position];
      if (currentChar === 'e' || currentChar === 'E') {
        isFloat = true;
        this.advance();

        // 可能的正负号
        const sign = this.source[this.position];
        if (sign === '+' || sign === '-') {
          this.advance();
        }

        while (this.position < this.source.length &&
               this.isDigit(this.source[this.position])) {
          this.advance();
        }
      }

      // 处理类型后缀
      const suffix = this.source[this.position];
      if (suffix === 'f' || suffix === 'h' || suffix === 'u' || suffix === 'i') {
        if (suffix === 'f' || suffix === 'h') {
          isFloat = true;
        }
        this.advance();
      }
    }

    return {
      value: this.source.substring(start, this.position),
      isFloat,
      isHex
    };
  }

  /**
   * 读取字符串字面量
   */
  private readString(): Token {
    const startPos = this.getCurrentPosition();
    this.advance(); // 跳过开头的引号

    let value = '';
    while (this.position < this.source.length) {
      const char = this.source[this.position];

      if (char === '"') {
        break;
      }

      if (char === '\\') {
        this.advance(); // 跳过转义字符
        value += this.processEscapeSequence();
      } else {
        value += char;
        this.advance();
      }
    }

    this.advance(); // 跳过结尾的引号

    return {
      type: 'STRING_LITERAL',
      value,
      line: startPos.line,
      column: startPos.column
    };
  }

  /**
   * 处理转义序列
   */
  private processEscapeSequence(): string {
    if (this.position >= this.source.length) {
      return '';
    }

    const nextChar = this.source[this.position];
    this.advance();

    switch (nextChar) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case '"': return '"';
      case '\\': return '\\';
      case '\'': return '\'';
      case '0': return '\0';
      default: return '\\' + nextChar;
    }
  }

  /**
   * 读取操作符和标点符号
   */
  private readOperatorOrPunctuation(): Token {
    const startPos = this.getCurrentPosition();

    // 检查三字符操作符
    if (this.position + 2 < this.source.length) {
      const threeChar = this.source.substring(this.position, this.position + 3);
      if (THREE_CHAR_OPERATORS.has(threeChar)) {
        this.advance(3);
        return {
          type: 'OPERATOR',
          value: threeChar,
          line: startPos.line,
          column: startPos.column
        };
      }
    }

    // 检查双字符操作符
    if (this.position + 1 < this.source.length) {
      const twoChar = this.source.substring(this.position, this.position + 2);
      if (TWO_CHAR_OPERATORS.has(twoChar)) {
        this.advance(2);
        return {
          type: 'OPERATOR',
          value: twoChar,
          line: startPos.line,
          column: startPos.column
        };
      }
    }

    // 单字符操作符和标点
    const char = this.source[this.position];
    this.advance();

    let type: TokenType;
    if (PUNCTUATION_CHARS.has(char)) {
      type = 'PUNCTUATION';
    } else if (BRACKET_CHARS.has(char)) {
      type = 'BRACKET';
    } else if (OPERATOR_CHARS.has(char)) {
      type = 'OPERATOR';
    } else {
      // 未知字符，根据严格模式处理
      if (this.options.strictMode) {
        throw new Error(`Unexpected character '${char}' at ${startPos.line}:${startPos.column}`);
      }
      type = 'OPERATOR';
    }

    return {
      type,
      value: char,
      line: startPos.line,
      column: startPos.column
    };
  }

  /**
   * 读取单行注释
   */
  private readLineComment(): Token {
    const startPos = this.getCurrentPosition();

    this.advance(2); // 跳过//

    const start = this.position;
    while (this.position < this.source.length &&
           this.source[this.position] !== '\n') {
      this.advance();
    }

    const value = this.source.substring(start, this.position).trim();

    return {
      type: 'LINE_COMMENT',
      value,
      line: startPos.line,
      column: startPos.column
    };
  }

  /**
   * 读取块注释
   */
  private readBlockComment(): Token {
    const startPos = this.getCurrentPosition();

    this.advance(2); // 跳过/*

    const start = this.position;
    let depth = 1;

    while (this.position < this.source.length - 1 && depth > 0) {
      if (this.source[this.position] === '/' &&
          this.peekNextChar() === '*') {
        depth++;
        this.advance(2);
      } else if (this.source[this.position] === '*' &&
                this.peekNextChar() === '/') {
        depth--;
        this.advance(2);
      } else {
        this.advance();
      }
    }

    const value = this.source.substring(start, this.position - 2).trim();

    return {
      type: 'BLOCK_COMMENT',
      value,
      line: startPos.line,
      column: startPos.column
    };
  }

  /**
   * 跳过单行注释
   */
  private skipLineComment(): void {
    while (this.position < this.source.length &&
           this.source[this.position] !== '\n') {
      this.advance();
    }
  }

  /**
   * 跳过块注释
   */
  private skipBlockComment(): void {
    this.advance(2); // 跳过/*
    let depth = 1;

    while (this.position < this.source.length - 1 && depth > 0) {
      if (this.source[this.position] === '/' &&
          this.peekNextChar() === '*') {
        depth++;
        this.advance(2);
      } else if (this.source[this.position] === '*' &&
                this.peekNextChar() === '/') {
        depth--;
        this.advance(2);
      } else {
        this.advance();
      }
    }
  }

  /**
   * 辅助方法
   */
  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  private isIdentifierStart(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  private isIdentifierPart(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isHexDigit(char: string): boolean {
    return /[0-9a-fA-F_]/.test(char);
  }

  private isNumberStart(char: string): boolean {
    if (this.isDigit(char)) return true;
    if (char === '.' && this.position + 1 < this.source.length) {
      return this.isDigit(this.source[this.position + 1]);
    }
    return false;
  }

  private isLineCommentStart(): boolean {
    return this.source[this.position] === '/' &&
           this.peekNextChar() === '/';
  }

  private isBlockCommentStart(): boolean {
    return this.source[this.position] === '/' &&
           this.peekNextChar() === '*';
  }

  private peekNextChar(): string | null {
    if (this.position + 1 < this.source.length) {
      return this.source[this.position + 1];
    }
    return null;
  }

  private getCurrentPosition(): Position {
    return { line: this.line, column: this.column };
  }

  private advance(n: number = 1): void {
    for (let i = 0; i < n; i++) {
      if (this.position >= this.source.length) break;

      if (this.source[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.position++;
    }
  }
}

/**
 * 词法分析结果统计
 */
export interface TokenStatistics {
  total: number;
  byType: Record<TokenType, number>;
  attributes: { name: string; count: number }[];
}

/**
 * 分析词法单元统计信息
 */
export function analyzeTokens(tokens: Token[]): TokenStatistics {
  const stats: TokenStatistics = {
    total: tokens.length,
    byType: {} as Record<TokenType, number>,
    attributes: []
  };

  const attributeCounts = new Map<string, number>();

  for (const token of tokens) {
    // 统计类型数量
    stats.byType[token.type] = (stats.byType[token.type] || 0) + 1;

    // 统计属性使用情况
    if (token.type === 'ATTRIBUTE') {
      const count = attributeCounts.get(token.value) || 0;
      attributeCounts.set(token.value, count + 1);
    }
  }

  // 转换属性统计
  stats.attributes = Array.from(attributeCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return stats;
}

/**
 * 格式化显示词法分析结果
 */
export function formatTokens(tokens: Token[], limit: number = 50): string {
  let output = '序号  行:列     类型               值\n';
  output += '─'.repeat(60) + '\n';

  const displayTokens = tokens.slice(0, limit);

  displayTokens.forEach((token, index) => {
    const prefix = token.type === 'ATTRIBUTE' ? '@' : '';
    const lineCol = `${token.line}:${token.column}`.padEnd(8);
    const type = token.type.padEnd(15);
    output += `${(index + 1).toString().padStart(3)}. ${lineCol} ${type} ${prefix}${token.value}\n`;
  });

  if (tokens.length > limit) {
    output += `... 还有 ${tokens.length - limit} 个词法单元未显示\n`;
  }

  return output;
}

// ============= wgsl-parser.ts =============
// 语法分析器实现

// import { WGSLTokenizer, Token, TokenType } from './wgsl-tokenizer';

// ============= AST 类型定义 =============

export type NodeType =
  | 'Program'
  | 'FunctionDeclaration'
  | 'Parameter'
  | 'StructDeclaration'
  | 'StructMember'
  | 'VariableDeclaration'
  | 'Attribute'
  | 'TypeExpression'
  | 'Identifier'
  | 'Literal'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'CallExpression'
  | 'MemberExpression'
  | 'ReturnStatement'
  | 'IfStatement'
  | 'LoopStatement'
  | 'ForStatement'
  | 'WhileStatement'
  | 'BreakStatement'
  | 'ContinueStatement'
  | 'BlockStatement'
  | 'ExpressionStatement'
  | 'EmptyStatement';

export interface ASTNode {
  type: NodeType;
  location?: SourceLocation;
}

export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

// 程序根节点
export interface Program extends ASTNode {
  type: 'Program';
  body: (FunctionDeclaration | StructDeclaration | VariableDeclaration)[];
}

// 属性节点
export interface Attribute extends ASTNode {
  type: 'Attribute';
  name: string;
  arguments?: Expression[];
}

// 类型表达式
export interface TypeExpression extends ASTNode {
  type: 'TypeExpression';
  baseType: string;
  templateArgs?: TypeExpression[];
  storageClass?: string;
  accessMode?: string;
}

// 标识符
export interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
}

// 字面量
export interface Literal extends ASTNode {
  type: 'Literal';
  value: string | number | boolean;
  raw: string;
}

// 表达式类型（所有表达式节点的联合类型）
export type Expression =
  | Identifier
  | Literal
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression;

// 二元表达式
export interface BinaryExpression extends ASTNode {
  type: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

// 一元表达式
export interface UnaryExpression extends ASTNode {
  type: 'UnaryExpression';
  operator: string;
  argument: Expression;
}

// 函数调用表达式
export interface CallExpression extends ASTNode {
  type: 'CallExpression';
  callee: Identifier | MemberExpression;
  arguments: Expression[];
}

// 成员访问表达式
export interface MemberExpression extends ASTNode {
  type: 'MemberExpression';
  object: Expression;
  property: Identifier;
}

// 语句类型（所有语句节点的联合类型）
export type Statement =
  | BlockStatement
  | ExpressionStatement
  | ReturnStatement
  | IfStatement
  | LoopStatement
  | ForStatement
  | WhileStatement
  | BreakStatement
  | ContinueStatement
  | VariableDeclaration
  | EmptyStatement;

// 块语句
export interface BlockStatement extends ASTNode {
  type: 'BlockStatement';
  body: Statement[];
}

// 表达式语句
export interface ExpressionStatement extends ASTNode {
  type: 'ExpressionStatement';
  expression: Expression;
}

// 返回语句
export interface ReturnStatement extends ASTNode {
  type: 'ReturnStatement';
  argument?: Expression;
}

// If 语句
export interface IfStatement extends ASTNode {
  type: 'IfStatement';
  test: Expression;
  consequent: Statement;
  alternate?: Statement;
}

// Loop 语句
export interface LoopStatement extends ASTNode {
  type: 'LoopStatement';
  body: BlockStatement;
  continuing?: BlockStatement;
}

// For 语句
export interface ForStatement extends ASTNode {
  type: 'ForStatement';
  init?: VariableDeclaration | ExpressionStatement;
  test?: Expression;
  update?: Expression;
  body: Statement;
}

// While 语句
export interface WhileStatement extends ASTNode {
  type: 'WhileStatement';
  test: Expression;
  body: Statement;
}

// Break 语句
export interface BreakStatement extends ASTNode {
  type: 'BreakStatement';
}

// Continue 语句
export interface ContinueStatement extends ASTNode {
  type: 'ContinueStatement';
}

// 空语句
export interface EmptyStatement extends ASTNode {
  type: 'EmptyStatement';
}

// 函数参数
export interface Parameter extends ASTNode {
  type: 'Parameter';
  name: Identifier;
  type: TypeExpression;
  attributes?: Attribute[];
}

// 函数声明
export interface FunctionDeclaration extends ASTNode {
  type: 'FunctionDeclaration';
  name: Identifier;
  parameters: Parameter[];
  returnType?: TypeExpression;
  body: BlockStatement;
  attributes: Attribute[];
}

// 结构体成员
export interface StructMember extends ASTNode {
  type: 'StructMember';
  name: Identifier;
  type: TypeExpression;
  attributes?: Attribute[];
}

// 结构体声明
export interface StructDeclaration extends ASTNode {
  type: 'StructDeclaration';
  name: Identifier;
  members: StructMember[];
  attributes?: Attribute[];
}

// 变量声明
export interface VariableDeclaration extends ASTNode {
  type: 'VariableDeclaration';
  name: Identifier;
  type?: TypeExpression;
  storageClass?: string;
  accessMode?: string;
  initializer?: Expression;
  attributes?: Attribute[];
}

// ============= 语法分析器类 =============

export class WGSLParser {
  private tokens: Token[];
  private current: number = 0;
  private errors: ParserError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  // ============= 公共 API =============

  /**
   * 解析整个 WGSL 程序
   */
  public parse(): Program {
    const start = this.getCurrentTokenLocation();
    const body: (FunctionDeclaration | StructDeclaration | VariableDeclaration)[] = [];

    while (!this.isAtEnd()) {
      try {
        // 解析全局声明
        const decl = this.parseGlobalDeclaration();
        if (decl) {
          body.push(decl);
        }
      } catch (error) {
        this.synchronize();
      }
    }

    const end = this.getPreviousTokenLocation();

    return {
      type: 'Program',
      body,
      location: { start, end }
    };
  }

  /**
   * 获取解析过程中出现的错误
   */
  public getErrors(): ParserError[] {
    return this.errors;
  }

  /**
   * 检查是否存在解析错误
   */
  public hasErrors(): boolean {
    return this.errors.length > 0;
  }

  // ============= 解析器辅助方法 =============

  /**
   * 解析全局声明（函数、结构体、变量）
   */
  private parseGlobalDeclaration(): FunctionDeclaration | StructDeclaration | VariableDeclaration | null {
    // 处理属性
    const attributes = this.parseAttributes();

    if (this.match('SYNTAX_KEYWORD', 'fn')) {
      return this.parseFunctionDeclaration(attributes);
    } else if (this.match('SYNTAX_KEYWORD', 'struct')) {
      return this.parseStructDeclaration(attributes);
    } else if (this.match('SYNTAX_KEYWORD', 'let') || this.match('SYNTAX_KEYWORD', 'var') || this.match('SYNTAX_KEYWORD', 'const')) {
      return this.parseVariableDeclaration(attributes);
    } else if (attributes.length > 0) {
      // 属性后面没有跟随有效的声明
      this.error('Attributes must be attached to a declaration');
      return null;
    }

    this.error('Expected global declaration');
    return null;
  }

  /**
   * 解析函数声明
   */
  private parseFunctionDeclaration(attributes: Attribute[]): FunctionDeclaration {
    const start = this.getPreviousTokenLocation();

    // 函数名
    const name = this.parseIdentifier();

    // 参数列表
    this.consume('PUNCTUATION', '(');
    const parameters: Parameter[] = [];

    if (!this.check('PUNCTUATION', ')')) {
      do {
        parameters.push(this.parseParameter());
      } while (this.match('PUNCTUATION', ','));
    }

    this.consume('PUNCTUATION', ')');

    // 返回类型
    let returnType: TypeExpression | undefined;
    if (this.match('OPERATOR', '->')) {
      returnType = this.parseTypeExpression();

      // 返回类型可能也有属性
      if (this.check('ATTRIBUTE')) {
        const returnAttributes = this.parseAttributes();
        // 将属性添加到返回类型中（扩展TypeExpression以支持属性）
        if (returnAttributes.length > 0) {
          // 这里简化处理，实际应该扩展TypeExpression接口
        }
      }
    }

    // 函数体
    const body = this.parseBlockStatement();
    const end = this.getPreviousTokenLocation();

    return {
      type: 'FunctionDeclaration',
      name,
      parameters,
      returnType,
      body,
      attributes,
      location: { start, end }
    };
  }

  /**
   * 解析函数参数
   */
  private parseParameter(): Parameter {
    const start = this.getCurrentTokenLocation();

    // 参数可能有属性
    const attributes = this.parseAttributes();

    // 参数名
    const name = this.parseIdentifier();

    // 类型注解
    this.consume('PUNCTUATION', ':');
    const type = this.parseTypeExpression();

    const end = this.getPreviousTokenLocation();

    return {
      type: 'Parameter',
      name,
      type,
      attributes,
      location: { start, end }
    };
  }

  /**
   * 解析结构体声明
   */
  private parseStructDeclaration(attributes: Attribute[]): StructDeclaration {
    const start = this.getPreviousTokenLocation();

    // 结构体名
    const name = this.parseIdentifier();

    // 结构体成员
    this.consume('PUNCTUATION', '{');
    const members: StructMember[] = [];

    while (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
      members.push(this.parseStructMember());

      // 成员之间可能用逗号分隔，但不是必须的
      this.match('PUNCTUATION', ',');
    }

    this.consume('PUNCTUATION', '}');
    const end = this.getPreviousTokenLocation();

    return {
      type: 'StructDeclaration',
      name,
      members,
      attributes,
      location: { start, end }
    };
  }

  /**
   * 解析结构体成员
   */
  private parseStructMember(): StructMember {
    const start = this.getCurrentTokenLocation();

    // 成员可能有属性
    const attributes = this.parseAttributes();

    // 成员名
    const name = this.parseIdentifier();

    // 类型注解
    this.consume('PUNCTUATION', ':');
    const type = this.parseTypeExpression();

    // 成员可以有对齐和大小属性，但我们这里简化处理
    const end = this.getPreviousTokenLocation();

    return {
      type: 'StructMember',
      name,
      type,
      attributes,
      location: { start, end }
    };
  }

  /**
   * 解析变量声明
   */
  private parseVariableDeclaration(attributes: Attribute[]): VariableDeclaration {
    const start = this.getPreviousTokenLocation();

    // 存储类型 (let, var, const)
    const storageKeyword = this.previous().value;

    // 变量名
    const name = this.parseIdentifier();

    // 类型注解（可选）
    let varType: TypeExpression | undefined;
    let storageClass: string | undefined;
    let accessMode: string | undefined;

    if (this.match('BRACKET', '<')) {
      // 解析存储类和访问模式
      storageClass = this.consume('IDENTIFIER', 'Expected storage class').value;

      if (this.match('PUNCTUATION', ',')) {
        accessMode = this.consume('IDENTIFIER', 'Expected access mode').value;
      }

      this.consume('BRACKET', '>');

      if (this.match('PUNCTUATION', ':')) {
        varType = this.parseTypeExpression();
      }
    } else if (this.match('PUNCTUATION', ':')) {
      varType = this.parseTypeExpression();
    }

    // 初始值（可选）
    let initializer: Expression | undefined;
    if (this.match('OPERATOR', '=')) {
      initializer = this.parseExpression();
    }

    this.consume('PUNCTUATION', ';');
    const end = this.getPreviousTokenLocation();

    return {
      type: 'VariableDeclaration',
      name,
      type: varType,
      storageClass,
      accessMode,
      initializer,
      attributes,
      location: { start, end }
    };
  }

  /**
   * 解析类型表达式
   */
  private parseTypeExpression(): TypeExpression {
    const start = this.getCurrentTokenLocation();

    // 基础类型（允许类型关键字或标识符）
    let baseType: string;
    if (this.check('TYPE_KEYWORD') || this.check('IDENTIFIER')) {
      baseType = this.advance().value;
    } else {
      this.error('Expected type name');
      baseType = 'unknown';
    }

    // 模板参数（可选）
    let templateArgs: TypeExpression[] | undefined;
    if (this.match('BRACKET', '<')) {
      templateArgs = [];

      if (!this.check('BRACKET', '>')) {
        do {
          templateArgs.push(this.parseTypeExpression());
        } while (this.match('PUNCTUATION', ','));
      }

      this.consume('BRACKET', '>');
    }

    const end = this.getPreviousTokenLocation();

    return {
      type: 'TypeExpression',
      baseType,
      templateArgs,
      location: { start, end }
    };
  }

  /**
   * 解析属性列表
   */
  private parseAttributes(): Attribute[] {
    const attributes: Attribute[] = [];

    while (this.check('ATTRIBUTE')) {
      attributes.push(this.parseAttribute());
    }

    return attributes;
  }

  /**
   * 解析单个属性
   */
  private parseAttribute(): Attribute {
    const start = this.getCurrentTokenLocation();

    this.consume('ATTRIBUTE'); // 消耗@符号

    const name = this.consume('IDENTIFIER', 'Expected attribute name').value;

    // 属性参数（可选）
    let arguments_: Expression[] | undefined;
    if (this.match('PUNCTUATION', '(')) {
      arguments_ = [];

      if (!this.check('PUNCTUATION', ')')) {
        do {
          arguments_.push(this.parseExpression());
        } while (this.match('PUNCTUATION', ','));
      }

      this.consume('PUNCTUATION', ')');
    }

    const end = this.getPreviousTokenLocation();

    return {
      type: 'Attribute',
      name,
      arguments: arguments_,
      location: { start, end }
    };
  }

  /**
   * 解析语句
   */
  private parseStatement(): Statement {
    if (this.match('PUNCTUATION', ';')) {
      return this.parseEmptyStatement();
    } else if (this.match('SYNTAX_KEYWORD', 'return')) {
      return this.parseReturnStatement();
    } else if (this.match('SYNTAX_KEYWORD', 'if')) {
      return this.parseIfStatement();
    } else if (this.match('SYNTAX_KEYWORD', 'loop')) {
      return this.parseLoopStatement();
    } else if (this.match('SYNTAX_KEYWORD', 'for')) {
      return this.parseForStatement();
    } else if (this.match('SYNTAX_KEYWORD', 'while')) {
      return this.parseWhileStatement();
    } else if (this.match('SYNTAX_KEYWORD', 'break')) {
      return this.parseBreakStatement();
    } else if (this.match('SYNTAX_KEYWORD', 'continue')) {
      return this.parseContinueStatement();
    } else if (this.match('PUNCTUATION', '{')) {
      return this.parseBlockStatement();
    } else if (this.match('SYNTAX_KEYWORD', 'let') || this.match('SYNTAX_KEYWORD', 'var') || this.match('SYNTAX_KEYWORD', 'const')) {
      return this.parseVariableDeclaration([]);
    } else {
      return this.parseExpressionStatement();
    }
  }

  /**
   * 解析块语句
   */
  private parseBlockStatement(): BlockStatement {
    const start = this.getPreviousTokenLocation();
    const body: Statement[] = [];

    while (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
      body.push(this.parseStatement());
    }

    this.consume('PUNCTUATION', '}');
    const end = this.getPreviousTokenLocation();

    return {
      type: 'BlockStatement',
      body,
      location: { start, end }
    };
  }

  /**
   * 解析表达式语句
   */
  private parseExpressionStatement(): ExpressionStatement {
    const start = this.getCurrentTokenLocation();
    const expression = this.parseExpression();

    // 表达式语句以分号结束
    if (!this.match('PUNCTUATION', ';')) {
      this.error('Expected ; after expression');
    }

    const end = this.getPreviousTokenLocation();

    return {
      type: 'ExpressionStatement',
      expression,
      location: { start, end }
    };
  }

  /**
   * 解析返回语句
   */
  private parseReturnStatement(): ReturnStatement {
    const start = this.getPreviousTokenLocation();
    let argument: Expression | undefined;

    if (!this.check('PUNCTUATION', ';')) {
      argument = this.parseExpression();
    }

    this.consume('PUNCTUATION', ';');
    const end = this.getPreviousTokenLocation();

    return {
      type: 'ReturnStatement',
      argument,
      location: { start, end }
    };
  }

  /**
   * 解析 If 语句
   */
  private parseIfStatement(): IfStatement {
    const start = this.getPreviousTokenLocation();

    // 条件
    this.consume('PUNCTUATION', '(');
    const test = this.parseExpression();
    this.consume('PUNCTUATION', ')');

    // 主分支
    const consequent = this.parseStatement();

    // Else 分支（可选）
    let alternate: Statement | undefined;
    if (this.match('SYNTAX_KEYWORD', 'else')) {
      alternate = this.parseStatement();
    }

    const end = alternate?.location?.end || consequent.location?.end || this.getPreviousTokenLocation();

    return {
      type: 'IfStatement',
      test,
      consequent,
      alternate,
      location: { start, end }
    };
  }

  /**
   * 解析 Loop 语句
   */
  private parseLoopStatement(): LoopStatement {
    const start = this.getPreviousTokenLocation();
    const body = this.parseBlockStatement();

    // Continuing 部分（可选）
    let continuing: BlockStatement | undefined;
    if (this.match('SYNTAX_KEYWORD', 'continuing')) {
      continuing = this.parseBlockStatement();
    }

    const end = continuing?.location?.end || body.location?.end;

    return {
      type: 'LoopStatement',
      body,
      continuing,
      location: { start, end }
    };
  }

  /**
   * 解析 For 语句
   */
  private parseForStatement(): ForStatement {
    const start = this.getPreviousTokenLocation();

    this.consume('PUNCTUATION', '(');

    // 初始化部分（可选）
    let init: VariableDeclaration | ExpressionStatement | undefined;
    if (!this.check('PUNCTUATION', ';')) {
      if (this.match('SYNTAX_KEYWORD', 'let') || this.match('SYNTAX_KEYWORD', 'var')) {
        init = this.parseVariableDeclaration([]);
      } else {
        init = this.parseExpressionStatement();
      }
    } else {
      this.advance(); // 跳过 ;
    }

    // 条件部分（可选）
    let test: Expression | undefined;
    if (!this.check('PUNCTUATION', ';')) {
      test = this.parseExpression();
    }
    this.consume('PUNCTUATION', ';');

    // 更新部分（可选）
    let update: Expression | undefined;
    if (!this.check('PUNCTUATION', ')')) {
      update = this.parseExpression();
    }
    this.consume('PUNCTUATION', ')');

    // 循环体
    const body = this.parseStatement();
    const end = body.location?.end || this.getPreviousTokenLocation();

    return {
      type: 'ForStatement',
      init,
      test,
      update,
      body,
      location: { start, end }
    };
  }

  /**
   * 解析 While 语句
   */
  private parseWhileStatement(): WhileStatement {
    const start = this.getPreviousTokenLocation();

    this.consume('PUNCTUATION', '(');
    const test = this.parseExpression();
    this.consume('PUNCTUATION', ')');

    const body = this.parseStatement();
    const end = body.location?.end || this.getPreviousTokenLocation();

    return {
      type: 'WhileStatement',
      test,
      body,
      location: { start, end }
    };
  }

  /**
   * 解析 Break 语句
   */
  private parseBreakStatement(): BreakStatement {
    const start = this.getPreviousTokenLocation();
    this.consume('PUNCTUATION', ';');
    const end = this.getPreviousTokenLocation();

    return {
      type: 'BreakStatement',
      location: { start, end }
    };
  }

  /**
   * 解析 Continue 语句
   */
  private parseContinueStatement(): ContinueStatement {
    const start = this.getPreviousTokenLocation();
    this.consume('PUNCTUATION', ';');
    const end = this.getPreviousTokenLocation();

    return {
      type: 'ContinueStatement',
      location: { start, end }
    };
  }

  /**
   * 解析空语句
   */
  private parseEmptyStatement(): EmptyStatement {
    const start = this.getPreviousTokenLocation();
    const end = this.getPreviousTokenLocation();

    return {
      type: 'EmptyStatement',
      location: { start, end }
    };
  }

  /**
   * 解析表达式（主入口点）
   */
  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  /**
   * 解析赋值表达式
   */
  private parseAssignment(): Expression {
    const expr = this.parseLogicalOr();

    if (this.match('OPERATOR', '=') || this.match('OPERATOR', '+=') ||
        this.match('OPERATOR', '-=') || this.match('OPERATOR', '*=') ||
        this.match('OPERATOR', '/=') || this.match('OPERATOR', '%=')) {
      const operator = this.previous().value;
      const right = this.parseAssignment();

      return {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          start: expr.location!.start,
          end: right.location!.end
        }
      } as BinaryExpression;
    }

    return expr;
  }

  /**
   * 解析逻辑或表达式
   */
  private parseLogicalOr(): Expression {
    let expr = this.parseLogicalAnd();

    while (this.match('OPERATOR', '||')) {
      const operator = this.previous().value;
      const right = this.parseLogicalAnd();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          start: expr.location!.start,
          end: right.location!.end
        }
      } as BinaryExpression;
    }

    return expr;
  }

  /**
   * 解析逻辑与表达式
   */
  private parseLogicalAnd(): Expression {
    let expr = this.parseEquality();

    while (this.match('OPERATOR', '&&')) {
      const operator = this.previous().value;
      const right = this.parseEquality();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          start: expr.location!.start,
          end: right.location!.end
        }
      } as BinaryExpression;
    }

    return expr;
  }

  /**
   * 解析相等性表达式
   */
  private parseEquality(): Expression {
    let expr = this.parseComparison();

    while (this.match('OPERATOR', '==') || this.match('OPERATOR', '!=')) {
      const operator = this.previous().value;
      const right = this.parseComparison();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          start: expr.location!.start,
          end: right.location!.end
        }
      } as BinaryExpression;
    }

    return expr;
  }

  /**
   * 解析比较表达式
   */
  private parseComparison(): Expression {
    let expr = this.parseShift();

    while (this.match('OPERATOR', '<') || this.match('OPERATOR', '>') ||
           this.match('OPERATOR', '<=') || this.match('OPERATOR', '>=')) {
      const operator = this.previous().value;
      const right = this.parseShift();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          start: expr.location!.start,
          end: right.location!.end
        }
      } as BinaryExpression;
    }

    return expr;
  }

  /**
   * 解析位移表达式
   */
  private parseShift(): Expression {
    let expr = this.parseAdditive();

    while (this.match('OPERATOR', '<<') || this.match('OPERATOR', '>>')) {
      const operator = this.previous().value;
      const right = this.parseAdditive();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          start: expr.location!.start,
          end: right.location!.end
        }
      } as BinaryExpression;
    }

    return expr;
  }

  /**
   * 解析加法表达式
   */
  private parseAdditive(): Expression {
    let expr = this.parseMultiplicative();

    while (this.match('OPERATOR', '+') || this.match('OPERATOR', '-')) {
      const operator = this.previous().value;
      const right = this.parseMultiplicative();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          start: expr.location!.start,
          end: right.location!.end
        }
      } as BinaryExpression;
    }

    return expr;
  }

  /**
   * 解析乘法表达式
   */
  private parseMultiplicative(): Expression {
    let expr = this.parseUnary();

    while (this.match('OPERATOR', '*') || this.match('OPERATOR', '/') || this.match('OPERATOR', '%')) {
      const operator = this.previous().value;
      const right = this.parseUnary();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          start: expr.location!.start,
          end: right.location!.end
        }
      } as BinaryExpression;
    }

    return expr;
  }

  /**
   * 解析一元表达式
   */
  private parseUnary(): Expression {
    if (this.match('OPERATOR', '!') || this.match('OPERATOR', '-') || this.match('OPERATOR', '~')) {
      const operator = this.previous().value;
      const start = this.previousLocation();
      const argument = this.parseUnary();

      return {
        type: 'UnaryExpression',
        operator,
        argument,
        location: {
          start,
          end: argument.location!.end
        }
      } as UnaryExpression;
    }

    return this.parseCall();
  }

  /**
   * 解析函数调用和成员访问
   */
  private parseCall(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match('PUNCTUATION', '(')) {
        // 函数调用
        const args: Expression[] = [];

        if (!this.check('PUNCTUATION', ')')) {
          do {
            args.push(this.parseExpression());
          } while (this.match('PUNCTUATION', ','));
        }

        this.consume('PUNCTUATION', ')');

        expr = {
          type: 'CallExpression',
          callee: expr,
          arguments: args,
          location: {
            start: expr.location!.start,
            end: this.getPreviousTokenLocation()
          }
        } as CallExpression;
      } else if (this.match('OPERATOR', '.')) {
        // 成员访问
        const property = this.parseIdentifier();

        expr = {
          type: 'MemberExpression',
          object: expr,
          property,
          location: {
            start: expr.location!.start,
            end: property.location!.end
          }
        } as MemberExpression;
      } else {
        break;
      }
    }

    return expr;
  }

  /**
   * 解析基本表达式
   */
  private parsePrimary(): Expression {
    const start = this.getCurrentTokenLocation();

    if (this.match('SYNTAX_KEYWORD', 'true') || this.match('SYNTAX_KEYWORD', 'false')) {
      const end = this.getPreviousTokenLocation();
      return {
        type: 'Literal',
        value: this.previous().value === 'true',
        raw: this.previous().value,
        location: { start, end }
      } as Literal;
    }

    if (this.match('INTEGER_LITERAL') || this.match('FLOAT_LITERAL') || this.match('STRING_LITERAL')) {
      const token = this.previous();
      const end = this.getPreviousTokenLocation();

      let value: string | number | boolean;
      if (token.type === 'STRING_LITERAL') {
        value = token.value;
      } else if (token.type === 'FLOAT_LITERAL') {
        value = parseFloat(token.value);
      } else {
        value = parseInt(token.value);
      }

      return {
        type: 'Literal',
        value,
        raw: token.value,
        location: { start, end }
      } as Literal;
    }

    if (this.match('PUNCTUATION', '(')) {
      const expr = this.parseExpression();
      this.consume('PUNCTUATION', ')');
      return expr;
    }

    // 默认情况：标识符
    return this.parseIdentifier();
  }

  /**
   * 解析标识符
   */
  private parseIdentifier(): Identifier {
    const start = this.getCurrentTokenLocation();

    if (this.check('IDENTIFIER') || this.check('SYNTAX_KEYWORD') ||
        this.check('TYPE_KEYWORD') || this.check('BUILTIN_FUNCTION') ||
        this.check('BUILTIN_VALUE')) {
      const token = this.advance();
      const end = this.getPreviousTokenLocation();

      return {
        type: 'Identifier',
        name: token.value,
        location: { start, end }
      };
    }

    this.error('Expected identifier');

    // 错误恢复：返回一个虚拟标识符
    const end = this.getCurrentTokenLocation();
    return {
      type: 'Identifier',
      name: '_error',
      location: { start, end }
    };
  }

  // ============= 词法单元处理辅助方法 =============

  private match(type: TokenType, value?: string): boolean {
    if (this.check(type, value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: TokenType, value?: string): boolean {
    if (this.isAtEnd()) return false;
    const token = this.tokens[this.current];
    return token.type === type && (value === undefined || token.value === value);
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private consume(type: TokenType, errorMessage?: string): Token {
    if (this.check(type)) {
      return this.advance();
    }

    const token = this.peek();
    this.error(errorMessage || `Expected ${type}, got ${token.type} '${token.value}'`);

    // 返回一个虚拟token以便继续解析
    return {
      type,
      value: '',
      line: token.line,
      column: token.column
    };
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.peek().type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private previousLocation(): { line: number; column: number } {
    const token = this.previous();
    return { line: token.line, column: token.column };
  }

  private getCurrentTokenLocation(): { line: number; column: number } {
    const token = this.peek();
    return { line: token.line, column: token.column };
  }

  private getPreviousTokenLocation(): { line: number; column: number } {
    const token = this.previous();
    return { line: token.line, column: token.column };
  }

  private error(message: string): void {
    const token = this.peek();
    const error: ParserError = {
      message,
      line: token.line,
      column: token.column
    };
    this.errors.push(error);
    throw new ParserError(error);
  }

  /**
   * 错误恢复：跳过直到下一个语句边界
   */
  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === 'PUNCTUATION' && this.previous().value === ';') {
        return;
      }

      if (this.peek().type === 'SYNTAX_KEYWORD') {
        const keywords = ['fn', 'struct', 'let', 'var', 'const', 'if', 'for', 'while', 'loop', 'return'];
        if (keywords.includes(this.peek().value)) {
          return;
        }
      }

      this.advance();
    }
  }
}

// ============= 错误处理 =============

export interface ParserError {
  message: string;
  line: number;
  column: number;
}

class ParserError extends Error {
  public line: number;
  public column: number;

  constructor(error: ParserError) {
    super(`Parse error at ${error.line}:${error.column}: ${error.message}`);
    this.name = 'ParserError';
    this.line = error.line;
    this.column = error.column;
  }
}

// ============= AST 遍历和打印工具 =============

export class ASTPrinter {
  private indent: number = 0;

  public print(node: ASTNode): string {
    return this.printNode(node);
  }

  private printNode(node: ASTNode): string {
    const indentStr = '  '.repeat(this.indent);
    let result = `${indentStr}${node.type}`;

    if (node.location) {
      const { start, end } = node.location;
      result += ` [${start.line}:${start.column}-${end.line}:${end.column}]`;
    }

    switch (node.type) {
      case 'Program':
        const program = node as Program;
        result += `\n`;
        this.indent++;
        for (const child of program.body) {
          result += this.printNode(child) + '\n';
        }
        this.indent--;
        break;

      case 'FunctionDeclaration':
        const func = node as FunctionDeclaration;
        result += `: ${func.name.name}`;
        if (func.returnType) {
          result += ` -> ${this.typeToString(func.returnType)}`;
        }
        result += '\n';

        if (func.attributes.length > 0) {
          this.indent++;
          result += `${'  '.repeat(this.indent)}Attributes:\n`;
          this.indent++;
          for (const attr of func.attributes) {
            result += this.printNode(attr) + '\n';
          }
          this.indent -= 2;
        }

        this.indent++;
        if (func.parameters.length > 0) {
          result += `${'  '.repeat(this.indent)}Parameters:\n`;
          this.indent++;
          for (const param of func.parameters) {
            result += this.printNode(param) + '\n';
          }
          this.indent--;
        }

        result += `${'  '.repeat(this.indent)}Body:\n`;
        this.indent++;
        result += this.printNode(func.body) + '\n';
        this.indent--;
        this.indent--;
        break;

      case 'Parameter':
        const param = node as Parameter;
        result += `: ${param.name.name}: ${this.typeToString(param.type)}`;
        break;

      case 'StructDeclaration':
        const struct = node as StructDeclaration;
        result += `: ${struct.name.name}\n`;
        this.indent++;
        for (const member of struct.members) {
          result += this.printNode(member) + '\n';
        }
        this.indent--;
        break;

      case 'StructMember':
        const member = node as StructMember;
        result += `: ${member.name.name}: ${this.typeToString(member.type)}`;
        break;

      case 'VariableDeclaration':
        const varDecl = node as VariableDeclaration;
        result += `: ${varDecl.name.name}`;
        if (varDecl.type) {
          result += `: ${this.typeToString(varDecl.type)}`;
        }
        if (varDecl.initializer) {
          result += ` = ${this.expressionToString(varDecl.initializer)}`;
        }
        break;

      case 'Attribute':
        const attr = node as Attribute;
        result += `: @${attr.name}`;
        if (attr.arguments && attr.arguments.length > 0) {
          result += `(${attr.arguments.map(arg => this.expressionToString(arg)).join(', ')})`;
        }
        break;

      case 'TypeExpression':
        const typeExpr = node as TypeExpression;
        result += `: ${this.typeToString(typeExpr)}`;
        break;

      case 'Identifier':
        const id = node as Identifier;
        result += `: ${id.name}`;
        break;

      case 'Literal':
        const lit = node as Literal;
        result += `: ${lit.raw}`;
        break;

      case 'BinaryExpression':
        const binary = node as BinaryExpression;
        result += `: ${this.expressionToString(binary.left)} ${binary.operator} ${this.expressionToString(binary.right)}`;
        break;

      case 'UnaryExpression':
        const unary = node as UnaryExpression;
        result += `: ${unary.operator}${this.expressionToString(unary.argument)}`;
        break;

      case 'CallExpression':
        const call = node as CallExpression;
        result += `: ${this.expressionToString(call.callee)}(${call.arguments.map(arg => this.expressionToString(arg)).join(', ')})`;
        break;

      case 'MemberExpression':
        const memberExpr = node as MemberExpression;
        result += `: ${this.expressionToString(memberExpr.object)}.${memberExpr.property.name}`;
        break;

      case 'BlockStatement':
        const block = node as BlockStatement;
        result += `:\n`;
        this.indent++;
        for (const stmt of block.body) {
          result += this.printNode(stmt) + '\n';
        }
        this.indent--;
        break;

      case 'ReturnStatement':
        const ret = node as ReturnStatement;
        result += `: ${ret.argument ? this.expressionToString(ret.argument) : ''}`;
        break;

      case 'IfStatement':
        const ifStmt = node as IfStatement;
        result += `: if ${this.expressionToString(ifStmt.test)}\n`;
        this.indent++;
        result += `${'  '.repeat(this.indent)}Then:\n`;
        this.indent++;
        result += this.printNode(ifStmt.consequent) + '\n';
        this.indent--;

        if (ifStmt.alternate) {
          result += `${'  '.repeat(this.indent)}Else:\n`;
          this.indent++;
          result += this.printNode(ifStmt.alternate) + '\n';
          this.indent--;
        }
        this.indent--;
        break;

      default:
        // 其他节点类型
        break;
    }

    return result;
  }

  private typeToString(type: TypeExpression): string {
    let result = type.baseType;

    if (type.templateArgs && type.templateArgs.length > 0) {
      result += `<${type.templateArgs.map(arg => this.typeToString(arg)).join(', ')}>`;
    }

    return result;
  }

  private expressionToString(expr: Expression): string {
    switch (expr.type) {
      case 'Identifier':
        return (expr as Identifier).name;
      case 'Literal':
        return (expr as Literal).raw;
      case 'BinaryExpression':
        const binary = expr as BinaryExpression;
        return `${this.expressionToString(binary.left)} ${binary.operator} ${this.expressionToString(binary.right)}`;
      case 'UnaryExpression':
        const unary = expr as UnaryExpression;
        return `${unary.operator}${this.expressionToString(unary.argument)}`;
      case 'CallExpression':
        const call = expr as CallExpression;
        return `${this.expressionToString(call.callee)}(${call.arguments.map(arg => this.expressionToString(arg)).join(', ')})`;
      case 'MemberExpression':
        const member = expr as MemberExpression;
        return `${this.expressionToString(member.object)}.${member.property.name}`;
      default:
        return expr.type;
    }
  }
}

// ============= 主测试文件 =============
// index.ts 或 test.ts

if (require.main === module) {
  const testWGSL = `
@group(0) @binding(0)
var<uniform> mvp: mat4x4<f32>;

@vertex
fn main(
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>
) -> @builtin(position) vec4<f32> {
    // 矩阵变换
    let transformed = mvp * vec4<f32>(position, 1.0);

    /* 返回带颜色的位置 */
    return vec4<f32>(transformed.xyz, color.x);
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
}

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) id: vec3<u32>) {
    // 计算着色器示例
    let index = id.x;

    // 使用内置函数
    let sinValue = sin(3.14159);
    let normalized = normalize(vec3<f32>(1.0, 2.0, 3.0));

    if (index < 100u) {
        // 做一些计算
        var sum = 0.0;
        for (var i = 0u; i < index; i++) {
            sum += f32(i) * 0.5;
        }

        // 原子操作示例
        atomicAdd(&global_counter, 1u);
    }
}
`;

  console.log('=== WGSL 编译器前端测试 ===\n');
  console.log('源代码:');
  console.log(testWGSL);
  console.log('\n' + '='.repeat(80) + '\n');

  try {
    // 词法分析
    const start = performance.now();
    const tokenizer = new WGSLTokenizer(testWGSL, {
      preserveComments: true,
      strictMode: false
    });
    const tokens = tokenizer.tokenize();
    console.log(`词法分析完成，共 ${tokens.length} 个词法单元 spend ${performance.now() - start}ms\n`);

    // 显示词法单元统计
    const tokenStats = analyzeTokens(tokens);
    console.log('词法单元统计:');
    Object.entries(tokenStats.byType)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type.padEnd(20)}: ${count}`);
      });

    // 显示属性统计
    console.log('\n属性使用统计:');
    tokenStats.attributes.forEach(attr => {
      console.log(`  @${attr.name.padEnd(20)}: ${attr.count} 次`);
    });

    process.exit(0);
    // 语法分析
    const parser = new WGSLParser(tokens);
    const ast = parser.parse();

    // 检查错误
    if (parser.hasErrors()) {
      console.log('\n解析错误:');
      parser.getErrors().forEach(error => {
        console.log(`  [${error.line}:${error.column}] ${error.message}`);
      });
    } else {
      console.log('\n语法分析成功!\n');

      // 打印 AST
      const printer = new ASTPrinter();
      console.log('抽象语法树 (AST):');
      console.log(printer.print(ast));

      // AST 统计信息
      console.log('\nAST 节点统计:');
      const stats = countASTNodes(ast);
      Object.entries(stats).sort(([,a], [,b]) => b - a).forEach(([type, count]) => {
        console.log(`  ${type.padEnd(25)}: ${count}`);
      });
    }
  } catch (error) {
    console.error('解析失败:', error);
  }
}

// AST 节点统计工具函数
function countASTNodes(node: ASTNode): Record<string, number> {
  const counts: Record<string, number> = {};

  function visit(node: ASTNode) {
    const type = node.type;
    counts[type] = (counts[type] || 0) + 1;

    // 递归访问子节点
    switch (type) {
      case 'Program':
        const program = node as Program;
        program.body.forEach(visit);
        break;
      case 'FunctionDeclaration':
        const func = node as FunctionDeclaration;
        visit(func.body);
        func.parameters.forEach(visit);
        if (func.returnType) visit(func.returnType);
        func.attributes.forEach(visit);
        break;
      case 'BlockStatement':
        const block = node as BlockStatement;
        block.body.forEach(visit);
        break;
      case 'BinaryExpression':
        const binary = node as BinaryExpression;
        visit(binary.left);
        visit(binary.right);
        break;
      case 'UnaryExpression':
        const unary = node as UnaryExpression;
        visit(unary.argument);
        break;
      case 'CallExpression':
        const call = node as CallExpression;
        visit(call.callee);
        call.arguments.forEach(visit);
        break;
      case 'MemberExpression':
        const member = node as MemberExpression;
        visit(member.object);
        visit(member.property);
        break;
      case 'IfStatement':
        const ifStmt = node as IfStatement;
        visit(ifStmt.test);
        visit(ifStmt.consequent);
        if (ifStmt.alternate) visit(ifStmt.alternate);
        break;
      case 'StructDeclaration':
        const struct = node as StructDeclaration;
        struct.members.forEach(visit);
        break;
      case 'VariableDeclaration':
        const varDecl = node as VariableDeclaration;
        if (varDecl.type) visit(varDecl.type);
        if (varDecl.initializer) visit(varDecl.initializer);
        break;
      // 其他节点类型的递归访问...
    }
  }

  visit(node);
  return counts;
}
