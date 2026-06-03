import { useRef, useEffect } from "react";
import MonacoEditor, { loader, type Monaco, type OnMount } from "@monaco-editor/react";
import * as monacoAll from "monaco-editor";
import type { editor } from "monaco-editor";
import { Icon } from "./icon";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    const w = new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url), { type: "module" });
    void label;
    return w;
  },
};
loader.config({ monaco: monacoAll });

const ZS_OPS = [
  { label: "survey", detail: "Explore a space — gather candidates, scan for patterns.", insertText: 'survey(${1:topic}, {\n  lens: "${2:structural}",\n  count: ${3:10},\n})' },
  { label: "doubt", detail: "Stress-test, find friction, challenge assumptions.", insertText: 'doubt(${1:input}, {\n  lens: "${2:second-order effects}",\n  depth: ${3:2},\n})' },
  { label: "commit", detail: "Declare criteria and weights for evaluation.", insertText: 'commit({\n  criteria: [${1:"reversibility", "blast-radius"}],\n  weights: [${2:0.5, 0.5}],\n})' },
  { label: "synthesize", detail: "Combine findings into a single pattern or recommendation.", insertText: 'synthesize(${1:input1}, ${2:input2}, {\n  require: "${3:single dominant mechanism}",\n})' },
  { label: "checkpoint", detail: "Server-verified gate — proceed, halt, or ask.", insertText: 'checkpoint("${1:name}", {\n  ${2:data}: ${3:value},\n})' },
  { label: "conclude", detail: "Finalize with a typed result — validated against concludeShape.", insertText: 'conclude<${1:Result}>({\n  ${2:field}: ${3:value},\n})' },
  { label: "report", detail: "Log an intermediate observation to the trace.", insertText: 'report({ step: "${1:label}", ${2:key}: ${3:value} })' },
  { label: "invoke", detail: "Call a server function (authority-trusted).", insertText: 'invoke("${1:functionName}", ${2:args})' },
];

function defineZsThemes(monaco: Monaco) {
  monaco.editor.defineTheme("zs-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "b07adb" },
      { token: "string", foreground: "a3d9a5" },
      { token: "comment", foreground: "6b7280" },
      { token: "number", foreground: "d4a55a" },
      { token: "type", foreground: "7cc4d4" },
      { token: "identifier", foreground: "d4d4d4" },
      { token: "delimiter", foreground: "808080" },
    ],
    colors: {
      "editor.background": "#1a1a22",
      "editor.foreground": "#d4d4d4",
      "editor.lineHighlightBackground": "#ffffff0a",
      "editor.selectionBackground": "#6366f140",
      "editorCursor.foreground": "#e4e4e7",
      "editorLineNumber.foreground": "#52525b",
      "editorLineNumber.activeForeground": "#a1a1aa",
      "editor.inactiveSelectionBackground": "#6366f120",
      "editorWidget.background": "#27272f",
      "editorWidget.border": "#3f3f46",
      "editorSuggestWidget.background": "#27272f",
      "editorSuggestWidget.border": "#3f3f46",
      "editorSuggestWidget.selectedBackground": "#3f3f46",
      "input.background": "#27272f",
      "input.border": "#3f3f46",
      "scrollbarSlider.background": "#3f3f4640",
      "scrollbarSlider.hoverBackground": "#52525b80",
    },
  });

  monaco.editor.defineTheme("zs-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "7c3aed" },
      { token: "string", foreground: "166534" },
      { token: "comment", foreground: "9ca3af" },
      { token: "number", foreground: "b45309" },
      { token: "type", foreground: "0369a1" },
      { token: "identifier", foreground: "1f2937" },
      { token: "delimiter", foreground: "6b7280" },
    ],
    colors: {
      "editor.background": "#fafafa",
      "editor.foreground": "#1f2937",
      "editor.lineHighlightBackground": "#00000006",
      "editor.selectionBackground": "#6366f130",
      "editorCursor.foreground": "#1f2937",
      "editorLineNumber.foreground": "#d4d4d8",
      "editorLineNumber.activeForeground": "#71717a",
      "editorWidget.background": "#ffffff",
      "editorWidget.border": "#e4e4e7",
      "editorSuggestWidget.background": "#ffffff",
      "editorSuggestWidget.border": "#e4e4e7",
      "editorSuggestWidget.selectedBackground": "#f4f4f5",
      "input.background": "#f4f4f5",
      "input.border": "#e4e4e7",
      "scrollbarSlider.background": "#d4d4d840",
      "scrollbarSlider.hoverBackground": "#a1a1aa60",
    },
  });
}

