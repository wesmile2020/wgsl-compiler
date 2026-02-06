import { TokenType, type Token } from '@/lexer/TokenType';
import { type MacroParameter, type MacroToken } from './define';

export interface ParameterOutput {
  parameters: MacroParameter[];
  endIndex: number;
}

export function toMacroToken(token: Token | MacroToken): MacroToken {
  const output: MacroToken = {
    type: token.type,
    value: token.value,
  };
  return output;
}

export function extractParameters(tokens: MacroToken[], startIndex: number): ParameterOutput | null {
  if (startIndex < 0 || startIndex >= tokens.length) {
    return null;
  }

  const parameters: MacroParameter[] = [];
  let bracketDepth = 0;
  let i = startIndex;
  if (tokens[i].type === TokenType.BRACKET && tokens[i].value === '(') {
    bracketDepth += 1;
    i += 1;
  }
  let currentParameter: MacroParameter | null = null;
  while (i < tokens.length) {
    if (tokens[i].type === TokenType.BRACKET && tokens[i].value === '(') {
      bracketDepth += 1;
    } else if (tokens[i].type === TokenType.BRACKET && tokens[i].value === ')') {
      bracketDepth -= 1;
    }
    if (bracketDepth === 0) {
      if (currentParameter) {
        parameters.push(currentParameter);
      }
      break;
    }

    if (tokens[i].type === TokenType.PUNCTUATION && tokens[i].value === ',' && bracketDepth === 1) {
      if (currentParameter) {
        parameters.push(currentParameter);
      }
      currentParameter = null;
    } else if (bracketDepth >= 1) {
      const macroToken = toMacroToken(tokens[i]);
      if (!currentParameter) {
        currentParameter = {
          body: tokens[i].value,
          tokens: [macroToken]
        };
      } else {
        currentParameter.body += tokens[i].value;
        currentParameter.tokens.push(macroToken);
      }
    }
    i += 1;
  }

  return { parameters, endIndex: i + 1 };
}

export function shouldOutput(ifStack: boolean[]): boolean {
  if (ifStack.length === 0) {
    return true;
  }
  for (let i = 0; i < ifStack.length; i += 1) {
    if (!ifStack[i]) {
      return false;
    }
  }
  return true;
}
