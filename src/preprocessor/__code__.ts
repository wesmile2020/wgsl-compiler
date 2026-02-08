// 定义 token 类型
type TokenType =
  | "NUMBER"
  | "IDENTIFIER" // 数字和标识符
  | "PLUS"
  | "MINUS"
  | "MULTIPLY"
  | "DIVIDE"
  | "MODULO"
  | "POWER" // 算术运算符
  | "LPAREN"
  | "RPAREN" // 括号
  | "QUESTION"
  | "COLON" // 三目运算符
  | "AND"
  | "OR"
  | "NOT" // 逻辑运算符
  | "BIT_AND"
  | "BIT_OR"
  | "BIT_XOR"
  | "BIT_NOT"
  | "LEFT_SHIFT"
  | "RIGHT_SHIFT" // 位运算符
  | "EQUALS"
  | "NOT_EQUALS"
  | "LESS"
  | "LESS_EQUAL"
  | "GREATER"
  | "GREATER_EQUAL" // 关系运算符
  | "ASSIGN" // 赋值（可选）
  | "EOF";

interface Token {
  type: TokenType;
  value?: string | number;
  position: number;
}

// 定义 AST 节点类型
type ASTNode =
  | { type: "Number"; value: number }
  | { type: "Unary"; operator: "-" | "+" | "!" | "~"; operand: ASTNode }
  | {
      type: "Binary";
      operator:
        | "+"
        | "-"
        | "*"
        | "/"
        | "%"
        | "**" // 算术
        | "&&"
        | "||" // 逻辑
        | "&"
        | "|"
        | "^"
        | "<<"
        | ">>" // 位运算
        | "=="
        | "!="
        | "<"
        | "<="
        | ">"
        | ">="; // 关系
      left: ASTNode;
      right: ASTNode;
    }
  | {
      type: "Conditional";
      condition: ASTNode;
      trueExpr: ASTNode;
      falseExpr: ASTNode;
    };

class Lexer {
  private input: string;
  private position: number;
  private currentChar: string | null;

  // 运算符映射表
  private operators: Record<string, TokenType> = {
    "+": "PLUS",
    "-": "MINUS",
    "*": "MULTIPLY",
    "/": "DIVIDE",
    "%": "MODULO",
    "**": "POWER",
    "(": "LPAREN",
    ")": "RPAREN",
    "?": "QUESTION",
    ":": "COLON",
    "&&": "AND",
    "||": "OR",
    "!": "NOT",
    "&": "BIT_AND",
    "|": "BIT_OR",
    "^": "BIT_XOR",
    "~": "BIT_NOT",
    "<<": "LEFT_SHIFT",
    ">>": "RIGHT_SHIFT",
    "==": "EQUALS",
    "!=": "NOT_EQUALS",
    "<": "LESS",
    "<=": "LESS_EQUAL",
    ">": "GREATER",
    ">=": "GREATER_EQUAL",
    "=": "ASSIGN",
  };

  constructor(input: string) {
    // 预处理输入：移除空格，处理连续运算符
    this.input = this.preprocessInput(input);
    this.position = 0;
    this.currentChar = this.input.length > 0 ? this.input[0] : null;
  }

  private preprocessInput(input: string): string {
    // 移除所有空格
    let result = input.replace(/\s+/g, "");

    // 处理连续负号和正号
    result = result.replace(/--/g, "+"); // 负负得正
    result = result.replace(/\+\+/g, "+"); // 正正得正
    result = result.replace(/\+-/g, "-"); // 正负得负
    result = result.replace(/-+/g, "-"); // 负正得负

    return result;
  }

  private advance(): void {
    this.position++;
    this.currentChar =
      this.position < this.input.length ? this.input[this.position] : null;
  }

  private peek(): string | null {
    const nextPos = this.position + 1;
    return nextPos < this.input.length ? this.input[nextPos] : null;
  }

  private isDigit(char: string | null): boolean {
    return char !== null && /[0-9]/.test(char);
  }

  private isAlpha(char: string | null): boolean {
    return char !== null && /[a-zA-Z_]/.test(char);
  }

