#!/usr/bin/env node
// Writes live REST API and CVM prices into the built GUI (dist/):
//   - schema.org JSON-LD in every dist/**/*.html (AggregateOffer + per-endpoint Offers)
//   - the "agent-pricing" block in dist/llms.txt and dist/index.md
//
// Sources:
//   REST API: https://api.nostr.watch/v2/openapi.json  -> info["x-pricing"]
//   CVM:      https://cvm.nostr.watch/config.json      -> endpoints[]
//
// If a source can't be fetched, the last good copy in config/agent-pricing.snapshot.json
// is used and a warning is printed. Set AGENT_PRICING_STRICT=1 to fail instead.
// `--update-snapshot` writes freshly fetched prices back to the snapshot file.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SNAPSHOT = path.join(ROOT, 'config', 'agent-pricing.snapshot.json');
const STRICT = process.env.AGENT_PRICING_STRICT === '1';
const UPDATE_SNAPSHOT = process.argv.includes('--update-snapshot');

const SOURCES = {
	api: {
		url: process.env.AGENT_PRICING_API_URL ?? 'https://api.nostr.watch/v2/openapi.json',
		docs: 'https://api.nostr.watch/v2/',
		offersId: 'https://api.nostr.watch/v2/#offers',
		label: 'REST API',
		parse(json) {
			const p = json?.info?.['x-pricing'];
			if (!p || !Array.isArray(p.endpoints))
				throw new Error('openapi.json has no info.x-pricing.endpoints');
			return {
				methods: Array.isArray(p.methods) ? p.methods : [],
				items: p.endpoints.map((e) => ({
					name: String(e.path),
					sats: Number(e.amount),
					unit: String(e.unit ?? p.currency ?? 'sats'),
					description: String(e.description ?? '')
				}))
			};
		}
	},
	cvm: {
		url: process.env.AGENT_PRICING_CVM_URL ?? 'https://cvm.nostr.watch/config.json',
		docs: 'https://cvm.nostr.watch',
		offersId: 'https://cvm.nostr.watch/#offers',
		label: 'CVM (MCP over Nostr)',
		parse(json) {
			if (!Array.isArray(json?.endpoints)) throw new Error('config.json has no endpoints[]');
			return {
				methods: [],
				items: json.endpoints.map((e) => ({
					name: String(e.name),
					sats: Number(e.amount),
					unit: String(e.currencyUnit ?? 'sats'),
					description: String(e.description ?? '')
				}))
			};
		}
	}
};

const log = (...a) => console.log('[agent-pricing]', ...a);
const warn = (...a) => console.warn('[agent-pricing] WARNING:', ...a);

function validate(key, data) {
	if (!data.items.length) throw new Error(`${key}: no priced endpoints`);
	for (const i of data.items) {
		if (!Number.isFinite(i.sats) || i.sats < 0) throw new Error(`${key}: bad amount for ${i.name}`);
		if (i.unit !== 'sats') throw new Error(`${key}: unsupported unit "${i.unit}" for ${i.name}`);
	}
	return data;
}

async function fetchSource(key) {
	const src = SOURCES[key];
	const res = await fetch(src.url, {
		signal: AbortSignal.timeout(15_000),
		headers: { accept: 'application/json' }
	});
	if (!res.ok) throw new Error(`${src.url} -> HTTP ${res.status}`);
	return validate(key, src.parse(await res.json()));
}

async function loadPricing() {
	let snapshot = {};
	try {
		snapshot = JSON.parse(await fs.readFile(SNAPSHOT, 'utf8'));
	} catch {
		/* no snapshot yet */
	}
	const out = {};
	const fresh = {};
	for (const key of Object.keys(SOURCES)) {
		try {
			out[key] = fresh[key] = await fetchSource(key);
			log(`${key}: ${out[key].items.length} prices from ${SOURCES[key].url}`);
		} catch (err) {
			if (STRICT || !snapshot[key]) throw new Error(`${key}: ${err.message} (no usable snapshot)`);
			warn(`${key}: ${err.message}; using snapshot from ${snapshot.fetchedAt ?? 'unknown date'}`);
			out[key] = validate(key, snapshot[key]);
		}
	}
	if (UPDATE_SNAPSHOT && Object.keys(fresh).length === Object.keys(SOURCES).length) {
		await fs.mkdir(path.dirname(SNAPSHOT), { recursive: true });
		await fs.writeFile(
			SNAPSHOT,
			JSON.stringify({ fetchedAt: new Date().toISOString(), ...fresh }, null, 2) + '\n'
		);
		log(`snapshot updated: ${path.relative(ROOT, SNAPSHOT)}`);
	}
	return out;
}

// 1 sat = 0.00000001 BTC; schema.org priceCurrency takes ISO 4217 or crypto tickers.
const satsToBtc = (sats) => (sats / 1e8).toFixed(8);
const range = (items) => {
	const amounts = items.map((i) => i.sats);
	return { low: Math.min(...amounts), high: Math.max(...amounts) };
};
const paid = (items) => items.filter((i) => i.sats > 0);
const satsText = (n) => `${n} ${n === 1 ? 'sat' : 'sats'}`;

