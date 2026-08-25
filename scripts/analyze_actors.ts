/**
 * Split monolithic actor chunks in us/blocks.json into individual actor entries.
 *
 * Usage:
 *   npm run extract
 *   node --experimental-strip-types scripts/analyze_actors.ts
 *   npm run extract
 *   npm run rebuild
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BLOCKS_PATH = join(ROOT, 'us', 'blocks.json');
const EXTRACTED = join(ROOT, 'extracted', 'system');

const CHUNKS = [
  'chunk_058000',
  'chunk_068000',
  'chunk_078000',
  'chunk_088000',
  'chunk_098000',
  'chunk_0A8000',
  'chunk_0B8000',
  'chunk_0C8000',
] as const;

interface BlockPart {
  start: number;
  end: number;
  type: string;
  movable?: boolean;
  scene?: string;
  base?: number;
  postProcess?: string;
  parts?: Record<string, BlockPart>;
}

type BlockEntry = BlockPart | { movable?: boolean; scene?: string; parts: Record<string, BlockPart>; postProcess?: string };
type BlocksJson = Record<string, Record<string, BlockEntry>>;

interface ActorDef {
  label: string;
  addr: number;
  /** Line range of the actor definition body in the ASM (for short-ref scanning). */
  body: string;
}

const ACTOR_DEF_RE = /^actor_([0-9A-F]{6})\s*\[/gm;
const LABEL_ADDR_RE = /_([0-9A-F]{6})$/;
/** Short refs only — ignore @ long refs. */
const SHORT_REF_RE = /(?<!@)(?:\$&|#\$&|&)([A-Za-z_][\w]*)/g;

function parseHexAddr(label: string): number {
  const m = LABEL_ADDR_RE.exec(label);
  if (!m) throw new Error(`No hex addr in ${label}`);
  return parseInt(m[1], 16);
}

function findActors(asm: string): ActorDef[] {
  const actors: ActorDef[] = [];
  const lines = asm.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const m = /^actor_([0-9A-F]{6})\s*\[/.exec(lines[i]);
    if (!m) continue;

    const label = `actor_${m[1]}`;
    let depth = 0;
    let end = i;
    for (let j = i; j < lines.length; j++) {
      depth += (lines[j].match(/\[/g) ?? []).length;
      depth -= (lines[j].match(/\]/g) ?? []).length;
      if (depth <= 0 && j > i) {
        end = j;
        break;
      }
    }

    // Include following code/string sections until the next actor_ definition
    // only for short-ref scanning — range end is determined by address.
    let scanEnd = end;
    for (let j = end + 1; j < lines.length; j++) {
      if (/^actor_[0-9A-F]{6}\s*\[/.test(lines[j])) break;
      scanEnd = j;
    }

    actors.push({
      label,
      addr: parseInt(m[1], 16),
      body: lines.slice(i, scanEnd + 1).join('\n'),
    });
  }

  return actors.sort((a, b) => a.addr - b.addr);
}

/** Relative branch mnemonics (PC-relative — target must be in the same assembly unit). */
const REL_BRANCH_RE =
  /^\s+(?:BRA|BEQ|BNE|BCC|BCS|BPL|BMI|BVC|BVS|BRL)\s+([A-Za-z_][\w]*)/gm;

function findRelativeBranchTargets(text: string): string[] {
  const out: string[] = [];
  REL_BRANCH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REL_BRANCH_RE.exec(text)) !== null) {
    out.push(m[1]);
  }
  return out;
}

class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let p = this.parent.get(x)!;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function shortRefs(text: string): string[] {
  const out: string[] = [];
  SHORT_REF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SHORT_REF_RE.exec(text)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function refAddr(name: string): number | null {
  const m = LABEL_ADDR_RE.exec(name);
  return m ? parseInt(m[1], 16) : null;
}

/** Collect every leaf range currently declared in blocks.json. */
function collectRanges(blocks: BlocksJson): { start: number; end: number; path: string }[] {
  const ranges: { start: number; end: number; path: string }[] = [];

  function walk(entry: BlockEntry, path: string) {
    if ('parts' in entry && entry.parts) {
      for (const [k, v] of Object.entries(entry.parts)) {
        walk(v, `${path}/${k}`);
      }
      return;
    }
    if ('start' in entry && 'end' in entry) {
      ranges.push({ start: entry.start, end: entry.end, path });
    }
  }

  for (const [group, items] of Object.entries(blocks)) {
    for (const [name, entry] of Object.entries(items)) {
      walk(entry, `${group}/${name}`);
    }
  }
  return ranges;
}

interface ActorEntry {
  label: string;
  start: number;
  end: number;
  movable: boolean;
  /** When set, multiple sequential actors must share one file (relative branches). */
  parts?: { name: string; start: number; end: number; type: string }[];
}

interface ChunkPlan {
  chunk: string;
  actors: ActorEntry[];
  chunkParts: Record<string, { start: number; end: number; type: string }> | null;
}

function analyzeChunk(chunk: string, blocks: BlocksJson): ChunkPlan {
  const path = join(EXTRACTED, `${chunk}.asm`);
  if (!existsSync(path)) throw new Error(`Missing ${path} — run npm run extract first`);

  const asm = readFileSync(path, 'utf8');
  const actors = findActors(asm);
  if (actors.length === 0) {
    console.warn(`${chunk}: no actors found`);
    return { chunk, actors: [], chunkParts: null };
  }

  const system = blocks.system;
  const chunkEntry = system[chunk];
  if (!chunkEntry || !('parts' in chunkEntry) || !chunkEntry.parts) {
    throw new Error(`Expected ${chunk} to have parts in blocks.json`);
  }

  const existingParts = { ...chunkEntry.parts };

  // Address coverage of this chunk from existing parts.
  const partEntries = Object.entries(existingParts).map(([name, p]) => ({
    name,
    start: p.start,
    end: p.end,
    type: p.type,
  }));
  const chunkStart = Math.min(...partEntries.map((p) => p.start));
  const chunkEnd = Math.max(...partEntries.map((p) => p.end));

  // Only actors whose definitions live in this chunk's ASM and fall in chunk coverage.
  // (Filter out INCLUDE-only mentions — findActors already only matches definitions.)
  const localActors = actors.filter((a) => a.addr >= chunkStart && a.addr < chunkEnd);

  const allReserved = partEntries
    .filter((p) => p.type !== 'actor' && !p.name.startsWith('actor_'))
    .map((p) => ({ start: p.start, end: p.end, name: p.name, type: p.type }))
    .sort((a, b) => a.start - b.start);

  // Solid = no actor defs inside (code_lists, trailing data). These clip actor ranges.
  // Porous = contains actor defs (mis-typed blobs). Actors tile through; leftovers kept.
  const solid = allReserved.filter(
    (r) => !localActors.some((a) => a.addr >= r.start && a.addr < r.end),
  );
  const porous = allReserved.filter(
    (r) => localActors.some((a) => a.addr >= r.start && a.addr < r.end),
  );

  const planned: { label: string; start: number; end: number; movable: boolean; body: string }[] = [];

  for (let i = 0; i < localActors.length; i++) {
    const a = localActors[i];
    const nextActor = i + 1 < localActors.length ? localActors[i + 1].addr : chunkEnd;

    let end = nextActor;
    for (const r of solid) {
      if (r.start > a.addr && r.start < end) {
        end = r.start;
        break;
      }
    }
    // Don't let actors that start before a porous (mis-typed) region absorb its
    // leading typed data — e.g. string_06B69D must stay typed as String.
    for (const r of porous) {
      if (r.start > a.addr && r.start < end) {
        end = r.start;
        break;
      }
    }

    planned.push({ label: a.label, start: a.addr, end, movable: true, body: a.body });
  }

  // Movable: false if any short ref targets an address outside [start, end)
  // but still within this bank/chunk coverage (same-bank short dependency).
  for (const a of planned) {
    for (const ref of shortRefs(a.body)) {
      const addr = refAddr(ref);
      if (addr === null) continue;
      if ((addr < a.start || addr >= a.end) && addr >= chunkStart && addr < chunkEnd) {
        a.movable = false;
        break;
      }
    }
  }

  // Hosts of shared short targets also stay non-movable.
  const hostShared = new Set<string>();
  for (const a of planned) {
    for (const ref of shortRefs(a.body)) {
      const addr = refAddr(ref);
      if (addr === null) continue;
      if (addr >= a.start && addr < a.end) continue;
      const host = planned.find((p) => addr >= p.start && addr < p.end);
      if (host) {
        a.movable = false;
        hostShared.add(host.label);
      }
    }
  }
  for (const label of hostShared) {
    const host = planned.find((p) => p.label === label);
    if (host) host.movable = false;
  }

  // Chunk leftovers: solid regions unchanged + porous regions minus actor spans.
  const actorSpans = planned.map((a) => ({ start: a.start, end: a.end }));
  const newParts: Record<string, { start: number; end: number; type: string }> = {};

  for (const r of solid) {
    newParts[r.name] = { start: r.start, end: r.end, type: r.type };
  }

  for (const r of porous) {
    const pieces: { start: number; end: number }[] = [{ start: r.start, end: r.end }];
    for (const span of actorSpans) {
      const next: { start: number; end: number }[] = [];
      for (const piece of pieces) {
        if (span.end <= piece.start || span.start >= piece.end) {
          next.push(piece);
          continue;
        }
        if (span.start > piece.start) next.push({ start: piece.start, end: span.start });
        if (span.end < piece.end) next.push({ start: span.end, end: piece.end });
      }
      pieces.length = 0;
      pieces.push(...next);
    }
    for (const piece of pieces) {
      if (piece.end <= piece.start) continue;
      const key =
        piece.start === r.start && piece.end === r.end
          ? r.name
          : labelForRemainder(r.type, piece.start);
      newParts[key] = { start: piece.start, end: piece.end, type: r.type };
    }
  }

  // Merge actors linked by PC-relative branches (must share one assembly unit).
  const uf = new UnionFind();
  for (const a of planned) uf.find(a.label);

  const ownerAt = (addr: number) =>
    planned.find((p) => addr >= p.start && addr < p.end);

  for (const a of planned) {
    for (const target of findRelativeBranchTargets(a.body)) {
      const addr = refAddr(target);
      if (addr === null) continue;
      const host = ownerAt(addr);
      if (host && host.label !== a.label) {
        uf.union(a.label, host.label);
      }
    }
  }

  const groups = new Map<string, typeof planned>();
  for (const a of planned) {
    const root = uf.find(a.label);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(a);
  }

  const entries: ActorEntry[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.start - b.start);
    const movable = group.every((a) => a.movable);
    if (group.length === 1) {
      const a = group[0];
      entries.push({ label: a.label, start: a.start, end: a.end, movable: a.movable });
    } else {
      entries.push({
        label: group[0].label,
        start: group[0].start,
        end: group[group.length - 1].end,
        movable,
        parts: group.map((a) => ({
          name: a.label,
          start: a.start,
          end: a.end,
          type: 'actor',
        })),
      });
    }
  }
  entries.sort((a, b) => a.start - b.start);

  return {
    chunk,
    actors: entries,
    chunkParts: Object.keys(newParts).length > 0 ? newParts : null,
  };
}

function labelForRemainder(type: string, start: number): string {
  const hex = start.toString(16).toUpperCase().padStart(6, '0');
  const prefix = type.replace(/^&/, '');
  if (type.startsWith('&')) return `${prefix.toLowerCase()}_list_${hex}`;
  if (prefix === 'String') return `string_${hex}`;
  if (prefix === 'Code') return `code_${hex}`;
  if (prefix === 'Byte') return `byte_${hex}`;
  if (prefix === 'Word') return `word_${hex}`;
  return `${prefix.toLowerCase()}_${hex}`;
}

/** Format a simple single-line block entry matching existing style. */
function formatActorLine(label: string, start: number, end: number, movable: boolean): string {
  return `        "${label}": { "start": ${start}, "end": ${end}, "type": "actor", "movable": ${movable} }`;
}

function formatPartLine(name: string, start: number, end: number, type: string, indent = '                '): string {
  return `${indent}"${name}": { "start": ${start}, "end": ${end}, "type": "${type}" }`;
}

function applyPlans(blocks: BlocksJson, plans: ChunkPlan[]): void {
  const system = blocks.system;

  for (const plan of plans) {
    // Remove old chunk actor blobs / update chunk parts
    if (plan.chunkParts === null) {
      delete system[plan.chunk];
    } else {
      system[plan.chunk] = { parts: plan.chunkParts };
    }

    for (const a of plan.actors) {
      // Don't overwrite actors already placed in other groups (rococo, etc.)
      let existsElsewhere = false;
      for (const [group, items] of Object.entries(blocks)) {
        if (group === 'system') continue;
        if (a.label in items) {
          existsElsewhere = true;
          break;
        }
      }
      if (existsElsewhere) {
        console.warn(`Skipping ${a.label} — already in another group`);
        continue;
      }

      if (a.parts && a.parts.length > 1) {
        const parts: Record<string, BlockPart> = {};
        for (const p of a.parts) {
          parts[p.name] = { start: p.start, end: p.end, type: p.type };
        }
        system[a.label] = { movable: a.movable, parts };
      } else {
        system[a.label] = {
          start: a.start,
          end: a.end,
          type: 'actor',
          movable: a.movable,
        };
      }
    }
  }
}

/**
 * Rewrite blocks.json preserving the existing pretty-print style for unchanged
 * groups, while rewriting the system group with compact actor lines.
 */
function writeBlocks(blocks: BlocksJson, plans: ChunkPlan[]): void {
  // Build the full JSON with a custom formatter for compactness on leaf objects.
  const text = stringifyBlocks(blocks);
  writeFileSync(BLOCKS_PATH, text + '\n', 'utf8');
}

function isLeafPart(v: unknown): v is { start: number; end: number; type: string; movable?: boolean; scene?: string; base?: number } {
  return (
    typeof v === 'object' &&
    v !== null &&
    'start' in v &&
    'end' in v &&
    'type' in v &&
    !('parts' in v)
  );
}

function stringifyLeaf(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj);
  const parts = keys.map((k) => {
    const val = obj[k];
    if (typeof val === 'string') return `"${k}": "${val}"`;
    if (typeof val === 'boolean' || typeof val === 'number') return `"${k}": ${val}`;
    return `"${k}": ${JSON.stringify(val)}`;
  });
  return `{ ${parts.join(', ')} }`;
}

