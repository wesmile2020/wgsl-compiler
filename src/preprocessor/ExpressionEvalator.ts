import { MacroExpansion } from './MacroExpansion';
import { Parser } from '@/parser/Parser';

const defines = [
  'DIST(x1, y1, x2, y2) SQUARE(SUB(x2, x1)) + SQUARE(SUB(y2, y1))',
  'SUB(x, y) ((x) - (y))',
  'MULTIPLY(x, y) ((x) * (y))',
  'SQUARE(x) MULTIPLY(x, x)',
  'VALUE_TWELVE VALUE_TEN + 2',
  'VALUE_TEN 10',
];


const expansion = new MacroExpansion(defines);

const out1 = expansion.expand('DIST(1, 2, 3, 4) + VALUE_TWELVE');
console.log(out1.tokens.map((item) => item.value).join(''));

const parser = new Parser(out1.tokens);

const ast = parser.parse();
console.log(ast.program);
