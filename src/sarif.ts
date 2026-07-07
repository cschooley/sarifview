import * as path from 'path';

// Minimal SARIF 2.1.0 types covering what we actually need
interface SarifLog {
    runs?: SarifRun[];
}

interface SarifRun {
    tool: { driver: { name: string } };
    results?: SarifResult[];
    originalUriBaseIds?: Record<string, { uri: string }>;
}

interface SarifResult {
    ruleId?: string;
    level?: string;
    message: { text: string };
    locations?: SarifLocation[];
    suppressions?: { kind: string }[];
}

interface SarifLocation {
    physicalLocation?: {
        artifactLocation?: { uri?: string; uriBaseId?: string };
        region?: {
            startLine?: number;
            startColumn?: number;
            endLine?: number;
            endColumn?: number;
        };
    };
}

export type Severity = 'error' | 'warning' | 'note' | 'none';

export interface Finding {
    tool: string;
    ruleId: string | undefined;
    message: string;
    severity: Severity;
    /** Absolute file:// URI */
    uri: string;
    /** 0-based */
    startLine: number;
    /** 0-based */
    startColumn: number;
    /** 0-based */
    endLine: number;
    /** 0-based */
    endColumn: number;
}

const VALID_SEVERITIES = new Set(['error', 'warning', 'note', 'none']);

function normalizeSeverity(level: string | undefined): Severity {
    return VALID_SEVERITIES.has(level ?? '') ? (level as Severity) : 'warning';
}

/**
 * Parse a SARIF 2.1.0 JSON string and return actionable findings.
 *
 * Suppressed results (e.g. from `# nosemgrep` inline comments) are excluded
 * so they do not appear in the Problems panel.
 *
 * @param content    Raw SARIF JSON string
 * @param workspaceRoot  Absolute path to the workspace root, used to resolve
 *                       relative artifact URIs
 */
export function parseSarif(content: string, workspaceRoot: string): Finding[] {
    const log: SarifLog = JSON.parse(content);
    const findings: Finding[] = [];

    for (const run of log.runs ?? []) {
        const tool = run.tool?.driver?.name ?? 'unknown';

        for (const result of run.results ?? []) {
            if (result.suppressions?.length) continue;

            const phys = result.locations?.[0]?.physicalLocation;
            const rawUri = phys?.artifactLocation?.uri;
            if (!rawUri) continue;

            const uri = resolveUri(rawUri, workspaceRoot);
            if (!uri) continue;

            const region = phys?.region ?? {};
            const startLine = Math.max(0, (region.startLine ?? 1) - 1);
            const startColumn = Math.max(0, (region.startColumn ?? 1) - 1);
            const endLine = Math.max(0, (region.endLine ?? region.startLine ?? 1) - 1);
            const endColumn = region.endColumn != null
                ? Math.max(0, region.endColumn - 1)
                : startColumn + 1;

            findings.push({
                tool,
                ruleId: result.ruleId,
                message: result.message.text,
                severity: normalizeSeverity(result.level),
                uri,
                startLine,
                startColumn,
                endLine,
                endColumn,
            });
        }
    }

    return findings;
}

function resolveUri(rawUri: string, workspaceRoot: string): string | null {
    if (rawUri.startsWith('file://')) return rawUri;
    // Treat as relative path from workspace root, rejecting anything that
    // escapes it (e.g. a SARIF file with `../../etc/passwd` as a uri)
    const root = path.resolve(workspaceRoot);
    const abs = path.resolve(root, rawUri);
    if (abs !== root && !abs.startsWith(root + path.sep)) return null;
    return 'file://' + abs;
}
