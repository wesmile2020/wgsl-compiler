import { type ASTNode } from '@/parser/ASTType';
import {
  isNumberLiteral,
  isBinaryExpression,
  isConditionalExpression,
  isUnaryExpression,
} from '@/parser/helper';

interface EvaluateOutput {
  value: number;
  errors: string[];
}

export function evaluate(node: ASTNode): EvaluateOutput {
  if (isNumberLiteral(node)) {
    return { value: node.value, errors: [] };
  }
  if (isUnaryExpression(node)) {
    const errors: string[] = [];
    const operandOutput = evaluate(node.operand);
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
    const leftOutput = evaluate(node.left);
    const rightOutput = evaluate(node.right);
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
    const conditionOutput = evaluate(node.condition);
    errors.push(...conditionOutput.errors);
    if (conditionOutput.value) {
      const trueOutput = evaluate(node.whenTrue);
      errors.push(...trueOutput.errors);
      return { value: trueOutput.value, errors };
    }
    const falseOutput = evaluate(node.whenFalse);
    errors.push(...falseOutput.errors);
    return { value: falseOutput.value, errors };
  }

  const errors = [`Unsupported evaluate node type: ${node.kind}`];
  return { value: 0, errors };
}