  private number(): Token {
    let result = "";
    const startPos = this.position;
    let hasDecimal = false;

    while (
      this.currentChar !== null &&
      (this.isDigit(this.currentChar) || this.currentChar === ".")
    ) {
      if (this.currentChar === ".") {
        if (hasDecimal) break; // 不允许多个小数点
        hasDecimal = true;
      }
      result += this.currentChar;
      this.advance();
    }

    // 科学计数法
    if (this.currentChar === "e" || this.currentChar === "E") {
      result += this.currentChar;
      this.advance();

      // @ts-ignore
      if (this.currentChar === "+" || this.currentChar === "-") {
        result += this.currentChar;
        this.advance();
      }

      while (this.isDigit(this.currentChar)) {
        result += this.currentChar;
        this.advance();
      }
    }

    return {
      type: "NUMBER",
      value: parseFloat(result),
      position: startPos,
    };
  }

  private identifier(): Token {
    let result = "";
    const startPos = this.position;

    while (
      this.currentChar !== null &&
      (this.isAlpha(this.currentChar) || this.isDigit(this.currentChar))
    ) {
      result += this.currentChar;
      this.advance();
    }

    // 检查是否是关键字或常量
    if (result.toUpperCase() === "TRUE") {
      return { type: "NUMBER", value: 1, position: startPos };
    } else if (result.toUpperCase() === "FALSE") {
      return { type: "NUMBER", value: 0, position: startPos };
    }

    return { type: "IDENTIFIER", value: result, position: startPos };
  }

  getNextToken(): Token {
    while (this.currentChar !== null) {
      // 跳过空白字符（理论上已移除，但保留）
      if (/\s/.test(this.currentChar)) {
        this.advance();
        continue;
      }

      // 数字
      if (this.isDigit(this.currentChar)) {
        return this.number();
      }

      // 标识符
      if (this.isAlpha(this.currentChar)) {
        return this.identifier();
      }

      const startPos = this.position;

      // 处理多字符运算符
      const char = this.currentChar;
      const nextChar = this.peek();
      const twoCharOp = char + (nextChar || "");

      // 检查双字符运算符
      if (
        twoCharOp === "**" ||
        twoCharOp === "<<" ||
        twoCharOp === ">>" ||
        twoCharOp === "==" ||
        twoCharOp === "!=" ||
        twoCharOp === "<=" ||
        twoCharOp === ">=" ||
        twoCharOp === "&&" ||
        twoCharOp === "||"
      ) {
        this.advance(); // 消耗第一个字符
        this.advance(); // 消耗第二个字符
        return {
          type: this.operators[twoCharOp],
          value: twoCharOp,
          position: startPos,
        };
      }

      // 单字符运算符
      if (char in this.operators) {
        this.advance();
        return {
          type: this.operators[char],
          value: char,
          position: startPos,
        };
      }

      throw new Error(`Unexpected character: ${char} at position ${startPos}`);
    }

    return { type: "EOF", position: this.position };
  }
}

class Parser {
  private lexer: Lexer;
  private currentToken: Token;

  // 运算符优先级表（数值越大优先级越高）
  private precedence: Record<string, number> = {
    "||": 1,
    "&&": 2,
    "|": 3,
    "^": 4,
    "&": 5,
    "==": 6,
    "!=": 6,
    "<": 7,
    "<=": 7,
    ">": 7,
    ">=": 7,
    "<<": 8,
    ">>": 8,
    "+": 9,
    "-": 9,
    "*": 10,
    "/": 10,
    "%": 10,
    "**": 11,
    "!": 12,
    "~": 12, // 单目运算符
    "?": 13, // 三目运算符特殊处理
  };

  constructor(lexer: Lexer) {
    this.lexer = lexer;
    this.currentToken = lexer.getNextToken();
  }

  private advance(): void {
    this.currentToken = this.lexer.getNextToken();
  }

  private expect(tokenType: TokenType): void {
    if (this.currentToken.type !== tokenType) {
      throw new Error(
        `Expected ${tokenType}, got ${this.currentToken.type} at position ${this.currentToken.position}`,
      );
    }
  }

