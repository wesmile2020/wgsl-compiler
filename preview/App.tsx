import { createSignal, type JSX } from "solid-js";
import { type IRange } from "monaco-editor";
import { type ASTNode, Lexer, Parser, ASTKind, type Position } from "@/index";
import EditorView from "./components/EditorView";
import ASTView from "./components/ASTView";
import { camelCaseIdentifier } from "./utils/utils";

import styles from "./App.module.css";

function App(): JSX.Element {
  const [activeRange, setActiveRange] = createSignal<IRange>();
  const [ast, setAst] = createSignal<object | null>(null);
  let globalCode: string = "";

  function onCodeChange(code: string) {
    globalCode = code;

    const lexerOutput = new Lexer(code).tokenize();
    if (lexerOutput.errors.length !== 0) {
      console.error("Lexer errors:", lexerOutput.errors);
      setAst(null);
      return;
    }
    const parserOutput = new Parser(lexerOutput.tokens).parse();
    if (parserOutput.errors.length !== 0) {
      console.error("Parser errors:", parserOutput.errors);
      setAst(null);
      return;
    }
    setAst(parserOutput.program);
  }

  function getTokenName(node: object): string {
    if ("line" in node) {
      return "Position";
    }

    if (!("kind" in node)) {
      return "Unknown";
    }

    const ast = node as ASTNode;
    return camelCaseIdentifier(ASTKind[ast.kind]);
  }

  function onFocused(node: object) {
    if (!("position" in node)) {
      return;
    }
    const { line, column, start, end } = node.position as Position;
    let startLineNumber = line;
    let startColumn = column;
    let endLineNumber = line;
    let endColumn = column;
    for (let i = start; i < end; i += 1) {
      if (globalCode[i] === "\n") {
        endLineNumber += 1;
        endColumn = 1;
      } else {
        endColumn += 1;
      }
    }
    setActiveRange({ startLineNumber, startColumn, endLineNumber, endColumn });
  }

  function onUnfocused() {
    setActiveRange();
  }

  return (
    <div class={styles.app}>
      <EditorView onChange={onCodeChange} activeRange={activeRange()} />
      {ast() && (
        <ASTView
          ast={ast()! || {}}
          tokenNameResolver={getTokenName}
          onFocused={onFocused}
          onUnfocused={onUnfocused}
        />
      )}
    </div>
  );
}

export default App;
