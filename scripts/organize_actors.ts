/**
 * Organize standalone actor records in us/blocks.json into groups/scenes
 * based on references in extracted/system/script_meta_028000.asm and
 * scene/group definitions in us/groups.json.
 *
 * Placement rules:
 *   - One scene only          → that scene's group, with scene: <name>
 *   - Multiple scenes, one group → that group, no scene property
 *   - Multiple groups         → system group, no scene property
 *   - Not referenced          → left in its current group (manual placements)
 *
 * Usage:
 *   npm run extract
 *   node --experimental-strip-types scripts/organize_actors.ts
 *   node --experimental-strip-types scripts/organize_actors.ts --apply
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BLOCKS_PATH = join(ROOT, 'us', 'blocks.json');
const GROUPS_PATH = join(ROOT, 'us', 'groups.json');
const SCRIPT_META_PATH = join(ROOT, 'extracted', 'system', 'script_meta_028000.asm');

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

type BlockEntry =
  | BlockPart
  | {
      movable?: boolean;
      scene?: string;
      parts: Record<string, BlockPart>;
      postProcess?: string;
    };

type BlocksJson = Record<string, Record<string, BlockEntry>>;

interface GroupsJson {
  [group: string]: {
    scenes?: Record<string, { id: number }>;
  };
}

interface SceneLoc {
  group: string;
  scene: string;
}

interface ActorRecord {
  name: string;
  group: string;
  entry: BlockEntry;
  /** Labels used when looking up script_meta references. */
  labels: string[];
  start: number;
}

interface Placement {
  group: string;
  scene?: string;
  reason: string;
}

function isLeafPart(
  v: unknown,
): v is {
  start: number;
  end: number;
  type: string;
  movable?: boolean;
  scene?: string;
  base?: number;
} {
  return (
    typeof v === 'object' &&
    v !== null &&
    'start' in v &&
    'end' in v &&
    'type' in v &&
    !('parts' in v)
  );
}

function entryStart(entry: BlockEntry): number {
  if (isLeafPart(entry)) return entry.start;
  if ('parts' in entry && entry.parts) {
    return Math.min(...Object.values(entry.parts).map((p) => p.start));
  }
  return Number.MAX_SAFE_INTEGER;
}

/** True when this top-level entry is an actor (leaf or merged parts container). */
function isActorEntry(name: string, entry: BlockEntry): boolean {
  if (isLeafPart(entry)) return entry.type === 'actor';
  if ('parts' in entry && entry.parts && name.startsWith('actor_')) {
    return Object.values(entry.parts).some((p) => p.type === 'actor');
  }
  return false;
}

function actorLabels(name: string, entry: BlockEntry): string[] {
  if (isLeafPart(entry)) return name.startsWith('actor_') ? [name] : [];
  if ('parts' in entry && entry.parts) {
    const labels = new Set<string>();
    if (name.startsWith('actor_')) labels.add(name);
    for (const [partName, part] of Object.entries(entry.parts)) {
      if (part.type === 'actor' && partName.startsWith('actor_')) labels.add(partName);
    }
    return [...labels];
  }
  return [];
}

function collectActorRecords(blocks: BlocksJson): ActorRecord[] {
  const records: ActorRecord[] = [];
  for (const [group, items] of Object.entries(blocks)) {
    for (const [name, entry] of Object.entries(items)) {
      if (!isActorEntry(name, entry)) continue;
      records.push({
        name,
        group,
        entry,
        labels: actorLabels(name, entry),
        start: entryStart(entry),
      });
    }
  }
  return records;
}

function buildSceneIdMap(groups: GroupsJson): Map<number, SceneLoc> {
  const map = new Map<number, SceneLoc>();
  for (const [group, def] of Object.entries(groups)) {
    for (const [scene, info] of Object.entries(def.scenes ?? {})) {
      map.set(info.id, { group, scene });
    }
  }
  return map;
}

/**
 * Parse script_meta_028000.asm into actor label → set of scene IDs.
 * Scene IDs come from the pointer table comments (;0A, ;1C1, …).
 */
