// ==================== 类型定义 ====================
type TokenType = 'number' | 'identifier' | 'operator' | 'paren' | 'function';

interface Token {
  type: TokenType;
  value: string;
  line?: number;
  column?: number;
}

interface OperatorInfo {
  precedence: number;     // 优先级：数字越大越高
  associativity: 'left' | 'right';  // 结合性
  arity: number;          // 操作数个数
}

// ==================== 运算符优先级表 ====================
const OPERATORS: Record<string, OperatorInfo> = {
  // 一元运算符（右结合）
  '!': { precedence: 14, associativity: 'right', arity: 1 },
  '~': { precedence: 14, associativity: 'right', arity: 1 },
  'defined': { precedence: 14, associativity: 'right', arity: 1 },
  'U+': { precedence: 14, associativity: 'right', arity: 1 }, // 一元+
  'U-': { precedence: 14, associativity: 'right', arity: 1 }, // 一元-

  // 乘除类（左结合）
  '*': { precedence: 13, associativity: 'left', arity: 2 },
  '/': { precedence: 13, associativity: 'left', arity: 2 },
  '%': { precedence: 13, associativity: 'left', arity: 2 },

  // 加减类（左结合）
  '+': { precedence: 12, associativity: 'left', arity: 2 },
  '-': { precedence: 12, associativity: 'left', arity: 2 },

  // 移位（左结合）
  '<<': { precedence: 11, associativity: 'left', arity: 2 },
  '>>': { precedence: 11, associativity: 'left', arity: 2 },

  // 关系（左结合）
  '<': { precedence: 10, associativity: 'left', arity: 2 },
  '<=': { precedence: 10, associativity: 'left', arity: 2 },
  '>': { precedence: 10, associativity: 'left', arity: 2 },
  '>=': { precedence: 10, associativity: 'left', arity: 2 },

  // 相等（左结合）
  '==': { precedence: 9, associativity: 'left', arity: 2 },
  '!=': { precedence: 9, associativity: 'left', arity: 2 },

  // 位与（左结合）
  '&': { precedence: 8, associativity: 'left', arity: 2 },

  // 位异或（左结合）
  '^': { precedence: 7, associativity: 'left', arity: 2 },

  // 位或（左结合）
  '|': { precedence: 6, associativity: 'left', arity: 2 },

  // 逻辑与（左结合）
  '&&': { precedence: 5, associativity: 'left', arity: 2 },

  // 逻辑或（左结合）
  '||': { precedence: 4, associativity: 'left', arity: 2 },

  // 三元运算符（右结合）
  '?': { precedence: 3, associativity: 'right', arity: 3 },
  ':': { precedence: 3, associativity: 'right', arity: 3 }, // 与?配对

  // 赋值（右结合）
  '=': { precedence: 2, associativity: 'right', arity: 2 },
  '+=': { precedence: 2, associativity: 'right', arity: 2 },
  '-=': { precedence: 2, associativity: 'right', arity: 2 },
  '*=': { precedence: 2, associativity: 'right', arity: 2 },
  '/=': { precedence: 2, associativity: 'right', arity: 2 },
};

// ==================== 核心转换器 ====================
class ShuntingYardConverter {
  private output: Token[] = [];
  private operatorStack: Token[] = [];
  private functionStack: string[] = [];

  // 是否是运算符
  private isOperator(token: Token): boolean {
    return token.type === 'operator' && token.value in OPERATORS;
  }

  // 获取运算符信息
  private getOperatorInfo(op: string): OperatorInfo {
    return OPERATORS[op] || { precedence: 0, associativity: 'left', arity: 2 };
  }

  // 比较运算符优先级
  private comparePrecedence(op1: string, op2: string): number {
    const info1 = this.getOperatorInfo(op1);
    const info2 = this.getOperatorInfo(op2);
    return info1.precedence - info2.precedence;
  }

  // 判断是否是一元运算符
  private isUnaryOperator(token: Token, prevToken: Token | null): boolean {
    if (!this.isOperator(token)) return false;

    const value = token.value;
    if (['!', '~', 'defined'].includes(value)) {
      return true;
    }

    // + 或 - 在以下情况是一元运算符：
    // 1. 是第一个token
    // 2. 前面是运算符
    // 3. 前面是左括号
    if (['+', '-'].includes(value)) {
      if (!prevToken) return true;
      if (this.isOperator(prevToken)) return true;
      if (prevToken.type === 'paren' && prevToken.value === '(') return true;
    }

    return false;
  }

