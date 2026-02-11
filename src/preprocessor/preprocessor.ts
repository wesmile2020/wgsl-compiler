import { Parser } from '@/parser/Parser';
import { MacroExpansion } from './MacroExpansion';
import { evaluate } from './evaluate';
import { shouldOutput } from './helper';

export interface PreprocessOutput {
  code: string;
  errors: string[];
}

/**
 * preprocess wgsl code custom directives
 * `///#define`, `///#if`, `///#ifdef`, `///#ifndef`,
 * `///#elif`, `///#elifdef`, `///#elifndef`,
 * `///#else`, `///#endif`
 * @param source source code
 * @returns preprocessed code and errors
 */
export function preprocess(source: string): PreprocessOutput {
  const lines = source.split('\n');
  const output: string[] = [];
  const ifStack: boolean[] = [];
  const errors: string[] = [];

  const defines: string[] = [];
  const filters: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('///#define')) {
      const defineString = lines[i].slice(10).trim();
      defines.push(defineString);
    } else {
      filters.push(lines[i]);
    }
  }

  const expansion = new MacroExpansion(defines);

  for (let i = 0; i < filters.length; i += 1) {
    if (filters[i].startsWith('///#if')) {
      const condition = filters[i].slice(7).trim();
      const expandOutput = expansion.expand(condition);
      let ifValue = false;
      if (expandOutput.errors.length > 0) {
        errors.push(...expandOutput.errors);
      } else {
        const parseOutput = new Parser(expandOutput.tokens).parse();
        if (parseOutput.errors.length > 0) {
          for (let k = 0; k < parseOutput.errors.length; k += 1) {
            errors.push(parseOutput.errors[k].message);
          }
        } else if (parseOutput.program.body.length > 0) {
          const evaluateOutput = evaluate(parseOutput.program.body[0]);
          if (evaluateOutput.errors.length > 0) {
            errors.push(...evaluateOutput.errors);
          } else {
            ifValue = evaluateOutput.value !== 0;
          }
        }
      }
      ifStack.push(ifValue);
      continue;
    }
    if (filters[i].startsWith('///#endif')) {
      ifStack.pop();
      continue;
    }
    if (filters[i].startsWith('///#else')) {
      if (ifStack.length === 0) {
        errors.push('Unexpected #else');
      } else {
        ifStack[ifStack.length - 1] = !ifStack[ifStack.length - 1];
      }
      continue;
    }

    if (shouldOutput(ifStack)) {
      output.push(filters[i]);
    }
  }
  console.log(output.join('\n'), errors);
  return { code: output.join('\n'), errors };
}

const code = `
///#define VALUE 10
///#define VALUE_2 (VALUE + 5)
///#define MAX(a, b) ((a) > (b) ? (a) : (b))
///#if VALUE > 5
console.log('Hello, World!');
///#endif
`;
preprocess(code);
