import { MacroExpansion } from './MacroExpansion';
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