function parseActorScenes(asm: string): Map<string, Set<number>> {
  const tableMatch = asm.match(/script_meta_028000 \[([\s\S]*?)\n\]/);
  if (!tableMatch) throw new Error('Could not find script_meta_028000 table');

  const table: { id: number; label: string | null }[] = [];
  for (const raw of tableMatch[1].split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m = /^&(\w+)\s*;([0-9A-Fa-f]+)/.exec(line);
    if (m) {
      table.push({ id: parseInt(m[2], 16), label: m[1] });
      continue;
    }
    m = /^#\$0000\s*;([0-9A-Fa-f]+)/.exec(line);
    if (m) table.push({ id: parseInt(m[1], 16), label: null });
  }

  const blocks = new Map<string, string[]>();
  const blockRe = /^(unk1_[0-9A-Fa-f]+)\s*\[([\s\S]*?)\]/gm;
  let bm: RegExpExecArray | null;
  while ((bm = blockRe.exec(asm)) !== null) {
    const actors = [...bm[2].matchAll(/@actor_([0-9A-Fa-f]{6})/g)].map(
      (x) => `actor_${x[1].toUpperCase()}`,
    );
    blocks.set(bm[1], actors);
  }

  const actorScenes = new Map<string, Set<number>>();
  for (const { id, label } of table) {
    if (!label) continue;
    for (const actor of blocks.get(label) ?? []) {
      let set = actorScenes.get(actor);
      if (!set) {
        set = new Set();
        actorScenes.set(actor, set);
      }
      set.add(id);
    }
  }
  return actorScenes;
}

function classifyActor(
  record: ActorRecord,
  actorScenes: Map<string, Set<number>>,
  sceneIdMap: Map<number, SceneLoc>,
): Placement {
  const sceneIds = new Set<number>();
  for (const label of record.labels) {
    const ids = actorScenes.get(label);
    if (!ids) continue;
    for (const id of ids) sceneIds.add(id);
  }

  if (sceneIds.size === 0) {
    // No script_meta references — preserve existing manual placement.
    const existing = isLeafPart(record.entry) ? record.entry.scene : record.entry.scene;
    return {
      group: record.group,
      scene: existing,
      reason: 'unreferenced (kept)',
    };
  }

  const locs: SceneLoc[] = [];
  const unknownIds: number[] = [];
  for (const id of sceneIds) {
    const loc = sceneIdMap.get(id);
    if (loc) locs.push(loc);
    else unknownIds.push(id);
  }

  if (locs.length === 0) {
    return {
      group: 'system',
      scene: undefined,
      reason: `only unknown scene ids: ${unknownIds.join(',')}`,
    };
  }

  const groups = [...new Set(locs.map((l) => l.group))];
  const scenes = [...new Set(locs.map((l) => l.scene))];

  if (groups.length > 1) {
    return {
      group: 'system',
      scene: undefined,
      reason: `multi-group: ${groups.join(',')}`,
    };
  }

  const group = groups[0];
  if (scenes.length === 1) {
    return {
      group,
      scene: scenes[0],
      reason: `single scene ${scenes[0]}`,
    };
  }

  return {
    group,
    scene: undefined,
    reason: `multi-scene in ${group}: ${scenes.join(',')}`,
  };
}

function withPlacement(entry: BlockEntry, scene: string | undefined): BlockEntry {
  if (isLeafPart(entry)) {
    const next: BlockPart = {
      start: entry.start,
      end: entry.end,
      type: entry.type,
    };
    if (scene !== undefined) next.scene = scene;
    if (entry.movable !== undefined) next.movable = entry.movable;
    if (entry.base !== undefined) next.base = entry.base;
    if (entry.postProcess !== undefined) next.postProcess = entry.postProcess;
    return next;
  }

  // Merged actor parts container
  const next: {
    movable?: boolean;
    scene?: string;
    parts: Record<string, BlockPart>;
    postProcess?: string;
  } = {
    parts: entry.parts,
  };
  if (entry.movable !== undefined) next.movable = entry.movable;
  if (scene !== undefined) next.scene = scene;
  if (entry.postProcess !== undefined) next.postProcess = entry.postProcess;
  return next;
}

function applyOrganization(
  blocks: BlocksJson,
  records: ActorRecord[],
  placements: Map<string, Placement>,
  groupOrder: string[],
): BlocksJson {
  // Start from a shallow copy, strip all collected actors, keep everything else.
  const next: BlocksJson = {};
  for (const [group, items] of Object.entries(blocks)) {
    next[group] = {};
    for (const [name, entry] of Object.entries(items)) {
      if (isActorEntry(name, entry)) continue;
      next[group][name] = entry;
    }
  }

  for (const record of records) {
    const placement = placements.get(record.name)!;
    if (!next[placement.group]) next[placement.group] = {};
    next[placement.group][record.name] = withPlacement(record.entry, placement.scene);
  }

  // Drop empty non-system groups.
  for (const group of Object.keys(next)) {
    if (group === 'system') continue;
    if (Object.keys(next[group]).length === 0) delete next[group];
  }

  // Rebuild with stable group ordering: system first, then groups.json order,
  // then any remaining groups in their previous order.
  const ordered: BlocksJson = {};
  const seen = new Set<string>();

  const take = (group: string) => {
    if (!next[group] || seen.has(group)) return;
    // Within each group, keep non-actors in prior relative order among
    // themselves, and sort all entries by start address so actors interleave
    // with nearby code/data (e.g. credit_functions).
    const items = next[group];
    const names = Object.keys(items).sort((a, b) => {
      const sa = entryStart(items[a]);
      const sb = entryStart(items[b]);
      if (sa !== sb) return sa - sb;
      return a.localeCompare(b);
    });
    ordered[group] = {};
    for (const name of names) ordered[group][name] = items[name];
    seen.add(group);
  };

  take('system');
  for (const group of groupOrder) take(group);
  for (const group of Object.keys(next)) take(group);

  return ordered;
}

