/**
 * Organize us/files.json assets into groups/scenes based on references in
 * extracted/system/map_meta.asm and scene/group definitions in us/groups.json.
 *
 * Placement rules:
 *   - One scene only             → that scene's group, scene: <name>
 *   - Multiple scenes, one group → that group, scene: ""
 *   - Multiple groups            → system group, scene: ""
 *   - Not referenced             → left in its current group/scene
 *
 * A scene loads assets from its own mapMeta block (commands after `state`)
 * plus, when state marker ≠ 0, assets reachable from that global marker
 * (following `jump` / `branch`).
 *
 * Usage:
 *   npm run extract
 *   node --experimental-strip-types scripts/organize_files.ts
 *   node --experimental-strip-types scripts/organize_files.ts --apply
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FILES_PATH = join(ROOT, 'us', 'files.json');
const GROUPS_PATH = join(ROOT, 'us', 'groups.json');
const MAP_META_PATH = join(ROOT, 'extracted', 'system', 'map_meta.asm');

interface FileEntry {
  start: number;
  end: number;
  type: string;
  compressed?: boolean;
  [key: string]: unknown;
}

/** group → scene → name → entry */
type FilesJson = Record<string, Record<string, Record<string, FileEntry>>>;

interface GroupsJson {
  [group: string]: {
    scenes?: Record<string, { id: number }>;
  };
}

interface SceneLoc {
  group: string;
  scene: string;
}

interface FileRecord {
  name: string;
  group: string;
  scene: string;
  entry: FileEntry;
}

interface Placement {
  group: string;
  scene: string;
  reason: string;
}

type Op =
  | { kind: 'state'; marker: number }
  | { kind: 'jump'; marker: number }
  | { kind: 'branch'; marker: number }
  | { kind: 'marker'; id: number }
  | { kind: 'asset'; name: string }
  | { kind: 'other' };

interface MetaBlock {
  label: string;
  /** Inclusive start index into the global ops array. */
  start: number;
  /** Exclusive end index into the global ops array. */
  end: number;
  stateMarker: number;
}

