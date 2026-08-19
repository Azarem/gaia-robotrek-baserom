# @gaialabs/robotrek-baserom

GaiaLabs base ROM package for **Robotrek** (USA) and **Slap Stick** (Japan).

This package supplies the game-specific database that [gaia-core](https://github.com/Azarem/gaia-core) needs to extract and rebuild those ROMs, plus a `baserom/` folder of assembly patches and assets that are applied on every rebuild. The [Robotrek retranslation project](https://github.com/Azarem/RobotrekRetranslated) depends on this package: it extracts the USA ROM, then rebuilds with this package's patches and its own translation modules on top.

## Related projects

- [gaia-core](https://github.com/Azarem/gaia-core) — ROM processing engine (`@gaialabs/core`). This package imports `DbRootUtils` from it to extract and rebuild.
- [RobotrekRetranslated](https://github.com/Azarem/RobotrekRetranslated) — Retranslation project. It imports `extract` and `rebuild` from this package and passes `./modules/base` as an extra module path so chapter patches (translated strings) overlay the extracted ROM and this package's `baserom/` files.

You still need a copy of the original ROM. This repository does not include ROM images.

## What this package does

Robotrek's layout, compression, COP scripts, and text encoding are game-specific. gaia-core does not hard-code those details. This package provides them as two `DbGameRomModule` objects:

- `db` — USA Robotrek, loaded from `us/*.json`
- `jp` — Japanese Slap Stick, loaded from `jp/*.json` (with `mnemonics.json` and `fileTypes.json` reused from `us/`, and `structs` taken from USA then overlaid with any JP entries)

`extract` / `extractJP` turn a ROM into a tree of assembly and binary files under `./extracted` or `./extracted-jp`. `rebuild` / `rebuildJp` assemble those files back into a ROM.

Rebuild layers folders in order. Later folders replace earlier files with the same name and type:

1. Extracted dump (`./extracted` by default)
2. This package's `baserom/` folder (always included unless you pass another `baseRomPath`)
3. Optional extra module paths (the retranslation project uses this for `./modules/base`)

That is how translation work stays in the retranslation repo while engine and loader patches live here.

## Database JSON files (`us/` and `jp/`)

Each region folder is a table of facts used during disassembly and rebuild. USA and Japan have parallel files because addresses, assets, and text encoding differ between the two ROMs.

| File | Role |
| --- | --- |
| `config.json` | ROM/header settings: Quintet LZ compression, SFX location/count/type, HiROM / FastROM, chipset, RAM size, country code, game title, interrupt vector labels, and `oddLocationBase` / `oddLocationSpan`. USA also sets `uncompress: true`. |
| `files.json` | Binary assets in the ROM (tilesets, tilemaps, spritemaps, music, and similar) with start/end offsets and type. Extract writes these out as `.bin`, `.map`, `.set`, `.sprite.asm`, `.bgm`, and related files. |
| `blocks.json` | Code and data chunks (for example `chunk_008000`) and the parts inside them (`Code`, `String`, `Address`, tables, and so on). Extract writes these as `.asm`. |
| `groups.json` | Named groups of scenes (`world`, `boot`, `rococo`, `credits`, …) with scene IDs. Extract uses this to place files under `extracted/<group>/<scene>/`. The USA file is populated; the JP file is currently empty. |
| `structs.json` | Binary layouts for game objects (actors, map meta, sprites, and other tables) so those blobs can be disassembled into named fields. JP `structs.json` is empty; the JP module starts from the USA structs and merges JP entries on top. |
| `stringTypes.json` | Text encodings: character maps, delimiters, terminators, and control commands (`END`, `PAL`, `NAM`, `N`, and others) for `String` and `ConsoleString`. USA maps Latin text; JP maps kana (including dakuten/handakuten modifiers). |
| `copdef.json` | COP opcode definitions: operand size, part types, halt flags, and conditional layouts used in actor/script code. |
| `overrides.json` | Per-address extraction hints such as accumulator width (`M`), names, or type overrides. |
| `rewrites.json` | Address remaps applied during processing. USA has entries; JP is currently empty. |
| `transforms.json` | Per-block search/replace rules applied to generated assembly. USA has replacements for `chunk_048000`; JP is currently empty. |
| `labels.json` | Maps ROM offsets to label suffixes / transform names used while writing assembly. |
| `mnemonics.json` | SNES hardware register names (`INIDISP`, `VMADDL`, `APUIO0`, …). JP uses the USA file. |
| `fileTypes.json` | Maps resource kinds to extensions and rebuild behavior (`Bitmap` → `.bin`, `Patch` → `.patch.asm`, `Assembly` → `.asm`, `Palette` → `.pal`, and so on). JP uses the USA file. |

`src/index.ts` is what actually loads these files into `db` and `jp`.

## `baserom/` patches

Files with the `.patch.asm` extension are patches (`fileTypes.json` marks that type as `isPatch`). A patch typically `?INCLUDE`s extracted chunks, then redefines labeled locations so the rebuild writes the new code into those chunks. Other files in the folder (graphics, palettes, spritemaps) are included the same way as extracted assets.

### `uncompressed.patch.asm`

Lets map assets load uncompressed. Uncompressed payloads use a **negative size header** so the existing meta tables do not need to change. The patch intercepts bitmap, tileset, tilemap, strangemap, and battle-sprite decompressors: if the size word is negative, it skips Quintet LZ (`code_04843D`) and copies the raw bytes instead.

```1:2:baserom/uncompressed.patch.asm
;This patch file allows map assets to be loaded uncompressed
;Uncompressed files use a negative size header to avoid altering the meta tables
```

### `map_meta_index.patch.asm`

Switches map meta lookup and `FF` jump entries to index tables (`mapMeta_list`, `marker_list`) so the game does not need two meta tables. `FC` BGM entries read from `music_list_01CA3C`.

```1:2:baserom/map_meta_index.patch.asm
;This patch allows the game to use lookup tables for meta loading and jumps
;This removes the need for two meta tables, and speeds up loading times
```

```17:28:baserom/map_meta_index.patch.asm
addr_list_048D8B:

code_048D2E {
    REP #$20
    LDA $05A8
    ASL
    TAX
    LDA $@mapMeta_list, X
    TAY
    SEP #$20
    RTS
```

### `meta_load.patch.asm`

Map/meta loading changes, including OddLocation handling that works with any bank high/low byte, and a font-stamping fix so the font raw bitmap can be relocated (`rawbitmap_080000`).

```1:2:baserom/meta_load.patch.asm
;This patch contains miscellaneous changes to map/meta loading
;It also contains a fix for string font stamping so the raw bitmap can be moved
```

### `music_loader.patch.asm`

Changes APU / music load steps so track loading is faster (the file notes that MSU support is planned, not implemented).

```1:2:baserom/music_loader.patch.asm
;This patch file adjusts various music loading processes, making them faster
;MSU support will be added eventually
```

### `boot_logo.patch.asm`

Inserts a GaiaLabs logo into the boot sequence by editing `mapMeta_01C1` and `actor_04B187`. It references `gfx_boot_exprite.raw.bin`, `palette_171DE1.pal`, and `spm_boot_logos.raw.sprite.asm` in this same folder.

```1:12:baserom/boot_logo.patch.asm
;This patch adds the GaiaLabs logo to the boot sequence

-------------------------------------
?INCLUDE 'map_meta'
-------------------------------------

mapMeta_01C1 [
  meta08 < #00, #00, #12 >   ;00
  bitmap < #00, #10, #20, !bitmap_087631 >   ;01
  bitmap < #80, #10, #30, !gfx_boot_exprite >   ;01
  palette < #00, #50, #80, !palette_171DE1 >   ;02
]
```

When you add a new string or code file that lives in an extracted chunk, include that chunk from the patch the same way these files do (`?INCLUDE 'chunk_048000'`, `?INCLUDE 'map_meta'`, and so on).

## Setup and use

These steps rebuild the USA ROM with the patches in `baserom/`.

### 1. Install Node.js

Install Node.js from [https://nodejs.org/en/download](https://nodejs.org/en/download), then clone this repository and install dependencies:

```bash
npm install
```

### 2. Point at your ROM

Edit `.env.local` and set `ROM_PATH` to the Robotrek (USA) ROM on your machine:

```
ROM_PATH="C:/Games/SNES/Robotrek (USA).sfc"
```

`npm run extract` loads this file via `node --env-file=.env.local`. If you also work with the Japanese ROM, set `ROM_PATH_JP` (Slap Stick) and use `npm run extract-jp`.

### 3. Extract

```bash
npm run extract
```

This deletes `./extracted` if it exists, then writes the disassembled ROM there. Use those files as a reference when writing patches.

### 4. Change files in `baserom/`

Add or edit patches, graphics, palettes, and other assets under `baserom/`. On rebuild they overlay the matching extracted files.

### 5. Rebuild

```bash
npm run rebuild
```

Output is `./rebuilt/Robotrek-Rebuilt.smc`. Open that file in an emulator (reload the ROM if the emulator is already running).

## Using this package from another project

The retranslation repo does this:

```typescript
import { extract as extractInternal, rebuild as rebuildInternal } from '@gaialabs/robotrek-baserom';

export async function extract(romPath: string, outPath: string) {
    await extractInternal(romPath, outPath);
}

export async function rebuild(inPath: string, outPath: string) {
    await rebuildInternal(inPath, outPath, null, [ './modules/base' ]);
}
```

Passing `null` for the third argument keeps this package's `baserom/` folder. The fourth argument is extra overlay folders (chapter patches and new strings).

Exported entry points:

| Export | Default input | Default output |
| --- | --- | --- |
| `extract(romPath, outPath)` | `process.env.ROM_PATH` | `./extracted` |
| `extractJP(romPath, outPath)` | `process.env.ROM_PATH_JP` | `./extracted-jp` |
| `rebuild(inPath, outPath, baseRomPath, modulePaths?)` | `./extracted` + package `baserom/` | `./rebuilt/Robotrek-Rebuilt.smc` |
| `rebuildJp(inPath, outPath, baseRomPath, modulePaths?)` | `./extracted-jp` + package `baserom-jp/` | `./rebuilt-jp/SlapStick-Rebuilt.smc` |
| `db` / `jp` | — | `DbGameRomModule` objects for gaia-core |

## npm scripts

| Script | Command |
| --- | --- |
| `npm run extract` | Extract the USA ROM into `./extracted` |
| `npm run extract-jp` | Extract the Japanese ROM into `./extracted-jp` |
| `npm run rebuild` | Rebuild the USA ROM into `./rebuilt/Robotrek-Rebuilt.smc` |

## License

See [LICENSE](LICENSE).
