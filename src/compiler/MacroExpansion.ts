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

  private _replaceMacro(macroName: string, macroValue: MacroValue, actualArgs: string[]): string {
    let output = macroValue.body;
    console.log(macroValue.body, actualArgs);
    if (macroValue.args) {
      if (actualArgs.length < macroValue.args.length) {
        this._errors.push(`MacroExpansion argument error: ${macroName} actual args do not match`);
      }
      const min = Math.min(actualArgs.length, macroValue.args.length);
      for (let i = 0; i < min; i += 1) {
        output = output.replaceAll(macroValue.args[i], actualArgs[i]);
      }
    }
    return output;
  }

  private _processMacro(macroName: string, macroValue: MacroValue, actualArgs: string[]): string {
    let output = this._replaceMacro(macroName, macroValue, actualArgs);
    const queue: string[] = [...macroValue.dependencies];
    const circleSet: Set<string> = new Set<string>();
    while (queue.length > 0) {
      const dependence = queue.shift()!;
      if (circleSet.has(dependence)) {
        this._errors.push(`MacroExpansion circular dependency error: ${dependence}`);
        continue;
      }
      circleSet.add(dependence);
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

  private _transform(tokens: Token[]): string {
    let output = '';
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (token.type === TokenType.IDENTIFIER && this._macros.has(token.value)) {
        const macroName = token.value;
        const macro = this._macros.get(macroName)!;
        let actualArgs: string[] = [];
        if (macro.args) {
          let j = i + 1;
          let bracketCount = 0;
          if (j < tokens.length && tokens[j].type === TokenType.BRACKET && tokens[j].value === '(') {
            bracketCount += 1;
            j += 1;
          }
          let currentArg = [];
          while (j < tokens.length) {
            const argToken = tokens[j];
            if (argToken.type === TokenType.BRACKET && argToken.value === '(') {
              bracketCount += 1;
            } else if (argToken.type === TokenType.BRACKET && argToken.value === ')') {
              bracketCount -= 1;
            }
            if (bracketCount === 0) {
              if (currentArg.length > 0) {
                const argParam = this._transform(currentArg);
                actualArgs.push(argParam);
              }
              break;
            }
            if (argToken.type === TokenType.PUNCTUATION && argToken.value === ',') {
              if (currentArg.length > 0) {
                const argParam = this._transform(currentArg);
                actualArgs.push(argParam);
              }
              currentArg = [];
            } else {
              currentArg.push(argToken);
            }
            j += 1;
          }
          i = j;
        }
        output += this._processMacro(token.value, macro, actualArgs);
      } else {
        output += token.value;
      }
      i += 1;
    }

    return output;
  }

  expansion(line: string): MacroExpansionOutput {
    const { tokens, errors } = this._lexer.tokenize(line);
    if (errors.length > 0) {
      for (let i = 0; i < errors.length; i += 1) {
        this._errors.push(`MacroExpansion expansion error: ${errors[i].message}`);
      }
    }
    const code = this._transform(tokens);
    return { code, errors: this._errors };
  }
}

const expansion = new MacroExpansion();
expansion.defineMacro('VALUE_TEN VALUE_PLUS_FIVE - 5');
expansion.defineMacro('VALUE_PLUS_FIVE (VALUE + 5)');
expansion.defineMacro('VALUE 10');
expansion.defineMacro('MULTIPLY(a, b) ((a) * (b))');
expansion.defineMacro('SQUARE(x) MULTIPLY(x, x)');

const output1 = expansion.expansion('VALUE_TEN + 100');
console.log(output1);

const output2 = expansion.expansion('SQUARE(VALUE_PLUS_FIVE + 3 - 1, 10) + VALUE');
console.log(output2);