function collectFileRecords(files: FilesJson): FileRecord[] {
  const records: FileRecord[] = [];
  for (const [group, scenes] of Object.entries(files)) {
    for (const [scene, items] of Object.entries(scenes)) {
      for (const [name, entry] of Object.entries(items)) {
        records.push({ name, group, scene, entry });
      }
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

function parseHex(s: string): number {
  return parseInt(s, 16);
}

/**
 * Parse map_meta.asm into:
 *   - sceneId → mapMeta label (from mapMeta_list)
 *   - per-scene asset sets (resolved via state/jump/branch)
 */
function parseAssetScenes(asm: string): Map<string, Set<number>> {
  const tableMatch = asm.match(/mapMeta_list\s*\[([\s\S]*?)\n\]/);
  if (!tableMatch) throw new Error('Could not find mapMeta_list table');

  const sceneToLabel = new Map<number, string>();
  for (const raw of tableMatch[1].split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m = /^&(mapMeta_[0-9A-Fa-f]+)\s*;([0-9A-Fa-f]+)/.exec(line);
    if (m) {
      sceneToLabel.set(parseHex(m[2]), m[1]);
      continue;
    }
    // #$0000 placeholders — no meta for that scene id
  }

  const ops: Op[] = [];
  const blocks = new Map<string, MetaBlock>();
  const markerIndex = new Map<number, number>();

  const blockRe = /^(mapMeta_[0-9A-Fa-f]+)\s*\[([\s\S]*?)\]/gm;
  let bm: RegExpExecArray | null;
  while ((bm = blockRe.exec(asm)) !== null) {
    const label = bm[1];
    const start = ops.length;
    let stateMarker = 0;
    let sawState = false;

    for (const raw of bm[2].split(/\n/)) {
      const line = raw.trim();
      if (!line) continue;

      let m = /^marker_([0-9A-Fa-f]+)\s*:/.exec(line);
      if (m) {
        const id = parseHex(m[1]);
        markerIndex.set(id, ops.length);
        ops.push({ kind: 'marker', id });
        continue;
      }

      m = /^state\s*<\s*#([0-9A-Fa-f]+)\s*,\s*#([0-9A-Fa-f]+)\s*>/.exec(line);
      if (m) {
        stateMarker = parseHex(m[1]);
        ops.push({ kind: 'state', marker: stateMarker });
        sawState = true;
        continue;
      }

      m = /^jump\s*<\s*#([0-9A-Fa-f]+)\s*>/.exec(line);
      if (m) {
        ops.push({ kind: 'jump', marker: parseHex(m[1]) });
        continue;
      }

      m = /^branch\s*<\s*#([0-9A-Fa-f]+)\s*,\s*#([0-9A-Fa-f]+)\s*>/.exec(line);
      if (m) {
        ops.push({ kind: 'branch', marker: parseHex(m[2]) });
        continue;
      }

      const assets = [...line.matchAll(/!([A-Za-z_][A-Za-z0-9_]*)/g)].map((x) => x[1]);
      if (assets.length) {
        for (const name of assets) ops.push({ kind: 'asset', name });
        continue;
      }

      ops.push({ kind: 'other' });
    }

    if (!sawState) stateMarker = 0;
    blocks.set(label, { label, start, end: ops.length, stateMarker });
  }

  function enclosingBlockEnd(from: number): number {
    for (const block of blocks.values()) {
      if (from >= block.start && from < block.end) return block.end;
    }
    return ops.length;
  }

  /** Walk from an index until the enclosing mapMeta block ends. */
  function walkInBlock(from: number, into: Set<string>) {
    walkBlockFrom(from, into, new Set());
  }

  function walkBlockFrom(from: number, into: Set<string>, visiting: Set<number>) {
    const blockEnd = enclosingBlockEnd(from);
    let i = from;
    while (i < blockEnd) {
      if (visiting.has(i)) return;
      visiting.add(i);
      const op = ops[i];

      if (op.kind === 'asset') {
        into.add(op.name);
        i++;
        continue;
      }

      if (op.kind === 'jump') {
        const target = markerIndex.get(op.marker);
        if (target !== undefined) walkBlockFrom(target, into, visiting);
        return;
      }

      if (op.kind === 'branch') {
        const target = markerIndex.get(op.marker);
        // Union of fall-through and taken branch.
        walkBlockFrom(i + 1, into, new Set(visiting));
        if (target !== undefined) walkBlockFrom(target, into, new Set(visiting));
        return;
      }

      i++;
    }
  }

  const assetScenes = new Map<string, Set<number>>();

  for (const [sceneId, label] of sceneToLabel) {
    const block = blocks.get(label);
    if (!block) continue;

    const assets = new Set<string>();

    // Local commands after the leading state (or from block start if none).
    let localFrom = block.start;
    if (
      block.start < block.end &&
      ops[block.start]?.kind === 'state'
    ) {
      localFrom = block.start + 1;
    }
    if (localFrom < block.end) walkInBlock(localFrom, assets);

    // Shared marker referenced by state (include / base load).
    if (block.stateMarker !== 0) {
      const target = markerIndex.get(block.stateMarker);
      if (target !== undefined) walkInBlock(target, assets);
    }

    for (const name of assets) {
      let set = assetScenes.get(name);
      if (!set) {
        set = new Set();
        assetScenes.set(name, set);
      }
      set.add(sceneId);
    }
  }

  return assetScenes;
}

function classifyFile(
  record: FileRecord,
  assetScenes: Map<string, Set<number>>,
  sceneIdMap: Map<number, SceneLoc>,
): Placement {
  const sceneIds = assetScenes.get(record.name);

  if (!sceneIds || sceneIds.size === 0) {
    return {
      group: record.group,
      scene: record.scene,
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
      scene: '',
      reason: `only unknown scene ids: ${unknownIds.join(',')}`,
    };
  }

  const groups = [...new Set(locs.map((l) => l.group))];
  const scenes = [...new Set(locs.map((l) => l.scene))];

  if (groups.length > 1) {
    return {
      group: 'system',
      scene: '',
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
    scene: '',
    reason: `multi-scene in ${group}: ${scenes.join(',')}`,
  };
}

function applyOrganization(
  records: FileRecord[],
  placements: Map<string, Placement>,
  groupOrder: string[],
): FilesJson {
  const next: FilesJson = {};

  for (const record of records) {
    const placement = placements.get(record.name)!;
    if (!next[placement.group]) next[placement.group] = {};
    if (!next[placement.group][placement.scene]) next[placement.group][placement.scene] = {};
    next[placement.group][placement.scene][record.name] = record.entry;
  }

  // Rebuild with stable ordering: system first, then groups.json order,
  // then any remaining groups. Within a group, "" scene first, then alpha.
  // Within a scene, sort by start address.
  const ordered: FilesJson = {};
  const seen = new Set<string>();

  const take = (group: string) => {
    if (!next[group] || seen.has(group)) return;
    const scenes = Object.keys(next[group]).sort((a, b) => {
      if (a === '') return -1;
      if (b === '') return 1;
      return a.localeCompare(b);
    });
    ordered[group] = {};
    for (const scene of scenes) {
      const items = next[group][scene];
      const names = Object.keys(items).sort((a, b) => {
        const sa = items[a].start;
        const sb = items[b].start;
        if (sa !== sb) return sa - sb;
        return a.localeCompare(b);
      });
      ordered[group][scene] = {};
      for (const name of names) ordered[group][scene][name] = items[name];
    }
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

function stringifyFiles(files: FilesJson): string {
  const groupLines: string[] = [];

  for (const [group, scenes] of Object.entries(files)) {
    const sceneLines: string[] = [];
    const sceneNames = Object.keys(scenes);

    for (let si = 0; si < sceneNames.length; si++) {
      const scene = sceneNames[si];
      const items = scenes[scene];
      const names = Object.keys(items);
      const itemLines = names.map((name, i) => {
        const comma = i < names.length - 1 ? ',' : '';
        return `            "${name}": ${stringifyLeaf(items[name] as unknown as Record<string, unknown>)}${comma}`;
      });
      const sceneComma = si < sceneNames.length - 1 ? ',' : '';
      sceneLines.push(
        `        "${scene}": {\n${itemLines.join('\n')}\n        }${sceneComma}`,
      );
    }

    groupLines.push(`    "${group}": {\n${sceneLines.join('\n')}\n    }`);
  }

  return `{\n${groupLines.join(',\n')}\n}`;
}

function main() {
  const apply = process.argv.includes('--apply');

  if (!existsSync(MAP_META_PATH)) {
    throw new Error(`Missing ${MAP_META_PATH} — run npm run extract first`);
  }

  const files = JSON.parse(readFileSync(FILES_PATH, 'utf8')) as FilesJson;
  const groups = JSON.parse(readFileSync(GROUPS_PATH, 'utf8')) as GroupsJson;
  const asm = readFileSync(MAP_META_PATH, 'utf8');

  const sceneIdMap = buildSceneIdMap(groups);
  const assetScenes = parseAssetScenes(asm);
  const records = collectFileRecords(files);

  const placements = new Map<string, Placement>();
  const counts = {
    singleScene: 0,
    multiScene: 0,
    multiGroup: 0,
    unreferenced: 0,
    system: 0,
  };

  for (const record of records) {
    const placement = classifyFile(record, assetScenes, sceneIdMap);
    placements.set(record.name, placement);

    if (placement.reason.startsWith('unreferenced')) counts.unreferenced++;
    else if (placement.reason.startsWith('multi-group')) counts.multiGroup++;
    else if (placement.reason.startsWith('multi-scene')) counts.multiScene++;
    else if (placement.reason.startsWith('single scene')) counts.singleScene++;

    if (placement.group === 'system') counts.system++;
  }

  const byGroup = new Map<string, number>();
  for (const p of placements.values()) {
    byGroup.set(p.group, (byGroup.get(p.group) ?? 0) + 1);
  }

  console.log(`Files: ${records.length}`);
  console.log(`Referenced asset labels in map_meta: ${assetScenes.size}`);
  console.log(
    `  single-scene: ${counts.singleScene}, multi-scene: ${counts.multiScene}, ` +
      `multi-group→system: ${counts.multiGroup}, unreferenced: ${counts.unreferenced}`,
  );
  console.log('By group:');
  for (const [group, n] of [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${group}: ${n}`);
  }

  let shown = 0;
  let moves = 0;
  for (const record of records) {
    const p = placements.get(record.name)!;
    if (p.group === record.group && p.scene === record.scene) continue;
    moves++;
    if (shown < 25) {
      console.log(
        `  move ${record.name}: ${record.group}/${record.scene || '""'} → ` +
          `${p.group}/${p.scene || '""'} (${p.reason})`,
      );
      shown++;
    }
  }
  if (moves > shown) console.log(`  …and ${moves - shown} more moves`);

  const organized = applyOrganization(records, placements, Object.keys(groups));
  const text = stringifyFiles(organized);

  if (!apply) {
    console.log('\nDry run only. Pass --apply to update us/files.json');
    writeFileSync(join(__dirname, 'organize_files.preview.json'), text + '\n', 'utf8');
    console.log(`Wrote preview to scripts/organize_files.preview.json`);
    return;
  }

  writeFileSync(FILES_PATH, text + '\n', 'utf8');
  console.log(`Updated ${FILES_PATH}`);
}

main();
