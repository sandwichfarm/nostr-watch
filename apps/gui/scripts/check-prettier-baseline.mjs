import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const baselinePath = resolve(projectDir, '.config/quality-baselines/prettier.txt');
const update = process.argv.includes('--update');

function normalizedPaths(output) {
	return output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.filter((line) => !line.startsWith('['))
		.filter((line) => !line.includes('Checking formatting'))
		.sort();
}

function readBaseline() {
	try {
		return readFileSync(baselinePath, 'utf8').split(/\r?\n/).filter(Boolean).sort();
	} catch {
		return null;
	}
}

function diffSorted(current, baseline) {
	const baselineSet = new Set(baseline);
	const currentSet = new Set(current);
	const added = current.filter((item) => !baselineSet.has(item));
	const resolved = baseline.filter((item) => !currentSet.has(item));
	return { added, resolved };
}

const result = spawnSync('pnpm', ['exec', 'prettier', '--list-different', '.'], {
	cwd: projectDir,
	encoding: 'utf8'
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const current = normalizedPaths(output);

if (result.error || (result.status !== null && result.status > 1)) {
	console.error(output.trim());
	console.error(`prettier baseline command failed with status ${result.status}`);
	process.exit(result.status ?? 1);
}

if (update) {
	mkdirSync(dirname(baselinePath), { recursive: true });
	writeFileSync(baselinePath, `${current.join('\n')}\n`);
	console.log(`Updated prettier baseline: ${current.length} file(s)`);
	process.exit(0);
}

const baseline = readBaseline();
if (!baseline) {
	console.error(`Missing prettier baseline: ${baselinePath}`);
	console.error('Run `pnpm --filter @nostrwatch/gui baseline:lint` to create it.');
	process.exit(1);
}

const { added, resolved } = diffSorted(current, baseline);
if (added.length > 0) {
	console.error(`prettier found ${added.length} newly unformatted file(s) beyond the baseline.`);
	for (const item of added.slice(0, 50)) {
		console.error(`NEW ${item}`);
	}
	if (added.length > 50) {
		console.error(`...and ${added.length - 50} more`);
	}
	process.exit(1);
}

const resolvedNote =
	resolved.length > 0 ? `; ${resolved.length} baseline file(s) now formatted` : '';
console.log(
	`prettier baseline clean: ${current.length}/${baseline.length} unformatted file(s) remain${resolvedNote}`
);
