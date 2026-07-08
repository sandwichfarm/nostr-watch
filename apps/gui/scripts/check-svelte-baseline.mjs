import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const repoDir = resolve(projectDir, '../..');
const baselinePath = resolve(projectDir, '.config/quality-baselines/svelte-check.txt');
const update = process.argv.includes('--update');

function normalizeMachineLine(line) {
	return line
		.replaceAll(repoDir, '<repo>')
		.replaceAll(projectDir, '<gui>')
		.replace(/\/[^\s"'`)]*(?:\/[^\s"'`)]*){2,}/g, '<abs-path>');
}

function normalizedDiagnostics(output) {
	return output
		.split(/\r?\n/)
		.filter((line) => /^\d+\s+(ERROR|WARNING)\s+/.test(line))
		.map((line) => line.replace(/^\d+\s+/, '').trim())
		.map(normalizeMachineLine)
		.sort();
}

function readBaseline() {
	try {
		return readFileSync(baselinePath, 'utf8').split(/\r?\n/).filter(Boolean).sort();
	} catch {
		return null;
	}
}

function diffMultiset(current, baseline) {
	const remaining = new Map();
	for (const item of baseline) {
		remaining.set(item, (remaining.get(item) ?? 0) + 1);
	}

	const added = [];
	for (const item of current) {
		const count = remaining.get(item) ?? 0;
		if (count > 0) {
			remaining.set(item, count - 1);
		} else {
			added.push(item);
		}
	}

	const resolved = [];
	for (const [item, count] of remaining) {
		for (let index = 0; index < count; index += 1) {
			resolved.push(item);
		}
	}

	return { added, resolved };
}

const result = spawnSync(
	'pnpm',
	['exec', 'svelte-check', '--tsconfig', './tsconfig.json', '--output', 'machine'],
	{
		cwd: projectDir,
		encoding: 'utf8'
	}
);

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const current = normalizedDiagnostics(output);

if (result.error || (result.status !== null && result.status > 1)) {
	console.error(output.trim());
	console.error(`svelte-check baseline command failed with status ${result.status}`);
	process.exit(result.status ?? 1);
}

if (update) {
	mkdirSync(dirname(baselinePath), { recursive: true });
	writeFileSync(baselinePath, `${current.join('\n')}\n`);
	console.log(`Updated svelte-check baseline: ${current.length} diagnostics`);
	process.exit(0);
}

const baseline = readBaseline();
if (!baseline) {
	console.error(`Missing svelte-check baseline: ${baselinePath}`);
	console.error('Run `pnpm --filter @nostrwatch/gui baseline:check` to create it.');
	process.exit(1);
}

const { added, resolved } = diffMultiset(current, baseline);
if (added.length > 0) {
	console.error(`svelte-check found ${added.length} new diagnostic(s) beyond the baseline.`);
	for (const item of added.slice(0, 25)) {
		console.error(`NEW ${item}`);
	}
	if (added.length > 25) {
		console.error(`...and ${added.length - 25} more`);
	}
	process.exit(1);
}

const resolvedNote =
	resolved.length > 0 ? `; ${resolved.length} baseline diagnostic(s) resolved` : '';
console.log(
	`svelte-check baseline clean: ${current.length}/${baseline.length} diagnostics remain${resolvedNote}`
);
