import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseSarif, Severity } from './sarif';

const COLLECTION_NAME = 'sarifview';

const SEVERITY_MAP: Record<Severity, vscode.DiagnosticSeverity> = {
    error:   vscode.DiagnosticSeverity.Error,
    warning: vscode.DiagnosticSeverity.Warning,
    note:    vscode.DiagnosticSeverity.Information,
    none:    vscode.DiagnosticSeverity.Hint,
};

export function activate(context: vscode.ExtensionContext): void {
    const collection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
    context.subscriptions.push(collection);

    const refresh = () => loadAll(collection);
    refresh();

    // Re-load whenever any .sarif file is added, changed, or removed
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.sarif');
    watcher.onDidChange(refresh, null, context.subscriptions);
    watcher.onDidCreate(refresh, null, context.subscriptions);
    watcher.onDidDelete(refresh, null, context.subscriptions);
    context.subscriptions.push(watcher);

    context.subscriptions.push(
        vscode.commands.registerCommand('sarifview.refresh', refresh)
    );
}

function getSarifDirectory(): string {
    return vscode.workspace.getConfiguration('sarifview').get<string>('directory', '.sarif');
}

function loadAll(collection: vscode.DiagnosticCollection): void {
    collection.clear();

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    const sarifDir = path.join(workspaceRoot, getSarifDirectory());
    if (!fs.existsSync(sarifDir)) return;

    let sarifFiles: string[];
    try {
        sarifFiles = fs.readdirSync(sarifDir).filter(f => f.endsWith('.sarif'));
    } catch {
        return;
    }

    const byUri = new Map<string, vscode.Diagnostic[]>();

    for (const file of sarifFiles) {
        let content: string;
        try {
            content = fs.readFileSync(path.join(sarifDir, file), 'utf8');
        } catch {
            continue;
        }

        let findings;
        try {
            findings = parseSarif(content, workspaceRoot);
        } catch {
            // Malformed SARIF — skip without crashing
            continue;
        }

        for (const finding of findings) {
            const range = new vscode.Range(
                finding.startLine, finding.startColumn,
                finding.endLine,   finding.endColumn
            );
            const diag = new vscode.Diagnostic(range, finding.message, SEVERITY_MAP[finding.severity]);
            diag.source = finding.tool;
            diag.code = finding.ruleId;

            const list = byUri.get(finding.uri) ?? [];
            list.push(diag);
            byUri.set(finding.uri, list);
        }
    }

    for (const [uri, diags] of byUri) {
        collection.set(vscode.Uri.parse(uri), diags);
    }
}

export function deactivate(): void {}