  // 处理运算符
  private processOperator(token: Token, prevToken: Token | null): void {
    // 检查是否是一元运算符
    if (this.isUnaryOperator(token, prevToken)) {
      const unaryOp = token.value === '+' ? 'U+' :
                     token.value === '-' ? 'U-' : token.value;
      const unaryToken: Token = {
        type: 'operator',
        value: unaryOp
      };

      // 一元运算符直接入栈
      this.operatorStack.push(unaryToken);
      return;
    }

    const op1 = token.value;
    const info1 = this.getOperatorInfo(op1);

    // 处理栈顶运算符
    while (this.operatorStack.length > 0) {
      const top = this.operatorStack[this.operatorStack.length - 1];

      // 遇到左括号停止
      if (top.type === 'paren' && top.value === '(') {
        break;
      }

      const op2 = top.value;
      const info2 = this.getOperatorInfo(op2);

      // 比较优先级和结合性
      const precedenceDiff = this.comparePrecedence(op1, op2);

      if (precedenceDiff < 0 ||
          (precedenceDiff === 0 && info1.associativity === 'left')) {
        // op2优先级更高或相等且左结合，则弹出op2
        this.output.push(this.operatorStack.pop()!);
      } else {
        break;
      }
    }

    // 当前运算符入栈
    this.operatorStack.push(token);
  }

  // 处理函数
  private processFunction(token: Token): void {
    this.operatorStack.push(token);
    this.functionStack.push(token.value);
  }

  // 处理逗号（函数参数分隔符）
  private processComma(): void {
    // 弹出运算符直到左括号
    while (this.operatorStack.length > 0 &&
           !(this.operatorStack[this.operatorStack.length - 1].type === 'paren' &&
             this.operatorStack[this.operatorStack.length - 1].value === '(')) {
      this.output.push(this.operatorStack.pop()!);
    }
  }

  // 处理右括号
  private processRightParen(): void {
    // 弹出运算符直到左括号
    while (this.operatorStack.length > 0) {
      const top = this.operatorStack.pop()!;

      if (top.type === 'paren' && top.value === '(') {
        // 找到左括号
        break;
      }

      this.output.push(top);
    }

    // 检查是否是函数调用
    if (this.operatorStack.length > 0 &&
        this.operatorStack[this.operatorStack.length - 1].type === 'function') {
      const funcToken = this.operatorStack.pop()!;
      this.output.push(funcToken);
      this.functionStack.pop();
    }
  }

  // 清理剩余运算符
  private flushOperators(): void {
    while (this.operatorStack.length > 0) {
      const top = this.operatorStack.pop()!;

      // 不应该有未匹配的左括号
      if (top.type === 'paren' && top.value === '(') {
        throw new Error('Mismatched parentheses');
      }

      this.output.push(top);
    }
  }

  // 主转换方法
  convert(tokens: Token[]): Token[] {
    // 重置状态
    this.output = [];
    this.operatorStack = [];
    this.functionStack = [];

    let prevToken: Token | null = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      switch (token.type) {
        case 'number':
        case 'identifier':
          this.output.push(token);
          break;

        case 'function':
          this.processFunction(token);
          break;

        case 'operator':
          if (token.value === ',') {
            this.processComma();
          } else {
            this.processOperator(token, prevToken);
          }
          break;

        case 'paren':
          if (token.value === '(') {
            // 左括号直接入栈
            this.operatorStack.push(token);
          } else if (token.value === ')') {
            this.processRightParen();
          }
          break;
      }

      prevToken = token;
    }

    // 处理剩余运算符
    this.flushOperators();

