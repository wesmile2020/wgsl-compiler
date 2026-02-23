import { For, createSignal, type JSX } from 'solid-js';
import classNames from 'classnames';
import styles from './ASTView.module.css';

interface Props {
  ast: object;
  tokenNameResolver?: (ast: object) => string;
  open?: boolean;
  onFocused?: (ast: object) => void;
  onUnfocused?: () => void;
}

interface TreeProps {
  key?: string;
  value: string | number | unknown[] | object;
  nameResolver?: (ast: object) => string;
  open?: boolean;
  onFocused?: (ast: object) => void;
  onUnfocused?: () => void;
}

function Tree(props: TreeProps) {
  const [open, setOpen] = createSignal(props.open ?? false);

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    setOpen(!open());
  }

  function onMouseOver(e: MouseEvent) {
    e.stopPropagation();
    if (typeof props.value === 'object' && props.value !== null) {
      props.onFocused?.(props.value);
    }
  }

  if (Array.isArray(props.value)) {
    return (
      <li
        class={classNames(styles.item, open() ? styles.opened : styles.closed)}
        onMouseOver={onMouseOver}
      >
        <span class={classNames(styles.key, styles.clickable)} onClick={toggle}>
          {props.key}:
        </span>
        {!open() ? (
          <>
            <span class={styles.gray}>{'['}</span>
            <span class={classNames(styles.gray, styles.properties)}>
              {props.value.length} elements
            </span>
            <span class={styles.gray}>{']'}</span>
          </>
        ) : (
          <>
            <span class={styles.gray}>{'['}</span>
            <ul class={styles.treeBody}>
              <For each={props.value}>
                {(value) => (
                  <Tree
                    value={value}
                    nameResolver={props.nameResolver}
                    onFocused={props.onFocused}
                    onUnfocused={props.onUnfocused}
                  />
                )}
              </For>
            </ul>
            <span class={styles.gray}>{']'}</span>
          </>
        )}
      </li>
    );
  }

  if (typeof props.value === 'object' && props.value !== null) {
    const name = () => {
      return props.nameResolver?.(props.value as object) || props.value.constructor.name;
    };
    const childKeys = () => {
      return Object.keys(props.value) as (keyof typeof props.value)[];
    };
    const shortMessage = () => {
      const maxKeys = 4;
      if (childKeys().length > maxKeys) {
        return `${childKeys().slice(0, maxKeys).join(', ')}...`;
      }
      return childKeys().join(', ');
    };

    return (
      <li
        class={classNames(styles.item, open() ? styles.opened : styles.closed)}
        onMouseOver={onMouseOver}
      >
        <span class={styles.key}>{props.key}:</span>
        <span class={classNames(styles.name, styles.clickable)} onClick={toggle}>
          {name()}
        </span>
        {!open() ? (
          <>
            <span class={styles.gray}>{'{'}</span>
            <span class={classNames(styles.gray, styles.properties)}>{shortMessage()}</span>
            <span class={styles.gray}>{'}'}</span>
          </>
        ) : (
          <>
            <span class={styles.gray}>{'{'}</span>
            <ul class={styles.treeBody}>
              <For each={childKeys()}>
                {(childKey) => (
                  <Tree
                    key={childKey}
                    value={props.value[childKey]}
                    nameResolver={props.nameResolver}
                    onFocused={props.onFocused}
                    onUnfocused={props.onUnfocused}
                  />
                )}
              </For>
            </ul>
            <span class={styles.gray}>{'}'}</span>
          </>
        )}
      </li>
    );
  }

  return (
    <li class={styles.item} onMouseOver={onMouseOver}>
      <span class={styles.key}>{props.key}:</span>
      <span class={styles.value}>
        {typeof props.value === 'string' ? `"${props.value}"` : props.value}
      </span>
    </li>
  );
}

export default function ASTView(props: Props): JSX.Element {
  return (
    <ul class={styles.tree} onMouseLeave={props.onUnfocused}>
      <Tree
        nameResolver={props.tokenNameResolver}
        value={props.ast}
        open={true}
        onFocused={props.onFocused}
        onUnfocused={props.onUnfocused}
      />
    </ul>
  );
}
