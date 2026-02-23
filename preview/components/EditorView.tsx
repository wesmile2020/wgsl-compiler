import { editor, type IRange } from 'monaco-editor';
import { onMount, on, createEffect, type JSX } from 'solid-js';
import styles from './EditorView.module.css';

interface Props {
  onChange?: (value: string) => void;
  activeRange?: IRange;
}

export default function EditorView(props: Props): JSX.Element {
  let container: HTMLDivElement | undefined = undefined;
  let editorView: editor.IStandaloneCodeEditor | null = null;
  onMount(() => {
    if (!container) {
      return;
    }
    editorView = editor.create(container, {
      language: 'txt',
      fontFamily: `'cascadia code', monospace`,
      minimap: {
        enabled: false,
      },
      automaticLayout: true,
      placeholder: 'Type your code here',
    });
    let timer: number | null = null;
    editorView.onDidChangeModelContent(() => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      timer = window.setTimeout(() => {
        const code = editorView!.getValue();
        props.onChange?.(code);
      }, 300);
    });
    const code = editorView.getValue();
    if (code) {
      props.onChange?.(code);
    }
  });

  createEffect(
    on(
      () => props.activeRange,
      (value) => {
        if (!value) {
          editorView?.setSelection({
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: 1,
            endColumn: 1,
          });
          return;
        }
        editorView?.setSelection(value);
      },
    ),
  );

  return (
    <div ref={container}
      class={styles.container}>
    </div>
  );
}
