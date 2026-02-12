import { Parser } from '@/parser/Parser';
import { MacroExpansion } from './MacroExpansion';
import { type ASTNode } from '@/parser/ASTType';
import {
  isNumberLiteral,
  isBinaryExpression,
  isConditionalExpression,
  isUnaryExpression,
  isIdentifier,
} from '@/parser/helper';

export interface PreprocessOutput {
  code: string;
  errors: string[];
}

interface ExpressionOutput {
  value: boolean;
  errors: string[];
}

interface ASTNodeOutput {
  value: number;
  errors: string[];
}

function evaluateASTNode(node: ASTNode): ASTNodeOutput {
  if (isNumberLiteral(node)) {
    return { value: node.value, errors: [] };
  }
  if (isUnaryExpression(node)) {
    const errors: string[] = [];
    const operandOutput = evaluateASTNode(node.operand);
    errors.push(...operandOutput.errors);
    if (node.operator === '+') {
      return { value: operandOutput.value, errors };
    }
    if (node.operator === '-') {
      return { value: -operandOutput.value, errors };
    }
    if (node.operator === '!') {
      return { value: operandOutput.value === 0 ? 1 : 0, errors };
    }
    if (node.operator === '~') {
      return { value: ~operandOutput.value, errors };
    }
  }
  if (isBinaryExpression(node)) {
    const errors: string[] = [];
    const leftOutput = evaluateASTNode(node.left);
    const rightOutput = evaluateASTNode(node.right);
    errors.push(...leftOutput.errors);
    errors.push(...rightOutput.errors);
    if (node.operator === '+') {
      return { value: leftOutput.value + rightOutput.value, errors };
    }
    if (node.operator === '-') {
      return { value: leftOutput.value - rightOutput.value, errors };
    }
    if (node.operator === '*') {
      return { value: leftOutput.value * rightOutput.value, errors };
    }
    if (node.operator === '/') {
      return { value: leftOutput.value / rightOutput.value, errors };
    }
    if (node.operator === '%') {
      return { value: leftOutput.value % rightOutput.value, errors };
    }
    if (node.operator === '<<') {
      return { value: leftOutput.value << rightOutput.value, errors };
    }
    if (node.operator === '>>') {
      return { value: leftOutput.value >> rightOutput.value, errors };
    }
    if (node.operator === '<') {
      return { value: leftOutput.value < rightOutput.value ? 1 : 0, errors };
    }
    if (node.operator === '>') {
      return { value: leftOutput.value > rightOutput.value ? 1 : 0, errors };
    }
    if (node.operator === '<=') {
      return { value: leftOutput.value <= rightOutput.value ? 1 : 0, errors };
    }
    if (node.operator === '>=') {
      return { value: leftOutput.value >= rightOutput.value ? 1 : 0, errors };
    }
    if (node.operator === '==') {
      return { value: leftOutput.value === rightOutput.value ? 1 : 0, errors };
    }
    if (node.operator === '!=') {
      return { value: leftOutput.value !== rightOutput.value ? 1 : 0, errors };
    }
    if (node.operator === '&&') {
      return { value: leftOutput.value !== 0 && rightOutput.value !== 0 ? 1 : 0, errors };
    }
    if (node.operator === '||') {
      return { value: leftOutput.value !== 0 || rightOutput.value !== 0 ? 1 : 0, errors };
    }
    errors.push(`Unsupported operator: ${node.operator}`);
    return { value: 0, errors };
  }
  if (isConditionalExpression(node)) {
    const errors: string[] = [];
    const conditionOutput = evaluateASTNode(node.condition);
    errors.push(...conditionOutput.errors);
    if (conditionOutput.value) {
      const trueOutput = evaluateASTNode(node.whenTrue);
      errors.push(...trueOutput.errors);
      return { value: trueOutput.value, errors };
    }
    const falseOutput = evaluateASTNode(node.whenFalse);
    errors.push(...falseOutput.errors);
    return { value: falseOutput.value, errors };
  }

  const errors: string[] = [];
  if (!isIdentifier(node)) {
    errors.push(`Unsupported evaluate node kind: ${node.kind}`);
  }
  return { value: 0, errors };
}

function evaluateExpression(expansion: MacroExpansion, expression: string): ExpressionOutput {
  let value = false;
  const errors: string[] = [];
  const expandOutput = expansion.expand(expression);
  if (expandOutput.errors.length > 0) {
    errors.push(...expandOutput.errors);
  } else {
    const parseOutput = new Parser(expandOutput.tokens).parse();
    if (parseOutput.errors.length > 0) {
      for (let k = 0; k < parseOutput.errors.length; k += 1) {
        errors.push(parseOutput.errors[k].message);
      }
    } else if (parseOutput.program.body.length > 0) {
      const evaluateOutput = evaluateASTNode(parseOutput.program.body[0]);
      if (evaluateOutput.errors.length > 0) {
        errors.push(...evaluateOutput.errors);
      } else {
        value = evaluateOutput.value !== 0;
      }
    }
  }

  return { value, errors };
}

interface PreprocessOptions {
  alias: {
    define: string;
    if: string;
    ifdef: string;
    ifndef: string;
    elif: string;
    elifdef: string;
    elifndef: string;
    else: string;
    endif: string;
  }
}