  private parsePrimary(): ASTNode {
    const token = this.currentToken;

    if (token.type === "NUMBER") {
      this.advance();
      return { type: "Number", value: token.value as number };
    }

    if (token.type === "LPAREN") {
      this.advance();
      const expr = this.parseExpression();
      this.expect("RPAREN");
      this.advance();
      return expr;
    }

    // 单目运算符
    if (token.type === "MINUS") {
      this.advance();
      const operand = this.parsePrimary();
      return { type: "Unary", operator: "-", operand };
    }

    if (token.type === "PLUS") {
      this.advance();
      const operand = this.parsePrimary();
      return { type: "Unary", operator: "+", operand };
    }

    if (token.type === "NOT") {
      this.advance();
      const operand = this.parsePrimary();
      return { type: "Unary", operator: "!", operand };
    }

    if (token.type === "BIT_NOT") {
      this.advance();
      const operand = this.parsePrimary();
      return { type: "Unary", operator: "~", operand };
    }

    throw new Error(`Unexpected token in primary: ${token.type}`);
  }

  private parseBinary(minPrecedence: number = 0): ASTNode {
    // 解析左操作数
    let left = this.parsePrimary();

    // 解析连续的中缀运算符
    while (true) {
      const token = this.currentToken;
      const tokenValue = token.value as string;

      // 检查是否是运算符且有足够优先级
      if (
        token.type === "EOF" ||
        token.type === "RPAREN" ||
        token.type === "QUESTION" ||
        token.type === "COLON"
      ) {
        break;
      }

      // 获取运算符优先级
      const precedence = this.precedence[tokenValue];
      if (precedence === undefined || precedence < minPrecedence) {
        break;
      }

      // 消耗运算符
      this.advance();

      // 处理右结合性的运算符（幂运算）
      const nextMinPrecedence =
        tokenValue === "**" ? precedence : precedence + 1;

      // 解析右操作数
      const right = this.parseBinary(nextMinPrecedence);

      // 构建二元表达式节点
      left = {
        type: "Binary",
        operator: tokenValue as any,
        left,
        right,
      };
    }

    return left;
  }

  private parseConditional(): ASTNode {
    // 先解析条件表达式
    let node = this.parseBinary();

    // 检查三目运算符
    if (this.currentToken.type === "QUESTION") {
      this.advance();
      const trueExpr = this.parseConditional(); // 解析真分支
      this.expect("COLON");
      this.advance();
      const falseExpr = this.parseConditional(); // 解析假分支

      node = {
        type: "Conditional",
        condition: node,
        trueExpr,
        falseExpr,
      };
    }

    return node;
  }

  parseExpression(): ASTNode {
    return this.parseConditional();
  }
}

class Evaluator {
  private isTruthy(value: number): boolean {
    return value !== 0;
  }

  private toNumber(value: number): number {
    // 对于位运算，需要转换为32位整数
    return value;
  }

  evaluate(node: ASTNode): number {
    switch (node.type) {
      case "Number":
        return node.value;

      case "Unary":
        const operandValue = this.evaluate(node.operand);
        switch (node.operator) {
          case "-":
            return -operandValue;
          case "+":
            return operandValue;
          case "!":
            return this.isTruthy(operandValue) ? 0 : 1;
          case "~":
            return ~this.toNumber(operandValue);
          default:
            throw new Error(`Unknown unary operator: ${(node as any).operator}`);
        }

      case "Binary":
        const leftValue = this.evaluate(node.left);
        const rightValue = this.evaluate(node.right);

        switch (node.operator) {
          // 算术运算符
          case "+":
            return leftValue + rightValue;
          case "-":
            return leftValue - rightValue;
          case "*":
            return leftValue * rightValue;
          case "/":
            if (rightValue === 0) throw new Error("Division by zero");
            return leftValue / rightValue;
          case "%":
            return leftValue % rightValue;
          case "**":
            return Math.pow(leftValue, rightValue);

          // 逻辑运算符
          case "&&":
            return this.isTruthy(leftValue) && this.isTruthy(rightValue)
              ? 1
              : 0;
          case "||":
            return this.isTruthy(leftValue) || this.isTruthy(rightValue)
              ? 1
              : 0;

          // 位运算符
          case "&":
            return this.toNumber(leftValue) & this.toNumber(rightValue);
          case "|":
            return this.toNumber(leftValue) | this.toNumber(rightValue);
          case "^":
            return this.toNumber(leftValue) ^ this.toNumber(rightValue);
          case "<<":
            return this.toNumber(leftValue) << this.toNumber(rightValue);
          case ">>":
            return this.toNumber(leftValue) >> this.toNumber(rightValue);

          // 关系运算符
          case "==":
            return leftValue === rightValue ? 1 : 0;
          case "!=":
            return leftValue !== rightValue ? 1 : 0;
          case "<":
            return leftValue < rightValue ? 1 : 0;
          case "<=":
            return leftValue <= rightValue ? 1 : 0;
          case ">":
            return leftValue > rightValue ? 1 : 0;
          case ">=":
            return leftValue >= rightValue ? 1 : 0;

          default:
            throw new Error(`Unknown binary operator: ${(node as any).operator}`);
        }

      case "Conditional":
        const conditionValue = this.evaluate(node.condition);
        return this.isTruthy(conditionValue)
          ? this.evaluate(node.trueExpr)
          : this.evaluate(node.falseExpr);
    }

    throw new Error(`Unknown node type: ${(node as any).type}`);
  }
}

