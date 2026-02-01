import { TokenType, type Token } from '@/lexer/TokenType';
import { Lexer } from '@/lexer/Lexer';

export interface MacroValue {
  body: string;
  args: string[] | null;
  tokens: Token[];
  dependencies: Set<string>;
}

export interface MacroExpansionOutput {
  code: string;
  errors: string[];
}

export class MacroExpansion {
  private _macros: Map<string, MacroValue> = new Map();
  private _lexer: Lexer = new Lexer();
  private _errors: string[] = [];

  defineMacro(line: string): void {
    const { tokens, errors } = this._lexer.tokenize(line);
    if (errors.length > 0) {
      for (let i = 0; i < errors.length; i += 1) {
        this._errors.push(`MacroExpansion define error: ${errors[i].message}`);
      }
    }
    if (tokens.length === 0) {
      this._errors.push(`MacroExpansion define error: no defined macro name.`);
      return;
    }
    const dependencies: Set<string> = new Set();
    const macroValueTokens: Token[] = [];
    // check is macro function definition
    if (/^[a-zA-Z_][a-zA-Z0-9_]*\(.+\)/.test(line)) {
      const macroName = tokens[0].value;
      const args: string[] = [];
      let isArgParsing = false;
      let argEndpoint = -1;
      let macroValue = '';
      // parse macro args
      for (let i = 1; i < tokens.length; i += 1) {
        if (tokens[i].type === TokenType.BRACKET && tokens[i].value === '(') {
          isArgParsing = true;
          continue;
        }
        if (isArgParsing && tokens[i].type === TokenType.BRACKET && tokens[i].value === ')') {
          isArgParsing = false;
          argEndpoint = i;
          break;
        }
        if (isArgParsing && tokens[i].type === TokenType.IDENTIFIER) {
          args.push(tokens[i].value);
        }
      }
      // parse macro body
      for (let i = argEndpoint + 1; i < tokens.length; i += 1) {
        macroValue += tokens[i].value;
        macroValueTokens.push(tokens[i]);
      }
      this._macros.set(macroName, {
        body: macroValue,
        args: args.length > 0 ? args : null,
        dependencies,
        tokens: macroValueTokens,
      });
    } else {
      const macroName = tokens[0].value;
      let macroValue = '';
      for (let i = 1; i < tokens.length; i += 1) {
        macroValue += tokens[i].value;
        if (tokens[i].type === TokenType.IDENTIFIER) {
          dependencies.add(tokens[i].value);
        }
        macroValueTokens.push(tokens[i]);
      }
      this._macros.set(macroName, {
        body: macroValue,
        args: null,
        dependencies,
        tokens: macroValueTokens,
      });
    }
  }

  private _processMacro(macroName: string, macroValue: MacroValue): string {
    let output = macroValue.body;
    const queue: string[] = [...macroValue.dependencies];
    while (queue.length > 0) {
      const dependence = queue.shift()!;
      const dependenceValue = this._macros.get(dependence);
      if (dependenceValue) {
        queue.push(...dependenceValue.dependencies);
        output = output.replaceAll(dependence, dependenceValue.body);
      }
    }
    const nextMacroValue = {
      ...macroValue,
      body: output,
      dependencies: new Set<string>(),
    };
    this._macros.set(macroName, nextMacroValue);

    return output;
  }

  expansion(line: string): MacroExpansionOutput {
    const { tokens, errors } = this._lexer.tokenize(line);
    if (errors.length > 0) {
      for (let i = 0; i < errors.length; i += 1) {
        this._errors.push(`MacroExpansion expansion error: ${errors[i].message}`);
      }
    }
    let output = '';
    while (tokens.length > 0) {
      const token = tokens.shift()!;
      if (token.type === TokenType.IDENTIFIER && this._macros.has(token.value)) {
        const macro = this._macros.get(token.value)!;
        output += this._processMacro(token.value, macro);
      } else {
        output += token.value;
      }
    }
    return { code: output, errors: this._errors };
  }
}

const expansion = new MacroExpansion();
expansion.defineMacro('VALUE_TEN VALUE_PLUS_FIVE - 5');
expansion.defineMacro('VALUE_PLUS_FIVE (VALUE + 5)');
expansion.defineMacro('VALUE 10');
expansion.defineMacro('MULTIPLY(a, b) ((a) * (b))');

const output1 = expansion.expansion('VALUE_TEN + 100');
console.log(output1);

const output2 = expansion.expansion('VALUE * 10');
console.log(output2);