const defaultOptions: PreprocessOptions = {
  alias: {
    define: '///#define',
    if: '///#if',
    ifdef: '///#ifdef',
    ifndef: '///#ifndef',
    elif: '///#elif',
    elifdef: '///#elifdef',
    elifndef: '///#elifndef',
    else: '///#else',
    endif: '///#endif',
  },
};

interface StackState {
  active: boolean;
  value: boolean;
}

function shouldOutput(ifStack: StackState[]): boolean {
  if (ifStack.length === 0) {
    return true;
  }
  for (let i = 0; i < ifStack.length; i += 1) {
    if (!ifStack[i].active) {
      return false;
    }
  }
  return true;
}

/**
 * preprocess wgsl code custom directives
 * `///#define`, `///#if`, `///#ifdef`, `///#ifndef`,
 * `///#elif`, `///#elifdef`, `///#elifndef`,
 * `///#else`, `///#endif`
 * @param source source code
 * @returns preprocessed code and errors
 */
export class Preprocessor {
  private _options: PreprocessOptions;
  private _code: string;

  constructor(code: string, options: Partial<PreprocessOptions> = {}) {
    this._code = code;
    this._options = { ...defaultOptions, ...options };
  }

  process(): PreprocessOutput {
    const { alias } = this._options;
    const lines = this._code.split('\n');
    const defines: string[] = [];
    const filters: string[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].startsWith(alias.define)) {
        const defineString = lines[i].slice(alias.define.length).trim();
        defines.push(defineString);
      } else {
        filters.push(lines[i]);
      }
    }

    const expansion = new MacroExpansion(defines);

    const output: string[] = [];
    const ifStack: StackState[] = [];
    const errors: string[] = [...expansion.getErrors()];
    let flag = true;

    for (let i = 0; i < filters.length; i += 1) {
      const line = filters[i].trim();
      if (line.startsWith(alias.if)) {
        const expression = line.slice(alias.if.length).trim();
        const { value: ifValue, errors: ifErrors } = evaluateExpression(expansion, expression);
        errors.push(...ifErrors);
        ifStack.push({ active: ifValue, value: ifValue });
        flag = shouldOutput(ifStack);
        continue;
      }
      if (line.startsWith(alias.ifdef)) {
        const identifier = line.slice(alias.ifdef.length).trim();
        const ifdefValue = expansion.hasMacro(identifier);
        ifStack.push({ active: ifdefValue, value: ifdefValue });
        flag = shouldOutput(ifStack);
        continue;
      }
      if (line.startsWith(alias.ifndef)) {
        const identifier = line.slice(alias.ifndef.length).trim();
        const ifndefValue = !expansion.hasMacro(identifier);
        ifStack.push({ active: ifndefValue, value: ifndefValue });
        flag = shouldOutput(ifStack);
        continue;
      }
      if (line.startsWith(alias.else)) {
        if (ifStack.length === 0) {
          errors.push('Unexpected #else');
        } else {
          const active = !ifStack[ifStack.length - 1].value;
          ifStack[ifStack.length - 1].active = active;
          if (active) {
            ifStack[ifStack.length - 1].value = true;
          }
          flag = shouldOutput(ifStack);
        }
        continue;
      }
      if (line.startsWith(alias.elif)) {
        if (ifStack.length === 0) {
          errors.push('Unexpected #elif');
        } else {
          const expression = line.slice(alias.elif.length).trim();
          const { value: elifValue, errors: elifErrors } = evaluateExpression(expansion, expression);
          errors.push(...elifErrors);
          const active = elifValue && !ifStack[ifStack.length - 1].value;
          ifStack[ifStack.length - 1].active = active;
          if (active) {
            ifStack[ifStack.length - 1].value = true;
          }
          flag = shouldOutput(ifStack);
        }
        continue;
      }
      if (line.startsWith(alias.elifdef)) {
        if (ifStack.length === 0) {
          errors.push('Unexpected #elifdef');
        } else {
          const identifier = line.slice(alias.elifdef.length).trim();
          const elifdefValue = expansion.hasMacro(identifier);
          const active = elifdefValue && !ifStack[ifStack.length - 1].value;
          ifStack[ifStack.length - 1].active = active;
          if (active) {
            ifStack[ifStack.length - 1].value = true;
          }
          flag = shouldOutput(ifStack);
        }
        continue;
      }
      if (line.startsWith(alias.elifndef)) {
        if (ifStack.length === 0) {
          errors.push('Unexpected #elifndef');
        } else {
          const identifier = line.slice(alias.elifndef.length).trim();
          const elifndefValue = !expansion.hasMacro(identifier);
          const active = elifndefValue && !ifStack[ifStack.length - 1].value;
          ifStack[ifStack.length - 1].active = active;
          if (active) {
            ifStack[ifStack.length - 1].value = true;
          }
          flag = shouldOutput(ifStack);
        }
        continue;
      }
      if (line.startsWith(alias.endif)) {
        ifStack.pop();
        flag = shouldOutput(ifStack);
        continue;
      }

      if (flag) {
        output.push(filters[i]);
      }
    }

    return { code: output.join('\n'), errors };
  }
}
