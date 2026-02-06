import { TokenType } from '@/lexer/TokenType';
import {
  OPERATORS,
  type OperatorInfo,
  type MacroToken
} from './define';

interface RPNConvertOutput {
  tokens: MacroToken[];
  errors: string[];
}

export class RPNConverter {
  private _errors: string[] = [];

  convert(tokens: MacroToken[]): RPNConvertOutput {
    const output: RPNConvertOutput = {
      tokens: [],
      errors: [],
    };
    const operatorStack: MacroToken[] = [];
    let prevToken: MacroToken | null = null;
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token.type === TokenType.INTEGER_LITERAL || token.type === TokenType.FLOAT_LITERAL) {
        output.tokens.push(token);
      } else if (token.type === TokenType.OPERATOR && token.value in OPERATORS) {

      } else if (token.type === TokenType.PUNCTUATION && token.value === '(') {
        operatorStack.push(token);
      } else if (token.type === TokenType.PUNCTUATION && token.value === ')') {

      }

      prevToken = tokens[i];
    }

    return output;
  }
}