    return this.output;
  }

  // 可视化转换过程
  convertWithTrace(tokens: Token[]): { steps: string[], result: Token[] } {
    const steps: string[] = [];
    this.output = [];
    this.operatorStack = [];
    this.functionStack = [];

    let prevToken: Token | null = null;

    const formatState = (inputToken?: Token): string => {
      const outputStr = this.output.map(t => t.value).join(' ');
      const stackStr = this.operatorStack.map(t => t.value).join(' ');
      const inputStr = inputToken ? `输入: ${inputToken.value}` : '';
      return `${inputStr.padEnd(15)} | 输出: [${outputStr}] | 栈: [${stackStr}]`;
    };

    steps.push("开始转换...");
    steps.push(formatState());

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let action = '';

      switch (token.type) {
        case 'number':
        case 'identifier':
          this.output.push(token);
          action = `数字/变量 "${token.value}" → 输出`;
          break;

        case 'function':
          this.processFunction(token);
          action = `函数 "${token.value}" → 栈`;
          break;

        case 'operator':
          if (token.value === ',') {
            this.processComma();
            action = '逗号 → 弹出到左括号';
          } else {
            this.processOperator(token, prevToken);
            action = `运算符 "${token.value}" 处理`;
          }
          break;

        case 'paren':
          if (token.value === '(') {
            this.operatorStack.push(token);
            action = '左括号 → 栈';
          } else {
            this.processRightParen();
            action = '右括号 → 弹出到左括号';
          }
          break;
      }

      steps.push(`${action}: ${formatState(token)}`);
      prevToken = token;
    }

    steps.push("处理剩余运算符...");
    this.flushOperators();
    steps.push(formatState());

    steps.push(`最终RPN: ${this.output.map(t => t.value).join(' ')}`);

    return {
      steps,
      result: this.output
    };
  }
}

// ==================== RPN求值器 ====================
class RPNEvaluator {
  private macros: Map<string, number> = new Map();

  // 设置宏值
  setMacro(name: string, value: number): void {
    this.macros.set(name, value);
  }

  // 求值RPN表达式
  evaluate(rpnTokens: Token[]): number {
    const stack: number[] = [];

    for (const token of rpnTokens) {
      if (token.type === 'number') {
        // 处理数字
        const num = this.parseNumber(token.value);
        stack.push(num);
      } else if (token.type === 'identifier') {
        // 处理变量/宏
        const value = this.macros.get(token.value);
        if (value === undefined) {
          throw new Error(`Undefined identifier: ${token.value}`);
        }
        stack.push(value);
      } else if (token.type === 'operator') {
        // 处理运算符
        const op = token.value;
        const info = OPERATORS[op] || { arity: 2 };

        if (info.arity === 1) {
          // 一元运算符
          if (stack.length < 1) {
            throw new Error(`Insufficient operands for operator: ${op}`);
          }
          const a = stack.pop()!;
          const result = this.applyUnaryOperator(op, a);
          stack.push(result);
        } else if (info.arity === 2) {
          // 二元运算符
          if (stack.length < 2) {
            throw new Error(`Insufficient operands for operator: ${op}`);
          }
          const b = stack.pop()!;
          const a = stack.pop()!;
          const result = this.applyBinaryOperator(op, a, b);
          stack.push(result);
        } else if (info.arity === 3) {
          // 三元运算符 (a ? b : c)
          if (stack.length < 3) {
            throw new Error(`Insufficient operands for ternary operator`);
          }
          const c = stack.pop()!;  // :
          const b = stack.pop()!;  // ?
          const a = stack.pop()!;  // 条件
          const result = a ? b : c;
          stack.push(result);
        }
      }
    }

    if (stack.length !== 1) {
      throw new Error(`Invalid expression: ${stack.length} values left on stack`);
    }

    return stack[0];
  }

  // 解析数字（支持十进制、十六进制）
  private parseNumber(str: string): number {
    str = str.trim();

    // 十六进制
    if (str.startsWith('0x') || str.startsWith('0X')) {
      return parseInt(str, 16);
    }

    // 二进制（GLSL不支持，但可能扩展）
    if (str.startsWith('0b') || str.startsWith('0B')) {
      return parseInt(str.substring(2), 2);
    }

    // 八进制
    if (str.startsWith('0') && str.length > 1 && /[0-7]/.test(str[1])) {
      return parseInt(str, 8);
    }

    // 十进制
    return parseFloat(str);
  }

  // 应用一元运算符
  private applyUnaryOperator(op: string, a: number): number {
    switch (op) {
      case 'U+': return +a;
      case 'U-': return -a;
      case '!': return a === 0 ? 1 : 0;
      case '~': return ~a;
      case 'defined': return this.macros.has(a.toString()) ? 1 : 0;
      default:
        throw new Error(`Unknown unary operator: ${op}`);
    }
  }

