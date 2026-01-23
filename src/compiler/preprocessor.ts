import { Lexer } from '@/lexer/Lexer';
import { type Token, TokenType } from '@/lexer/TokenType';

function shouldOutput(ifStack: boolean[]) {
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

/**
 * preprocessor wgsl code custom directives
 * `///#if`, `///#ifdef`, `///#ifndef`, `///#elif`, `///#else`, `///#endif`
 * @param source source code
 * @param defines custom defines
 * @returns filtered directive code
 */
export function preprocessor(source: string, defines: Record<string, boolean | number>): string {
  const lines = source.split('\n');
  const output: string[] = [];
  const ifStack: boolean[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (/^\/\/\/#if/.test(lines[i])) {

      continue;
    }

    if (shouldOutput(ifStack)) {
      output.push(lines[i]);
    }
  }

  return output.join('\n');
}
