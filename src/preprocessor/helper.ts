import { TokenType, type Token } from '@/lexer/TokenType';
import { type MacroParameter, type MacroToken } from './define';

export interface ParameterOutput {
  parameters: MacroParameter[];
  endIndex: number;
}

function toMacroToken(token: Token): MacroToken {
  const output: MacroToken = {
    type: token.type,
    value: token.value,
  };
  return output;
}

export function extractFormalParameters(tokens: Token[], startIndex: number): ParameterOutput | null {
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
    if (tokens[i].type === TokenType.IDENTIFIER) {
      currentParameter = {
        value: tokens[i].value,
        tokens: [toMacroToken(tokens[i])]
      };
    }
    if (tokens[i].type === TokenType.PUNCTUATION && tokens[i].value === ',') {
      if (currentParameter) {
        parameters.push(currentParameter);
      }
      currentParameter = null;
    }
    i += 1;
  }

  return { parameters, endIndex: i + 1 };
}
