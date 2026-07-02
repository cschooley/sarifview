import * as assert from 'assert';
import { parseSarif } from '../sarif';

const WORKSPACE = '/workspace';

function sarif(results: object[], overrides: object = {}): string {
    return JSON.stringify({
        version: '2.1.0',
        runs: [{
            tool: { driver: { name: 'testtool' } },
            results,
            ...overrides,
        }],
    });
}

function location(uri: string, startLine = 1, startColumn = 1): object {
    return {
        locations: [{
            physicalLocation: {
                artifactLocation: { uri },
                region: { startLine, startColumn },
            },
        }],
    };
}

describe('parseSarif', () => {
    it('returns an empty array for a log with no results', () => {
        const findings = parseSarif(sarif([]), WORKSPACE);
        assert.deepStrictEqual(findings, []);
    });

    it('parses a basic finding', () => {
        const findings = parseSarif(sarif([{
            ruleId: 'test-rule',
            level: 'warning',
            message: { text: 'something smells' },
            ...location('src/app.py', 10, 5),
        }]), WORKSPACE);

        assert.strictEqual(findings.length, 1);
        const f = findings[0];
        assert.strictEqual(f.tool, 'testtool');
        assert.strictEqual(f.ruleId, 'test-rule');
        assert.strictEqual(f.message, 'something smells');
        assert.strictEqual(f.severity, 'warning');
        assert.strictEqual(f.uri, 'file:///workspace/src/app.py');
        assert.strictEqual(f.startLine, 9);    // 0-based
        assert.strictEqual(f.startColumn, 4);  // 0-based
    });

    it('skips suppressed results', () => {
        const findings = parseSarif(sarif([{
            ruleId: 'suppressed-rule',
            level: 'error',
            message: { text: 'nosemgrep' },
            suppressions: [{ kind: 'inSource' }],
            ...location('src/app.py'),
        }]), WORKSPACE);

        assert.deepStrictEqual(findings, []);
    });

    it('skips results with no physical location', () => {
        const findings = parseSarif(sarif([{
            ruleId: 'no-location',
            level: 'warning',
            message: { text: 'no location' },
        }]), WORKSPACE);

        assert.deepStrictEqual(findings, []);
    });

    it('defaults missing level to warning', () => {
        const findings = parseSarif(sarif([{
            message: { text: 'no level' },
            ...location('src/app.py'),
        }]), WORKSPACE);

        assert.strictEqual(findings[0].severity, 'warning');
    });

    it('maps all severity levels', () => {
        const levels = ['error', 'warning', 'note', 'none'] as const;
        for (const level of levels) {
            const findings = parseSarif(sarif([{
                level,
                message: { text: 'msg' },
                ...location('src/app.py'),
            }]), WORKSPACE);
            assert.strictEqual(findings[0].severity, level);
        }
    });

    it('passes through absolute file:// URIs unchanged', () => {
        const findings = parseSarif(sarif([{
            message: { text: 'msg' },
            locations: [{
                physicalLocation: {
                    artifactLocation: { uri: 'file:///absolute/path/file.py' },
                    region: { startLine: 1 },
                },
            }],
        }]), WORKSPACE);

        assert.strictEqual(findings[0].uri, 'file:///absolute/path/file.py');
    });

    it('handles multiple runs', () => {
        const log = JSON.stringify({
            version: '2.1.0',
            runs: [
                {
                    tool: { driver: { name: 'tool-a' } },
                    results: [{
                        message: { text: 'finding a' },
                        ...location('a.py'),
                    }],
                },
                {
                    tool: { driver: { name: 'tool-b' } },
                    results: [{
                        message: { text: 'finding b' },
                        ...location('b.py'),
                    }],
                },
            ],
        });

        const findings = parseSarif(log, WORKSPACE);
        assert.strictEqual(findings.length, 2);
        assert.strictEqual(findings[0].tool, 'tool-a');
        assert.strictEqual(findings[1].tool, 'tool-b');
    });

    it('collapses endLine/endColumn to start+1 when absent', () => {
        const findings = parseSarif(sarif([{
            message: { text: 'msg' },
            locations: [{
                physicalLocation: {
                    artifactLocation: { uri: 'src/app.py' },
                    region: { startLine: 3, startColumn: 7 },
                },
            }],
        }]), WORKSPACE);

        const f = findings[0];
        assert.strictEqual(f.endLine, 2);   // same as startLine (0-based)
        assert.strictEqual(f.endColumn, 7); // startColumn + 1
    });

    it('throws on invalid JSON', () => {
        assert.throws(() => parseSarif('not json', WORKSPACE));
    });
});