function aggregateOffer(key, data) {
	const src = SOURCES[key];
	const { low, high } = range(data.items);
	const free = data.items.length - paid(data.items).length;
	const methods = data.methods.length ? ` Payment: ${data.methods.join(', ')}.` : '';
	return {
		'@type': 'AggregateOffer',
		'@id': src.offersId,
		url: src.docs,
		priceCurrency: 'BTC',
		lowPrice: satsToBtc(low),
		highPrice: satsToBtc(high),
		offerCount: data.items.length,
		description:
			`${src.label}: ${satsText(low)} to ${satsText(high)} per request` +
			`${free ? ` (${free} free)` : ''}.${methods} Price list: ${src.url}`,
		offers: data.items.map((i) => ({
			'@type': 'Offer',
			name: i.name,
			description: `${i.description} (${satsText(i.sats)})`.trim(),
			price: satsToBtc(i.sats),
			priceCurrency: 'BTC'
		}))
	};
}

function summarySentence(pricing) {
	const parts = Object.entries(pricing).map(([key, data]) => {
		const { low, high } = range(paid(data.items).length ? paid(data.items) : data.items);
		const free = data.items.length - paid(data.items).length;
		return (
			`the ${SOURCES[key].label} costs ${satsText(low)} to ${satsText(high)} per request` +
			(free ? ` (${free} ${free === 1 ? 'endpoint is' : 'endpoints are'} free)` : '')
		);
	});
	return `The website and the raw NIP-66 events are free; ${parts.join(' and ')}.`;
}

function markdownBlock(pricing) {
	const lines = [summarySentence(pricing), ''];
	for (const [key, data] of Object.entries(pricing)) {
		const src = SOURCES[key];
		const methods = data.methods.length ? ` Payment methods: ${data.methods.join(', ')}.` : '';
		lines.push(`### ${src.label}`, '', `Docs: ${src.docs}. Source: ${src.url}.${methods}`, '');
		lines.push('| Endpoint | Price | Description |', '| --- | --- | --- |');
		for (const i of data.items)
			lines.push(
				`| \`${i.name}\` | ${i.sats === 0 ? 'free' : satsText(i.sats)} | ${i.description} |`
			);
		lines.push('');
	}
	return lines.join('\n').trimEnd();
}

const BLOCK_RE = /(<!-- agent-pricing:start -->)[\s\S]*?(<!-- agent-pricing:end -->)/;

async function patchMarkdown(file, pricing) {
	const p = path.join(DIST, file);
	const text = await fs.readFile(p, 'utf8');
	if (!BLOCK_RE.test(text)) throw new Error(`${file}: agent-pricing markers not found`);
	await fs.writeFile(p, text.replace(BLOCK_RE, `$1\n\n${markdownBlock(pricing)}\n\n$2`));
}

const LDJSON_RE = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
const SUMMARY_RE = /(<p data-agent-pricing="summary">)[\s\S]*?(<\/p>)/;
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function patchJsonLd(json, pricing) {
	const graph = json['@graph'];
	if (!Array.isArray(graph)) throw new Error('JSON-LD has no @graph');
	for (const [key, data] of Object.entries(pricing)) {
		const node = graph.find((n) => n?.offers?.['@id'] === SOURCES[key].offersId);
		if (!node) throw new Error(`JSON-LD node with offers @id ${SOURCES[key].offersId} not found`);
		node.offers = aggregateOffer(key, data);
	}
	return json;
}

async function* htmlFiles(dir) {
	for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
		const p = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name !== '_app') yield* htmlFiles(p);
		} else if (entry.name.endsWith('.html')) yield p;
	}
}

async function patchHtml(pricing) {
	let count = 0;
	for await (const file of htmlFiles(DIST)) {
		let html = await fs.readFile(file, 'utf8');
		const m = html.match(LDJSON_RE);
		if (!m) continue;
		const json = patchJsonLd(JSON.parse(m[2]), pricing);
		// Escape "<" so the JSON can never close the <script> element.
		const serialized = JSON.stringify(json, null, '\t').replace(/</g, '\\u003c');
		html = html.replace(LDJSON_RE, () => `${m[1]}\n${serialized}\n${m[3]}`);
		html = html.replace(
			SUMMARY_RE,
			(_, open, close) => `${open}${escapeHtml(summarySentence(pricing))}${close}`
		);
		await fs.writeFile(file, html);
		count++;
	}
	if (!count) throw new Error('no dist/*.html with JSON-LD found');
	return count;
}

const pricing = await loadPricing();
const hasDist = await fs.stat(DIST).then(
	(s) => s.isDirectory(),
	() => false
);
if (UPDATE_SNAPSHOT && !hasDist) process.exit(0);
const pages = await patchHtml(pricing);
await patchMarkdown('llms.txt', pricing);
await patchMarkdown('index.md', pricing);
log(`updated JSON-LD in ${pages} HTML file(s), llms.txt and index.md`);