function stringifyBlocks(blocks: BlocksJson): string {
  const groupLines: string[] = [];

  for (const [group, items] of Object.entries(blocks)) {
    const itemLines: string[] = [];
    const names = Object.keys(items);

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const entry = items[name];
      const comma = i < names.length - 1 ? ',' : '';

      if (isLeafPart(entry)) {
        itemLines.push(`        "${name}": ${stringifyLeaf(entry as unknown as Record<string, unknown>)}${comma}`);
        continue;
      }

      if ('parts' in entry && entry.parts) {
        const partNames = Object.keys(entry.parts);
        const headLines: string[] = [];
        if ('movable' in entry && entry.movable !== undefined) headLines.push(`            "movable": ${entry.movable}`);
        if ('scene' in entry && (entry as { scene?: string }).scene)
          headLines.push(`            "scene": "${(entry as { scene?: string }).scene}"`);
        if ('postProcess' in entry && (entry as { postProcess?: string }).postProcess)
          headLines.push(`            "postProcess": "${(entry as { postProcess?: string }).postProcess}"`);

        const partLines = partNames.map((pn, pi) => {
          const p = entry.parts![pn];
          const c = pi < partNames.length - 1 ? ',' : '';
          if (isLeafPart(p)) {
            return `                "${pn}": ${stringifyLeaf(p as unknown as Record<string, unknown>)}${c}`;
          }
          return `                "${pn}": ${JSON.stringify(p)}${c}`;
        });

        const head = headLines.length ? `${headLines.join(',\n')},\n` : '';
        itemLines.push(
          `        "${name}": {\n${head}            "parts": {\n${partLines.join('\n')}\n            }\n        }${comma}`,
        );
        continue;
      }

      itemLines.push(`        "${name}": ${JSON.stringify(entry, null, 4).replace(/\n/g, '\n        ')}${comma}`);
    }

    groupLines.push(`    "${group}": {\n${itemLines.join('\n')}\n    }`);
  }

  return `{\n${groupLines.join(',\n')}\n}`;
}