function stringifyLeaf(obj: Record<string, unknown>): string {
  const parts = Object.keys(obj).map((k) => {
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
        itemLines.push(
          `        "${name}": ${stringifyLeaf(entry as unknown as Record<string, unknown>)}${comma}`,
        );
        continue;
      }

      if ('parts' in entry && entry.parts) {
        const partNames = Object.keys(entry.parts);
        const headLines: string[] = [];
        if ('movable' in entry && entry.movable !== undefined) {
          headLines.push(`            "movable": ${entry.movable}`);
        }
        if ('scene' in entry && entry.scene) {
          headLines.push(`            "scene": "${entry.scene}"`);
        }
        if ('postProcess' in entry && entry.postProcess) {
          headLines.push(`            "postProcess": "${entry.postProcess}"`);
        }

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

      itemLines.push(
        `        "${name}": ${JSON.stringify(entry, null, 4).replace(/\n/g, '\n        ')}${comma}`,
      );
    }

    groupLines.push(`    "${group}": {\n${itemLines.join('\n')}\n    }`);
  }

  return `{\n${groupLines.join(',\n')}\n}`;
}

function main() {
  const apply = process.argv.includes('--apply');

  if (!existsSync(SCRIPT_META_PATH)) {
    throw new Error(`Missing ${SCRIPT_META_PATH} — run npm run extract first`);
  }

  const blocks = JSON.parse(readFileSync(BLOCKS_PATH, 'utf8')) as BlocksJson;
  const groups = JSON.parse(readFileSync(GROUPS_PATH, 'utf8')) as GroupsJson;
  const asm = readFileSync(SCRIPT_META_PATH, 'utf8');

  const sceneIdMap = buildSceneIdMap(groups);
  const actorScenes = parseActorScenes(asm);
  const records = collectActorRecords(blocks);

  const placements = new Map<string, Placement>();
  const counts = {
    singleScene: 0,
    multiScene: 0,
    multiGroup: 0,
    unreferenced: 0,
    system: 0,
  };

  for (const record of records) {
    const placement = classifyActor(record, actorScenes, sceneIdMap);
    placements.set(record.name, placement);

    if (placement.reason.startsWith('unreferenced')) counts.unreferenced++;
    else if (placement.reason.startsWith('multi-group')) counts.multiGroup++;
    else if (placement.reason.startsWith('multi-scene')) counts.multiScene++;
    else if (placement.reason.startsWith('single scene')) counts.singleScene++;

    if (placement.group === 'system') counts.system++;
  }

  // Summary by destination group
  const byGroup = new Map<string, number>();
  for (const p of placements.values()) {
    byGroup.set(p.group, (byGroup.get(p.group) ?? 0) + 1);
  }

  console.log(`Actors: ${records.length}`);
  console.log(
    `  single-scene: ${counts.singleScene}, multi-scene: ${counts.multiScene}, ` +
      `multi-group→system: ${counts.multiGroup}, unreferenced: ${counts.unreferenced}`,
  );
  console.log('By group:');
  for (const [group, n] of [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${group}: ${n}`);
  }

  // Show a few moves that change group or scene
  let shown = 0;
  for (const record of records) {
    const p = placements.get(record.name)!;
    const oldScene = isLeafPart(record.entry) ? record.entry.scene : record.entry.scene;
    if (p.group === record.group && p.scene === oldScene) continue;
    if (shown < 20) {
      console.log(
        `  move ${record.name}: ${record.group}${oldScene ? '/' + oldScene : ''} → ` +
          `${p.group}${p.scene ? '/' + p.scene : ''} (${p.reason})`,
      );
    }
    shown++;
  }
  if (shown > 20) console.log(`  …and ${shown - 20} more moves`);

  const organized = applyOrganization(blocks, records, placements, Object.keys(groups));
  const text = stringifyBlocks(organized);

  if (!apply) {
    console.log('\nDry run only. Pass --apply to update us/blocks.json');
    // Still write a preview beside the script for inspection
    writeFileSync(join(__dirname, 'organize_actors.preview.json'), text + '\n', 'utf8');
    console.log(`Wrote preview to scripts/organize_actors.preview.json`);
    return;
  }

  writeFileSync(BLOCKS_PATH, text + '\n', 'utf8');
  console.log(`Updated ${BLOCKS_PATH}`);
}

main();
