# sarifview — Claude Reference

## Problem This Solves

SARIF (Static Analysis Results Interchange Format) is the standard output format
for security scanners like Semgrep, Gitleaks, and Grype. VS Code can display SARIF
findings in the Problems panel, but existing extensions require you to manually open
each `.sarif` file through a file picker every time you restart the editor. On Linux
and macOS, the picker hides dotfiles by default, making `.sarif/` directories (a
common convention for local scan results) annoying to navigate to.

This extension solves that: it watches a configurable directory (default `.sarif`)
and automatically populates the Problems panel on startup and whenever files change.
No clicks, no file picker, no hidden-directory friction.

---

## Design Philosophy

### Minimal scope
This extension does one thing: read `.sarif` files from a directory and show the
findings in the Problems panel. It is not a SARIF editor, a triage workflow tool,
or a CI integration. Any feature that is not "load SARIF → show in Problems" is
out of scope unless there is a compelling, concrete reason to add it.

Before adding a feature, ask: does this make the core job simpler, or does it make
the extension bigger? If the answer is "bigger," the answer is probably no.

### Well-tested
- `src/sarif.ts` has **no VS Code dependency** and can be unit-tested with plain
  Mocha. All parsing logic lives here.
- `src/extension.ts` handles VS Code integration and should stay thin — its job is
  to wire up the FileSystemWatcher and map `Finding` objects to `vscode.Diagnostic`.
- Every non-trivial code path in `sarif.ts` has a corresponding test in
  `src/test/sarif.test.ts`.
- Tests run without a VS Code instance: `npm test`

### Well-documented
- Public functions have JSDoc explaining parameters and behavior.
- `README.md` explains installation, configuration, and how it works.
- This file explains the _why_ behind design decisions.

---

## Architecture

```
src/
  sarif.ts        Pure SARIF parser. No vscode import. Returns Finding[].
  extension.ts    VS Code glue. Watches directory, maps Finding → Diagnostic.
  test/
    sarif.test.ts  Unit tests for the parser (Mocha, no VS Code required).
```

### Key types

**`Finding`** (`sarif.ts`) — tool-agnostic representation of a single result:
```typescript
interface Finding {
    tool: string;
    ruleId: string | undefined;
    message: string;
    severity: 'error' | 'warning' | 'note' | 'none';
    uri: string;       // absolute file:// URI
    startLine: number; // 0-based (VS Code convention)
    startColumn: number;
    endLine: number;
    endColumn: number;
}
```

### Suppression handling
Results with a non-empty `suppressions` array (e.g. from `# nosemgrep` inline
comments) are **excluded** from the Problems panel. This keeps the signal clean —
a suppressed finding is a known-and-accepted risk, not an actionable item.

### URI resolution
- `file://` URIs are passed through unchanged.
- Relative paths are resolved against the workspace root.
- `originalUriBaseIds` substitution is not implemented (out of scope for MVP).

---

## What Is Out of Scope

To keep this focused, the following are explicitly **not** planned:

- A custom SARIF panel or tree view
- Inline triage actions (accept/suppress from the editor)
- Writing suppressions back to `.semgrepignore` or `.grype.yaml`
- Multi-root workspace support (first workspace folder is used)
- Network fetching of SARIF files (CI artifact download belongs in a shell script)
- Severity filtering UI

If you find yourself wanting one of these, open an issue first and make the case
before implementing it.

---

## Running Tests

```bash
npm install
npm test
```

Tests do not require VS Code to be installed.

## Building the Extension

```bash
npm run compile
npm run package   # produces sarifview-*.vsix
```

Install locally:
```bash
code --install-extension sarifview-*.vsix
```