// 主函数：表达式求值
function evaluateExpression(expression: string): number {
  try {
    const lexer = new Lexer(expression);
    const parser = new Parser(lexer);
    const ast = parser.parseExpression();
    console.log(ast);
    const evaluator = new Evaluator();
    return evaluator.evaluate(ast);
  } catch (error) {
    throw new Error(
      `Expression evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// 辅助函数：验证表达式
function verifyExpression(expression: string, expected?: number): void {
  try {
    const result = evaluateExpression(expression);
    if (expected !== undefined) {
      const tolerance = 0.000001;
      const passed = Math.abs(result - expected) < tolerance;
      const status = passed ? "✓" : "✗";
      console.log(
        `${status} ${expression} = ${result} (expected: ${expected})`,
      );
    } else {
      console.log(`  ${expression} = ${result}`);
    }
  } catch (error) {
    console.log(
      `✗ ${expression} -> ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// 测试函数
function runComprehensiveTests(): void {
  console.log("完整表达式求值器测试\n");

  console.log("=== 基础算术运算 ===");
  verifyExpression("2 + 3 * 4", 14);
  verifyExpression("(2 + 3) * 4", 20);
  verifyExpression("10 - 4 / 2", 8);
  verifyExpression("2 ** 3", 8); // 幂运算
  verifyExpression("10 % 3", 1); // 取模

  console.log("\n=== 三目运算符 ===");
  verifyExpression("1 ? 2 : 3", 2);
  verifyExpression("0 ? 2 : 3", 3);
  verifyExpression("10 / 2 ? 5 : 6 + 8", 5);
  verifyExpression("0 ? 5 : 6 + 8", 14);
  verifyExpression("3 > 2 ? 10 : 20", 10); // 结合关系运算

  console.log("\n=== 逻辑运算符 ===");
  verifyExpression("1 && 1", 1);
  verifyExpression("1 && 0", 0);
  verifyExpression("0 && 1", 0);
  verifyExpression("0 && 0", 0);
  verifyExpression("1 || 1", 1);
  verifyExpression("1 || 0", 1);
  verifyExpression("0 || 1", 1);
  verifyExpression("0 || 0", 0);
  verifyExpression("!0", 1);
  verifyExpression("!1", 0);
  verifyExpression("!5", 0); // 非零值为真，取非为假
  verifyExpression("!(2 > 3)", 1); // 结合关系运算

  console.log("\n=== 关系运算符 ===");
  verifyExpression("2 < 3", 1);
  verifyExpression("3 < 2", 0);
  verifyExpression("2 <= 2", 1);
  verifyExpression("2 <= 3", 1);
  verifyExpression("3 <= 2", 0);
  verifyExpression("3 > 2", 1);
  verifyExpression("2 > 3", 0);
  verifyExpression("3 >= 3", 1);
  verifyExpression("3 >= 2", 1);
  verifyExpression("2 >= 3", 0);
  verifyExpression("2 == 2", 1);
  verifyExpression("2 == 3", 0);
  verifyExpression("2 != 3", 1);
  verifyExpression("2 != 2", 0);

  console.log("\n=== 位运算符 ===");
  verifyExpression("5 & 3", 1); // 0101 & 0011 = 0001
  verifyExpression("5 | 3", 7); // 0101 | 0011 = 0111
  verifyExpression("5 ^ 3", 6); // 0101 ^ 0011 = 0110
  verifyExpression("~0", -1); // 按位非
  verifyExpression("1 << 2", 4); // 左移2位
  verifyExpression("8 >> 1", 4); // 右移1位

  console.log("\n=== 复合表达式 ===");
  verifyExpression("--1 + 10 * 3 / (4 + 5)", 1 + (10 * 3) / (4 + 5));
  verifyExpression("2 * 3 + 4 < 10 && 5 > 2", 1); // (6+4<10) && (5>2) = (10<10) && true = false
  verifyExpression("(2 + 3) * 4 == 20 && 5 < 10", 1);
  verifyExpression("5 & 3 | 1", 1); // (5&3)=1, 1|1=1
  verifyExpression("1 << 2 + 3", 32); // 1 << (2+3) = 1 << 5 = 32
  verifyExpression("2 ** 3 ** 2", 512); // 2^(3^2) = 2^9 = 512（右结合）

  console.log("\n=== 嵌套三目运算符 ===");
  verifyExpression("1 ? 2 ? 3 : 4 : 5", 3); // 1为真 -> 执行2?3:4 -> 2为真 -> 返回3
  verifyExpression("0 ? 2 : 1 ? 3 : 4", 3); // 0为假 -> 执行1?3:4 -> 1为真 -> 返回3
  verifyExpression("(1 > 2) ? 10 : (3 < 4) ? 20 : 30", 20);

  console.log("\n=== 复杂混合表达式 ===");
  verifyExpression("5 + 3 * 2 > 10 && 4 < 6 || 2 == 2", 1);
  verifyExpression("(5 & 3) == 1 && (2 | 4) == 6", 1);
  verifyExpression("2 ** 3 * 4 + 5", 37); // 8*4+5=37
  verifyExpression("10 / 2 == 5 ? 100 : 200", 100);
  verifyExpression("!!5", 1); // 双重逻辑非

  console.log("\n=== 边界条件测试 ===");
  verifyExpression("0 && 10 / 0", 0); // 短路求值：不会执行除以0
  verifyExpression("1 || 10 / 0", 1); // 短路求值：不会执行除以0
  verifyExpression("1 ? 2 : 10 / 0", 2); // 不会执行除以0
  verifyExpression("0 ? 10 / 0 : 3", 3); // 不会执行除以0
}

// 交互式计算器
function startInteractiveCalculator(): void {
  console.log("\n=== 交互式计算器 ===");
  console.log("支持运算符: + - * / % ** (幂运算)");
  console.log("逻辑运算符: && || !");
  console.log("关系运算符: == != < <= > >=");
  console.log("位运算符: & | ^ ~ << >>");
  console.log("三目运算符: ? :");
  console.log('输入 "quit" 或 "exit" 退出');
  console.log('示例: (5 & 3) == 1 ? "yes" : "no"');
  console.log("================================\n");

  // 简单模拟交互（实际使用时可用readline）
  const testInputs = [
    "2 + 3 * 4",
    "5 & 3 | 1",
    "1 < 2 ? 10 : 20",
    "2 ** 3 ** 2",
    "5 + 3 * 2 > 10 && 4 < 6",
  ];

  for (const input of testInputs) {
    console.log(`>>> ${input}`);
    verifyExpression(input);
    console.log();
  }

  console.log(
    "交互式示例结束。在实际Node.js环境中，可以使用readline实现真正的交互。",
  );
}

// 主程序
function main(): void {
  console.log("TypeScript 表达式求值器");
  console.log("=======================\n");

  // 运行综合测试
  // runComprehensiveTests();

  // 启动交互式计算器示例
  startInteractiveCalculator();

  // 示例：原始问题中的表达式
  // console.log("\n=== 原始问题解答 ===");
  // verifyExpression("--1 + 10 * 3 / (4 + 5)");
  // verifyExpression("10 / 2 ? 5 : 6 + 8");
  //
  verifyExpression('(1 + 2) / 2')
}

// 运行主程序
main();

// 导出模块
export { evaluateExpression, Lexer, Parser, Evaluator };
