import { MacroExpansion, type MacroValue } from './MacroExpansion';
import { Lexer } from '@/lexer/Lexer';
import { type Token, TokenType } from '@/lexer/TokenType';
import { shouldOutput } from './helper';

interface PreprocessOutput {
  code: string;
  errors: string[];
}

interface ExpressionProcessOutput {
  result: number;
  errors: string[];
}

export class ExpressionProcessor {
  private _lexer: Lexer = new Lexer();
  private _errors: string[] = [];

  process(expression: string, macros: Map<string, MacroValue>): ExpressionProcessOutput {
    this._errors = [];
    const { errors, tokens } = this._lexer.tokenize(expression);
    if (errors.length > 0) {
      for (let i = 0; i < errors.length; i += 1) {
        this._errors.push(`Preprocessor error at line ${errors[i].line}, column ${errors[i].column}: ${errors[i].message}`);
      }
      return { result: 0, errors: this._errors };
    }
    // to RPN and evaluate
    const stack: string[] = [];
    const output: (number | string)[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i].type === TokenType.IDENTIFIER) {
        // if (defines.has(tokens[i].value)) {
        //   const defineValue = defines.get(tokens[i].value)!;
        //   output.push(defineValue);
        // } else {
        //   return { result: 0, errors: [] };
        // }
      } else if (tokens[i].type === TokenType.INTEGER_LITERAL || tokens[i].type === TokenType.FLOAT_LITERAL) {
        output.push(Number(tokens[i].value));
      } else if (tokens[i].type === TokenType.BRACKET && tokens[i].value === '(') {
        stack.push('(');
      } else if (tokens[i].type === TokenType.BRACKET && tokens[i].value === ')') {
        while (stack.length > 0 && stack[stack.length - 1] !== '(') {
          output.push(stack.pop()!);
        }
        stack.pop(); // pop '('
      } else if (tokens[i].type === TokenType.OPERATOR) {
        // support '+', '-', '*', '/', '%', '!', '&&', '||', '==', '!=', '<', '>', '<=', '>='
        
      }
    }

    return { result: 0, errors: this._errors };
  }
}

/**
 * preprocess wgsl code custom directives
 * `///#define`, `///#if`, `///#ifdef`, `///#ifndef`, `///#elif`, `///#else`, `///#endif`
 * @param source source code
 * @returns preprocessed code and errors
 */
export function preprocess(source: string): PreprocessOutput {
  const processor = new ExpressionProcessor();
  const expansion = new MacroExpansion();
  const lines = source.split('\n');
  const output: string[] = [];
  const ifStack: boolean[] = [];
  const errors: string[] = [];

  const lexer = new Lexer();

  const filters: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('///#define')) {
      const defineString = lines[i].slice(10).trim();
      expansion.defineMacro(defineString);
      
    } else {
      filters.push(lines[i]);
    }
  }

  for (let i = 0; i < filters.length; i += 1) {
    if (filters[i].startsWith('///#if')) {
      continue;
    }

    if (shouldOutput(ifStack)) {
      output.push(filters[i]);
    }
  }

  return { code: output.join('\n'), errors };
}

const code = `
///#define VALUE 10
///#define VALUE_2 (VALUE + 5)
///#define MAX(a, b) ((a) > (b) ? (a) : (b))
`
preprocess(code);