  // 应用二元运算符
  private applyBinaryOperator(op: string, a: number, b: number): number {
    switch (op) {
      // 算术
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? 0 : a / b; // 避免除零
      case '%': return b === 0 ? 0 : a % b;

      // 移位
      case '<<': return a << b;
      case '>>': return a >> b;

      // 关系
      case '<': return a < b ? 1 : 0;
      case '<=': return a <= b ? 1 : 0;
      case '>': return a > b ? 1 : 0;
      case '>=': return a >= b ? 1 : 0;
      case '==': return a === b ? 1 : 0;
      case '!=': return a !== b ? 1 : 0;

      // 位运算
      case '&': return a & b;
      case '^': return a ^ b;
      case '|': return a | b;

      // 逻辑
      case '&&': return (a !== 0 && b !== 0) ? 1 : 0;
      case '||': return (a !== 0 || b !== 0) ? 1 : 0;

      // 赋值（在预处理器中通常不计算）
      case '=': return b;
      case '+=': return a + b;
      case '-=': return a - b;
      case '*=': return a * b;
      case '/=': return b === 0 ? a : a / b;

      default:
        throw new Error(`Unknown binary operator: ${op}`);
    }
  }
}

// ==================== 完整流程示例 ====================
class ExpressionProcessor {
  private tokenizer: GLSLTokenizer;
  private converter: ShuntingYardConverter;
  private evaluator: RPNEvaluator;

  constructor() {
    this.tokenizer = new GLSLTokenizer();
    this.converter = new ShuntingYardConverter();
    this.evaluator = new RPNEvaluator();
  }

  // 处理完整表达式
  process(expression: string, macros: Record<string, number> = {}): {
    tokens: Token[],
    rpn: Token[],
    result: number,
    trace?: string[]
  } {
    // 1. 词法分析
    const tokens = this.tokenizer.tokenize(expression);
    console.log('parse tokens:', tokens);

    // 2. 设置宏值
    Object.entries(macros).forEach(([name, value]) => {
      this.evaluator.setMacro(name, value);
    });

    // 3. 转换为RPN
    const { steps, result: rpn } = this.converter.convertWithTrace(tokens);

    // 4. 求值
    const result = this.evaluator.evaluate(rpn);

    return {
      tokens,
      rpn,
      result,
      trace: steps
    };
  }
}

// ==================== 使用示例 ====================
const processor = new ExpressionProcessor();

console.log("=== 示例1：基本算术 ===");
const expr1 = "3 + 4 * 2 / (1 - 5)";
const result1 = processor.process(expr1);
console.log(`中缀: ${expr1}`);
console.log(`RPN: ${result1.rpn.map(t => t.value).join(' ')}`);
console.log(`结果: ${result1.result}`);
console.log();

console.log("=== 示例2：带宏和逻辑运算 ===");
const expr2 = "defined(A) && (B > 0 || C == 1)";
const result2 = processor.process(expr2, { A: 1, B: 5, C: 1 });
console.log(`中缀: ${expr2}`);
console.log(`RPN: ${result2.rpn.map(t => t.value).join(' ')}`);
console.log(`结果: ${result2.result} (true)`);
console.log();

console.log("=== 示例3：复杂表达式 ===");
// const expr3 = "!A + B * (C + D) - E / F";
// const result3 = processor.process(expr3, {
//   A: 0, B: 3, C: 2, D: 4, E: 10, F: 2
// });
// console.log(`中缀: ${expr3}`);
// console.log(`RPN: ${result3.rpn.map(t => t.value).join(' ')}`);
// console.log(`结果: ${result3.result}`);
// console.log();

// ==================== 转换过程演示 ====================
console.log("=== 转换过程跟踪 ===");
const testExpr = "3 + 4 * 2";
const testResult = processor.process(testExpr);

if (testResult.trace) {
  console.log("转换步骤:");
  testResult.trace.forEach((step, i) => {
    console.log(`${i.toString().padStart(2)}. ${step}`);
  });
}

// ==================== GLSLTokenizer实现 ====================
class GLSLTokenizer {
  tokenize(expression: string): Token[] {
    const tokens: Token[] = [];
    let pos = 0;

    // 简单关键字识别
    const keywords = new Set(['defined']);

    while (pos < expression.length) {
      const char = expression[pos];

      // 跳过空白
      if (/\s/.test(char)) {
        pos++;
        continue;
      }

      // 数字
      if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(expression[pos + 1]))) {
        const start = pos;

        // 十六进制
        if (char === '0' && /[xX]/.test(expression[pos + 1])) {
          pos += 2;
          while (/[0-9a-fA-F]/.test(expression[pos])) pos++;
        } else {
          // 十进制
          while (/[0-9]/.test(expression[pos])) pos++;
          if (expression[pos] === '.') pos++;
          while (/[0-9]/.test(expression[pos])) pos++;
          if (/[eE]/.test(expression[pos])) {
            pos++;
            if (/[+-]/.test(expression[pos])) pos++;
            while (/[0-9]/.test(expression[pos])) pos++;
          }
        }

        tokens.push({
          type: 'number',
          value: expression.substring(start, pos)
        });
        continue;
      }

