/// <reference types="monaco-editor" />

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    if (label === 'typescript') {
      return new TypeScriptWorker();
    }
    return new EditorWorker();
  }
};