function validateNoOverlaps(blocks: BlocksJson): void {
  const ranges = collectRanges(blocks).sort((a, b) => a.start - b.start || a.end - b.end);
  let overlaps = 0;
  for (let i = 0; i < ranges.length - 1; i++) {
    const a = ranges[i];
    const b = ranges[i + 1];
    if (a.end > b.start) {
      console.error(`OVERLAP: ${a.path} [${a.start},${a.end}) vs ${b.path} [${b.start},${b.end})`);
      overlaps++;
    }
  }
  if (overlaps > 0) throw new Error(`${overlaps} overlapping ranges`);
  console.log(`Validated ${ranges.length} ranges — no overlaps`);
}

function main() {
  const apply = process.argv.includes('--apply');
  const blocks = JSON.parse(readFileSync(BLOCKS_PATH, 'utf8')) as BlocksJson;

  const plans: ChunkPlan[] = [];
  for (const chunk of CHUNKS) {
    const plan = analyzeChunk(chunk, blocks);
    plans.push(plan);
    const movable = plan.actors.filter((a) => a.movable).length;
    const merged = plan.actors.filter((a) => a.parts && a.parts.length > 1).length;
    console.log(
      `${chunk}: ${plan.actors.length} entries (${movable} movable, ${merged} merged parts), ` +
        `chunk parts remaining: ${plan.chunkParts ? Object.keys(plan.chunkParts).length : 0}`,
    );
  }

  // Write analysis summary
  const summary = Object.fromEntries(
    plans.map((p) => [
      p.chunk,
      {
        actors: p.actors,
        chunkParts: p.chunkParts,
      },
    ]),
  );
  writeFileSync(join(__dirname, 'actor_analysis.json'), JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log('\nDry run only. Pass --apply to update us/blocks.json');
    return;
  }

  applyPlans(blocks, plans);
  validateNoOverlaps(blocks);
  writeBlocks(blocks, plans);
  console.log(`Updated ${BLOCKS_PATH}`);
}

main();