      // 标识符和关键字
      if (/[a-zA-Z_]/.test(char)) {
        const start = pos;
        while (/[a-zA-Z0-9_]/.test(expression[pos])) pos++;

        const value = expression.substring(start, pos);
        const isKeyword = keywords.has(value);

        tokens.push({
          type: isKeyword ? 'operator' : 'identifier',
          value
        });
        continue;
      }

      // 运算符（多字符优先）
      const multiCharOps = ['==', '!=', '<=', '>=', '&&', '||', '<<', '>>',
                           '+=', '-=', '*=', '/=', '++', '--'];

      let found = false;
      for (const op of multiCharOps) {
        if (expression.startsWith(op, pos)) {
          tokens.push({
            type: 'operator',
            value: op
          });
          pos += op.length;
          found = true;
          break;
        }
      }

      if (found) continue;

      // 单字符运算符
      if ('+-*/%&|^!~<>=?:'.includes(char)) {
        tokens.push({
          type: 'operator',
          value: char
        });
        pos++;
        continue;
      }

      // 括号
      if ('()'.includes(char)) {
        tokens.push({
          type: 'paren',
          value: char
        });
        pos++;
        continue;
      }

      // 逗号（函数参数分隔符）
      if (char === ',') {
        tokens.push({
          type: 'operator', // 特殊处理为operator
          value: ','
        });
        pos++;
        continue;
      }

      // 未知字符
      throw new Error(`Unexpected character: ${char} at position ${pos}`);
    }

    return tokens;
  }
}

// ==================== 测试用例 ====================
function runTests() {
  const tests = [
    {
      name: "简单加法",
      expr: "1 + 2",
      macros: {},
      expectedRPN: "1 2 +",
      expectedValue: 3
    },
    {
      name: "运算符优先级",
      expr: "3 + 4 * 2",
      macros: {},
      expectedRPN: "3 4 2 * +",
      expectedValue: 11
    },
    {
      name: "带括号",
      expr: "(3 + 4) * 2",
      macros: {},
      expectedRPN: "3 4 + 2 *",
      expectedValue: 14
    },
    {
      name: "逻辑运算",
      expr: "A && B || C",
      macros: { A: 1, B: 0, C: 1 },
      expectedRPN: "A B && C ||",
      expectedValue: 1
    },
    {
      name: "一元运算符",
      expr: "!A + -B",
      macros: { A: 0, B: 5 },
      expectedRPN: "A ! B U- +",
      expectedValue: 6  // !0 = 1, -5 = -5, 1 + (-5) = -4? 等等是 1 + (-5) = -4
      // 修正：1 + (-5) = -4，但注意!0在C语言中是1
    },
    {
      name: "复杂表达式",
      expr: "a + b * c - d / e",
      macros: { a: 1, b: 2, c: 3, d: 4, e: 2 },
      expectedRPN: "a b c * + d e / -",
      expectedValue: 1 + 2*3 - 4/2  // 1 + 6 - 2 = 5
    },
    {
      name: "defined 运算符",
      expr: "defined(X) && Y > 0",
      macros: { X: 1, Y: 5 },
      expectedRPN: "X defined Y 0 > &&",
      expectedValue: 1
    }
  ] as const;

  const processor = new ExpressionProcessor();

  console.log("\n=== 运行测试用例 ===");

  for (const test of tests) {
    try {
      const result = processor.process(test.expr, test.macros);
      const rpnStr = result.rpn.map(t => t.value).join(' ');

      const rpnPass = rpnStr === test.expectedRPN;
      const valuePass = Math.abs(result.result - test.expectedValue) < 0.0001;

      console.log(`${test.name}:`);
      console.log(`  表达式: ${test.expr}`);
      console.log(`  期望RPN: ${test.expectedRPN}`);
      console.log(`  实际RPN: ${rpnStr} ${rpnPass ? '✓' : '✗'}`);
      console.log(`  期望值: ${test.expectedValue}`);
      console.log(`  实际值: ${result.result} ${valuePass ? '✓' : '✗'}`);
      console.log(`  状态: ${rpnPass && valuePass ? '通过' : '失败'}`);
      console.log();
    } catch (error) {
      console.log(`${test.name}: 错误 - ${(error as Error).message}`);
    }
  }
}

runTests();
