import { useLayoutEffect, useRef, type ClipboardEvent as ReactClipboardEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

interface BoardTextEditorProps {
  x: number;
  y: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paddingX: number;
  paddingY: number;
  bold: boolean;
  italic: boolean;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  onTextChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onToggleBold: () => void;
  onToggleItalic: () => void;
}

export function BoardTextEditor({
  x,
  y,
  text,
  fontFamily,
  fontSize,
  lineHeight,
  paddingX,
  paddingY,
  bold,
  italic,
  color,
  backgroundColor,
  backgroundOpacity,
  onTextChange,
  onSave,
  onCancel,
  onToggleBold,
  onToggleItalic
}: BoardTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    if (editor.innerText !== text) {
      editor.innerText = text;
    }
  }, [text]);

  useLayoutEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    let secondFrame = 0;
    const focusEditor = () => {
      editor.focus({ preventScroll: true });
      placeCaretAtEnd(editor);
    };
    const timeoutId = window.setTimeout(focusEditor, 0);
    const focusTimer = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(focusEditor);
    });

    return () => {
      window.clearTimeout(timeoutId);
      cancelAnimationFrame(focusTimer);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      onToggleBold();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
      event.preventDefault();
      onToggleItalic();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSave();
    }
  }

  function handlePaste(event: ReactClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const textValue = event.clipboardData.getData("text/plain");

    if (!textValue) {
      return;
    }

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      onTextChange(`${text}${textValue}`);
      return;
    }

    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(textValue));
    selection.collapseToEnd();
    onTextChange(editorRef.current?.innerText ?? `${text}${textValue}`);
  }

  return (
    <div
      className="board-text-editor"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        ref={editorRef}
        className={`board-text-editor-content ${text.trim() ? "" : "is-empty"}`}
        contentEditable
        role="textbox"
        tabIndex={0}
        suppressContentEditableWarning
        data-placeholder="Type text"
        style={{
          fontFamily,
          fontSize,
          lineHeight: `${lineHeight}px`,
          padding: `${paddingY}px ${paddingX}px`,
          fontStyle: italic ? "italic" : "normal",
          fontWeight: bold ? 700 : 400,
          color,
          backgroundColor: withAlpha(backgroundColor, backgroundOpacity),
          textShadow: "none"
        }}
        onInput={(event) => {
          onTextChange(event.currentTarget.innerText);
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
      <p>Ctrl/Cmd+Enter places text. Esc cancels. Ctrl/Cmd+B and Ctrl/Cmd+I toggle style.</p>
    </div>
  );
}

function placeCaretAtEnd(element: HTMLDivElement) {
  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function withAlpha(color: string, opacity: number) {
  const normalizedOpacity = Math.max(0, Math.min(1, opacity));

  if (!color.startsWith("#")) {
    return normalizedOpacity > 0 ? color : "transparent";
  }

  const hex = color.slice(1);

  if (hex.length !== 3 && hex.length !== 6) {
    return normalizedOpacity > 0 ? color : "transparent";
  }

  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : hex;
  const alpha = Math.round(normalizedOpacity * 255)
    .toString(16)
    .padStart(2, "0");

  return normalizedOpacity > 0 ? `#${expanded}${alpha}` : "transparent";
}
