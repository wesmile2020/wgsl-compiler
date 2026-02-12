import { TokenType, type Token } from '@/lexer/TokenType';
import { Lexer } from '@/lexer/Lexer';
import {
  type ValueMacro,
  type FunctionMacro,
  type Macro,
  type MacroParameter,
  MacroType,
} from './MacroType';
import { extractParameters } from './helper';

export interface MacroExpandOutput {
  tokens: Token[];
  errors: string[];
}

export class MacroExpansion {
  private _macros: Map<string, Macro> = new Map();
  private _errors: string[] = [];

  constructor(defines: string[]) {
    for (let i = 0; i < defines.length; i += 1) {
      const macro = this._parseDefine(defines[i]);
      if (macro) {
        this._macros.set(macro.name, macro);
      }
    }
    for (const [_, macro] of this._macros) {
      this._flatMacro(macro, new Set());
    }
  }

  private _runMacroFunction(
    parentName: string,
    macro: FunctionMacro,
    localVariable: Set<string>,
    actualParameters: MacroParameter[],
    visited: Set<string>,
  ): Token[] {
    if (visited.has(macro.name)) {
      this._errors.push(
        `Macro expansion error: circular macro definition detected. ${[...visited, macro.name].join('->')}`,
      );
      return macro.tokens;
    }
    visited.add(macro.name);
    if (macro.formalParameters.length !== actualParameters.length) {
      this._errors.push(
        `MacroExpansion argument error: ${macro.name} actual args do not match on macro ${parentName}`,
      );
    }
    const parameterMap: Map<string, MacroParameter> = new Map();
    const min = Math.min(actualParameters.length, macro.formalParameters.length);
    for (let i = 0; i < min; i += 1) {
      // process actual parameter
      const flattedParameter: MacroParameter = {
        body: '',
        tokens: [],
      };
      const actualParameterTokens = actualParameters[i].tokens;
      let j = 0;
      while (j < actualParameterTokens.length) {
        const token = actualParameterTokens[j];
        if (
          token.type === TokenType.IDENTIFIER &&
          !localVariable.has(token.value) &&
          this._macros.has(token.value)
        ) {
          const nestedMacro = this._flatMacro(this._macros.get(token.value)!, visited);
          if (nestedMacro.type === MacroType.VALUE) {
            flattedParameter.body += nestedMacro.body;
            flattedParameter.tokens.push(...nestedMacro.tokens);
          } else if (nestedMacro.type === MacroType.FUNCTION) {
            const childActualParameters = extractParameters(actualParameterTokens, j + 1);
            if (childActualParameters) {
              const outTokens = this._runMacroFunction(
                macro.name,
                nestedMacro,
                localVariable,
                childActualParameters.parameters,
                visited,
              );
              flattedParameter.body += outTokens.map((item) => item.value).join('');
              flattedParameter.tokens.push(...outTokens);
              j = childActualParameters.endIndex - 1;
            }
          }
        } else {
          flattedParameter.body += token.value;
          flattedParameter.tokens.push(token);
        }
        j += 1;
      }
      parameterMap.set(macro.formalParameters[i].body, flattedParameter);
    }
    visited.delete(macro.name);
    const output: Token[] = [];
    for (let i = 0; i < macro.tokens.length; i += 1) {
      const token = macro.tokens[i];
      if (parameterMap.has(token.value)) {
        const actualParameter = parameterMap.get(token.value)!;
        output.push(...actualParameter.tokens);
      } else {
        output.push(token);
      }
    }

    return output;
  }

