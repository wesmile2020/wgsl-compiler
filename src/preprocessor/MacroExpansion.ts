import { TokenType } from '@/lexer/TokenType';
import { Lexer } from '@/lexer/Lexer';
import {
  type ValueMacro,
  type FunctionMacro,
  type Macro,
  type MacroToken,
} from './define';
import { extractFormalParameters } from './helper';

export interface MacroExpansionOutput {
  code: string;
  errors: string[];
}

export class MacroExpansion {
  private _macros: Map<string, Macro> = new Map();
  private _lexer: Lexer = new Lexer();
  private _errors: string[] = [];

  constructor(defines: string[]) {
    for (let i = 0; i < defines.length; i += 1) {
      const macro = this._parseDefine(defines[i]);
      if (macro) {
        this._macros.set(macro.name, macro);
      }
    }

    for (const [name, macro] of this._macros) {
      this._flatMacro(name, macro, new Set());
    }
  }

  private _flatMacro(name: string, macro: Macro, visited: Set<string>): Macro {
    if (macro.flatted) {
      return macro;
    }
    if (visited.has(name)) {
      this._errors.push(`Macro expansion error: circular macro definition detected.`);
      return macro;
    }
    const flattedTokens: MacroToken[] = [];
    for (let i = 0; i < macro.tokens.length; i += 1) {
      const token = macro.tokens[i];
      if (token.type === TokenType.IDENTIFIER && this._macros.has(token.value)) {
        const newVisited = new Set([name]);
        const nestedMacro = this._flatMacro(token.value, this._macros.get(token.value)!, newVisited);
        if (nestedMacro.type === 'value') {
          flattedTokens.push(...nestedMacro.tokens);
        } else {
          // TODO: function macro expansion
        }
      } else {
        flattedTokens.push(token);
      }
    }
    const flattedMacro: Macro = {
      ...macro,
      flatted: true,
      body: flattedTokens.map((item) => item.value).join(''),
      tokens: flattedTokens,
    };
    this._macros.set(name, flattedMacro);

    return flattedMacro;
  }

  getMacro(name: string): Macro | null {
    return this._macros.get(name) || null;
  }

  private _parseDefine(define: string): Macro | null {
    const { tokens, errors } = this._lexer.tokenize(define);
    for (let i = 0; i < errors.length; i += 1) {
      this._errors.push(`Macro definition error: ${errors[i].message}`);
    }
    if (tokens.length === 0) {
      this._errors.push(`MacroExpansion define error: no defined macro name.`);
      return null;
    }
    if (/^[a-zA-Z_][a-zA-Z0-9_]*\(.+\)/.test(define)) {
      const macro: FunctionMacro = {
        type: 'function',
        flatted: false,
        name: tokens[0].value,
        formalParameters: [],
        body: '',
        tokens: [],
      };
      const parameterOutput = extractFormalParameters(tokens, 1);
      if (!parameterOutput) {
        this._errors.push(`Invalid macro function definition: ${define}`);
        return null;
      }
      macro.formalParameters = parameterOutput.parameters;
      for (let i = parameterOutput.endIndex; i < tokens.length; i += 1) {
        macro.body += tokens[i].value;
        macro.tokens.push({
          type: tokens[i].type,
          value: tokens[i].value,
        });
      }
      return macro;
    }
    const macro: ValueMacro = {
      type: 'value',
      flatted: false,
      name: tokens[0].value,
      body: '',
      tokens: [],
    };
    for (let i = 1; i < tokens.length; i += 1) {
      macro.body += tokens[i].value;
      macro.tokens.push({
        type: tokens[i].type,
        value: tokens[i].value,
      });
    }
    return macro;
  }
}

const expand = new MacroExpansion([
  'VALUE_FIVE (VALUE_TEN) / (VALUE_TWO)',
  'VALUE_TEN VALUE_ONE * 10',
  'VALUE_TWO VALUE_ONE + VALUE_ONE',
  'VALUE_ONE 1',
]);

console.log(expand.getMacro('VALUE_FIVE')?.body);
console.log(expand.getMacro('VALUE_TWO')?.body);
