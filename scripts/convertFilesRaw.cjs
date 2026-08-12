const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, '..', 'jp', 'filesRaw.json');
const outPath = path.join(__dirname, '..', 'jp', 'files.json');

const raw = fs.readFileSync(rawPath, 'utf-8');

// Parse manually to preserve duplicate keys (JSON.parse silently drops them)
const entries = new Map();
const lineRegex = /^\s*"([0-9A-Fa-f]+)"\s*:\s*"(\w+)"/gm;
let match;
while ((match = lineRegex.exec(raw)) !== null) {
  const hex = match[1].toUpperCase();
  const type = match[2];
  const key = `${hex}_${type}`;
  if (!entries.has(key)) {
    entries.set(key, { hex, type });
  }
}

// Sort by integer value of the hex location
const sorted = [...entries.values()].sort(
  (a, b) => parseInt(a.hex, 16) - parseInt(b.hex, 16)
);

// Build output with each entry on a single line, "end" = next entry's "start"
const lines = sorted.map(({ hex, type }, i) => {
  if(type === "Code" || type === "Null") return null;
  const id = `${type.toLowerCase()}_${hex}`;
  const start = parseInt(hex, 16);
  const end = i < sorted.length - 1 ? parseInt(sorted[i + 1].hex, 16) : 0;
  return `      "${id}": { "start": ${start}, "end": ${end}, "type": "${type}" }`;
});

fs.writeFileSync(outPath, '{\n  "system": {\n    "": {\n' + lines.filter(line => line !== null).join(',\n') + '\n    }\n  }\n}\n');
console.log(`Wrote ${lines.length} entries to ${outPath}`);