function registerZsCompletions(monaco: Monaco) {
  monaco.languages.registerCompletionItemProvider("typescript", {
    triggerCharacters: ["."],
    provideCompletionItems: (model: editor.ITextModel, position: { lineNumber: number; column: number }) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: ZS_OPS.map((op) => ({
          label: op.label,
          kind: monaco.languages.CompletionItemKind.Function,
          detail: op.detail,
          insertText: op.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        })),
      };
    },
  });
}

let initialized = false;
let ambientsLoaded = false;

function handleBeforeMount(monaco: Monaco) {
  if (initialized) return;
  initialized = true;
  defineZsThemes(monaco);
  registerZsCompletions(monaco);
  loadAmbients(monaco);
}

async function loadAmbients(monaco: Monaco) {
  if (ambientsLoaded) return;
  ambientsLoaded = true;
  try {
    const token = localStorage.getItem("zs_token");
    const res = await fetch("/api/ambients", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const { cognitive, server } = (await res.json()) as { cognitive: string; server: string };
    const ts = monaco.languages.typescript;
    ts.typescriptDefaults.setCompilerOptions({
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      strict: true,
      noEmit: true,
      allowNonTsExtensions: true,
    });
    ts.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    if (cognitive) ts.typescriptDefaults.addExtraLib(cognitive, "file:///zs.cognitive.d.ts");
    if (server) ts.typescriptDefaults.addExtraLib(server, "file:///zs.server.d.ts");
  } catch { /* silent */ }
}

export function preloadMonaco() {
  loader.init();
}

export interface EditorMarker {
  line: number;
  message: string;
  severity: "error" | "warning" | "info";
}

interface ZsMonacoEditorProps {
  value: string;
  onChange: (v: string) => void;
  file: string;
  readOnly?: boolean;
  theme: "dark" | "light";
  markers?: EditorMarker[];
}

export function ZsMonacoEditor({ value, onChange, file, readOnly = false, theme, markers }: ZsMonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly });
    }
  }, [readOnly]);

  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const model = ed.getModel();
    if (!model) return;

    if (!markers || markers.length === 0) {
      monaco.editor.setModelMarkers(model, "zs-validate", []);
      return;
    }

    const monacoMarkers = markers.map((m) => ({
      startLineNumber: m.line,
      startColumn: 1,
      endLineNumber: m.line,
      endColumn: model.getLineMaxColumn(m.line),
      message: m.message,
      severity: m.severity === "error"
        ? monaco.MarkerSeverity.Error
        : m.severity === "warning"
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
    }));
    monaco.editor.setModelMarkers(model, "zs-validate", monacoMarkers);
  }, [markers]);

  const lines = value.split("\n").length;
  const monacoTheme = theme === "dark" ? "zs-dark" : "zs-light";

  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)]"
      style={{ background: "var(--bg-inset)", flex: 1, minHeight: 200, position: "relative" }}>
      <div className="flex shrink-0 items-center border-b border-[var(--border)]"
        style={{ gap: 8, padding: "8px 14px", background: "var(--bg-2)" }}>
        <Icon name="filecode" size={13} style={{ color: "var(--text-2)" }} />
        <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-1)" }}>{file}</span>
        <div className="flex-1" />
        <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)" }}>TypeScript · {lines} lines</span>
        {readOnly ? (
          <span className="flex items-center" style={{ gap: 5, fontSize: "var(--fs-xs)", color: "var(--text-2)" }}>
            <Icon name="alert" size={12} /> read-only
          </span>
        ) : (
          <span className="flex items-center" style={{ gap: 5, fontSize: "var(--fs-xs)", color: "var(--st-done)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--st-done)" }} /> Monaco
          </span>
        )}
      </div>
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language="typescript"
          theme={monacoTheme}
          value={value}
          onChange={(v) => onChange(v ?? "")}
          onMount={handleMount}
          beforeMount={handleBeforeMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fixedOverflowWidgets: true,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            renderWhitespace: "none",
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            padding: { top: 8 },
            suggest: {
              showKeywords: true,
              showSnippets: true,
            },
          }}
        />
      </div>
    </div>
  );
}