  private _flatMacro(macro: Macro, visited: Set<string>): Macro {
    if (macro.flatted) {
      return macro;
    }
    if (visited.has(macro.name)) {
      this._errors.push(
        `Macro expansion error: circular macro definition detected. ${[...visited, macro.name].join('->')}`,
      );
      const flattedMacro: Macro = { ...macro, flatted: true };
      this._macros.set(macro.name, flattedMacro);
      return flattedMacro;
    }
    visited.add(macro.name);
    const flattedTokens: Token[] = [];
    let i = 0;
    while (i < macro.tokens.length) {
      const token = macro.tokens[i];
      if (token.type === TokenType.IDENTIFIER && this._macros.has(token.value)) {
        const nestedMacro = this._flatMacro(this._macros.get(token.value)!, visited);
        if (nestedMacro.type === MacroType.VALUE) {
          flattedTokens.push(...nestedMacro.tokens);
        } else if (nestedMacro.type === MacroType.FUNCTION) {
          const localVariable: Set<string> = new Set();
          if (macro.type === MacroType.FUNCTION) {
            for (let i = 0; i < macro.formalParameters.length; i += 1) {
              localVariable.add(macro.formalParameters[i].body);
            }
          }
          const actualParameters = extractParameters(macro.tokens, i + 1);
          if (actualParameters) {
            const outTokens = this._runMacroFunction(
              macro.name,
              nestedMacro,
              localVariable,
              actualParameters.parameters,
              visited,
            );
            flattedTokens.push(...outTokens);

            i = actualParameters.endIndex - 1;
          }
        }
      } else {
        flattedTokens.push(token);
      }

      i += 1;
    }
    visited.delete(macro.name);
    const flattedMacro: Macro = {
      ...macro,
      flatted: true,
      body: flattedTokens.map((item) => item.value).join(''),
      tokens: flattedTokens,
    };
    this._macros.set(macro.name, flattedMacro);

    return flattedMacro;
  }

  private _parseDefine(define: string): Macro | null {
    const { tokens, errors } = new Lexer(define).tokenize();
    tokens.pop(); // pop eof token
    for (let i = 0; i < errors.length; i += 1) {
      this._errors.push(`Macro definition error: ${errors[i].message}`);
    }
    if (tokens.length === 0) {
      this._errors.push(`MacroExpansion define error: no defined macro name.`);
      return null;
    }
    if (/^[a-zA-Z_][a-zA-Z0-9_]*\(.+\)/.test(define)) {
      const macro: FunctionMacro = {
        type: MacroType.FUNCTION,
        flatted: false,
        name: tokens[0].value,
        formalParameters: [],
        body: '',
        tokens: [],
      };
      const parameterOutput = extractParameters(tokens, 1);
      if (!parameterOutput) {
        this._errors.push(`Invalid macro function definition: ${define}`);
        return null;
      }
      macro.formalParameters = parameterOutput.parameters;
      for (let i = parameterOutput.endIndex; i < tokens.length; i += 1) {
        macro.body += tokens[i].value;
        macro.tokens.push(tokens[i]);
      }
      return macro;
    }
    const macro: ValueMacro = {
      type: MacroType.VALUE,
      flatted: false,
      name: tokens[0].value,
      body: '',
      tokens: [],
    };
    for (let i = 1; i < tokens.length; i += 1) {
      macro.body += tokens[i].value;
      macro.tokens.push(tokens[i]);
    }
    return macro;
  }

  getMacro(name: string): Macro | null {
    return this._macros.get(name) || null;
  }

  hasMacro(name: string): boolean {
    return this._macros.has(name);
  }

  getErrors(): string[] {
    return this._errors;
  }

  expand(line: string): MacroExpandOutput {
    const initErrors = this._errors;
    this._errors = [];
    const { tokens, errors } = new Lexer(line).tokenize();
    tokens.pop(); // pop eof token
    const output: MacroExpandOutput = {
      tokens: [],
      errors: [],
    };
    for (let i = 0; i < errors.length; i += 1) {
      output.errors.push(`MacroExpansion expand error: ${errors[i].message}`);
    }
    let i = 0;
    while (i < tokens.length) {
      if (tokens[i].type === TokenType.IDENTIFIER && this._macros.has(tokens[i].value)) {
        const nestedMacro = this._flatMacro(this._macros.get(tokens[i].value)!, new Set());
        if (nestedMacro.type === MacroType.VALUE) {
          output.tokens.push(...nestedMacro.tokens);
        } else if (nestedMacro.type === MacroType.FUNCTION) {
          const actualParameters = extractParameters(tokens, i + 1);
          if (actualParameters) {
            const outTokens = this._runMacroFunction(
              '__GLOBAL__',
              nestedMacro,
              new Set(),
              actualParameters.parameters,
              new Set(),
            );
            output.tokens.push(...outTokens);
            i = actualParameters.endIndex - 1;
          }
        }
      } else {
        output.tokens.push(tokens[i]);
      }

      i += 1;
    }
    // add catch expand error
    output.errors.push(...this._errors);
    // recovery init error;
    this._errors = initErrors;
    return output;
  }
}
