# Render Source Load (`[C8]`–`[CA]`)

Three opcodes that load graphics source data pointers for the actor's rendering system. `[C8]` loads a spritemap animation table, `[C9]` loads a raw bitmap overlay pointer, and `[CA]` loads a portrait bitmap by numeric ID with palette DMA.

## Overview

| Op | Name | Operands | Target fields | Uses |
|----|------|----------|---------------|-----:|
| `C8` | `load_spritemap` | `@Binary, Byte` | `$7F0000,X` / `$7F0002,X` | 73 |
| `C9` | `load_bitmap` | `Address` (3-byte) | `$7F002E,X` / `$7F0030,X`, `$08` | 24 |
| `CA` | `load_portrait` | `Byte` | `$7F002E,X` / `$7F0030,X`, palette DMA | 51 |

### Relationship to Render Configuration (`[91]`–`[96]`)

Both families write to the same actor fields:

| Field | Render Config writers | Render Source Load writers |
|-------|----------------------|--------------------------|
| `$7F0000,X` / `$7F0002,X` (spritemap ptr) | `[91]`–`[94]` (byte id → table lookup + child spawn) | `[C8]` (direct far pointer + animation init) |
| `$7F002E,X` / `$7F0030,X` (bitmap ptr) | `[95]`–`[96]` (byte id → `word_04B879` table) | `[C9]` (direct address), `[CA]` (portrait id → computed) |
| `$08` render flags | `[91]`–`[94]` set `#$4000`, `[95]`–`[96]` set `#$8000` | `[C9]` sets `#$8000` |

The Render Config family uses indirection (byte id → table lookup) and optionally spawns child render actors. This family writes pointers directly and is used when the caller knows the exact graphics source.

---

## `[C8]` — `load_spritemap`

Loads a 24-bit spritemap table pointer and optionally resets animation to frame 0.

### Handler: `code_00CA84`

```
TYX
LDA [$2C] : INC $2C : INC $2C    ; read @Binary (low 16 bits)
STA $7F0000,X                     ; spritemap table pointer (low word)
LDA [$2C] : INC $2C : AND #$00FF ; read bank byte
STA $7F0002,X                     ; spritemap table pointer (bank)
LDA [$2C] : INC $2C : AND #$00FF ; read Byte operand
BEQ skip                          ; if 0 → no animation reset
  LDA #$0000 : STA $7F000C,X     ; clear animation ID
  STZ $10                         ; clear frame counter
  JSL code_04FC71                 ; advance animation frame 0
  STZ $0E                         ; clear delay counter
  JSL code_04FCE6                 ; read collision box from frame data
skip:
LDA $2C : STA $02,S : RTI        ; set return PC, continue
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| `@Binary` | 3 bytes | 24-bit far pointer to spritemap table |
| `Byte` | 1 byte | Animation init flag: 0 = load only, nonzero = reset to frame 0 |

### Helper functions

- **`code_04FC71`** — Animation frame advance. Sets data bank to `$7F0002,X`, indexes into the spritemap table via `$7F000C,X` (anim id) and `$10` (frame counter). Reads per-frame velocity data into `$14`/`$16`/`$18`/`$1A` and frame data pointer into `$7F0004,X`. Increments `$10`.
- **`code_04FCE6`** — Collision box setup from frame data. Reads from `$7F0004,X` (set by `code_04FC71`). Writes X offset → `$7F000E,X`, Y offset → `$7F0010,X`, width → `$7F0012,X`, height → `$7F0014,X`, scaled width → `$7F0016,X`.

### Spritemap pointer distribution

| Spritemap table | Count |
|----------------|------:|
| `spritemap_128000` | 19 |
| `spritemap_12A000` | 10 |
| `spritemap_0F8000` | 8 |
| `spritemap_12D000` | 7 |
| `spritemap_0E8000` | 7 |
| `spritemap_12B000` | 6 |
| `spritemap_0FC000` | 6 |
| `spritemap_0FA000` | 6 |
| `spritemap_12D800` | 3 |
| `spritemap_12C000` | 1 |

### Byte flag distribution

| Value | Count | Meaning |
|-------|------:|---------|
| `#00` | 67 | Load pointer only, keep current animation state |
| `#01` | 6 | Load pointer + reset animation to frame 0 |

### Source examples

| File | Call | Context |
|------|------|---------|
| `world/actor_04B422.asm:44` | `COP [C8] ( @spritemap_12B000, #00 )` | World map actor: load spritemap, no reset |
| `credits/credits_chickens/actor_04D745.asm:108` | `COP [C8] ( @spritemap_12C000, #01 )` | Credits: load + reset animation |
| `system/chunk_0B8000.asm:536` | `COP [C8] ( @spritemap_0E8000, #00 )` | Player host: load player spritemap |

---

## `[C9]` — `load_bitmap`

Loads a 24-bit bitmap source pointer and enables bitmap overlay mode.

### Handler: `code_00CABB`

```
TYX
LDA #$8000 : TSB $08              ; set bitmap overlay flag
LDA [$2C] : INC $2C : INC $2C    ; read Address (low 16 bits)
STA $7F002E,X                     ; bitmap source pointer (low word)
LDA [$2C] : INC $2C : AND #$00FF ; read bank byte
STA $7F0030,X                     ; bitmap source pointer (bank)
LDA $2C : STA $02,S : RTI        ; set return PC, continue
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| `Address` | 3 bytes | 24-bit far pointer to bitmap data |

### Address distribution

| Address | Count | Notes |
|---------|------:|-------|
| `$7FD000` | 23 | WRAM buffer — dynamic bitmap (portrait data staged here) |
| `@rawbitmap_178000` | 1 | ROM bitmap — static bitmap source |

### Flag set: `$08 |= #$8000`

This flag enables the bitmap rendering path. The render wait ops `[A0]`/`[A1]` check this flag and use `code_08E69B` to tick bitmap rendering from the source pointer.

### Source examples

| File | Call | Context |
|------|------|---------|
| `system/chunk_0B8000.asm:537` | `COP [C9] ( $7FD000 )` | Player host: bitmap overlay from WRAM buffer |
| `system/chunk_038000.asm:8113` | `COP [C9] ( @rawbitmap_178000 )` | Static bitmap overlay from ROM |
| `system/actor_0BD8F4.asm:12` | `COP [C9] ( $7FD000 )` | Dialog actor: WRAM bitmap buffer |

---

## `[CA]` — `load_portrait`

Loads a character portrait bitmap + palette by numeric ID. Computes a ROM pointer into `rawbitmap_158000`, DMAs the palette to WRAM, and yields.

### Handler: `code_00CADB`

```
TYX : PHX                         ; save actor slot
LDA [$2C] : INC $2C : AND #$00FF ; read portrait ID
CMP $09BE                         ; same as current portrait?
BEQ skip                          ; skip reload if unchanged

STA $09BE                          ; store new portrait ID
DEC                                ; id - 1
ASL : ASL : ASL                    ; (id-1) * 8
PHA                                ; save for palette calc

; Compute bitmap pointer: rawbitmap_158000 + (id-1) * $800
XBA : ASL : PHP : LSR             ; shift to get bank offset
CLC : ADC #<rawbitmap_158000       ; add base address
STA $7F002E,X                     ; bitmap pointer low
LDA #$0000 : PLP                  ; carry propagates bank crossing
ADC #>rawbitmap_158000             ; add base bank
STA $7F0030,X                     ; bitmap pointer bank
JSL code_08E62D                    ; queue DMA: 2048 bytes → VRAM $1C00

; Load palette: palettes_026BE8 + (id-1) * 32
SEP #$20
LDA #^palettes_026BE8 : STA $0527 ; source bank
LDA #$7E : STA $0526              ; dest bank (WRAM)
REP #$20
PLA : ASL : ASL                   ; (id-1)*8 → (id-1)*32
CLC : ADC #<palettes_026BE8       ; palette source offset
TAX
LDY #$38E0                        ; dest: $7E:38E0 (palette staging)
LDA #$001F                        ; 32 bytes
JSR $0524                         ; block copy

skip:
LDA $2C : STA $28                 ; save script pointer → resume point
LDA #$2000 : TSB $06              ; mark actor for render yield
PLX : PLA : PLA : RTL             ; restore slot, yield
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| `Byte` | 1 byte | Portrait ID (1-based index) |

### Data layout

Each portrait occupies:
- **2048 bytes** of 4bpp bitmap data at `rawbitmap_158000 + (id−1) × $800`
- **32 bytes** of palette data (16 colors × 2 bytes) at `palettes_026BE8 + (id−1) × 32`

The bitmap is DMA'd to VRAM at word address `$1C00` (byte address `$3800`), which is the character tile region for portrait display.

The palette is block-copied to `$7E:38E0` for subsequent CGRAM upload.

### Portrait ID distribution

| ID | Count | ID | Count |
|----|------:|----|------:|
| `#01` | 8 | `#07` | 2 |
| `#02` | 4 | `#08` | 3 |
| `#03` | 6 | `#09` | 4 |
| `#04` | 4 | `#0A` | 4 |
| `#05` | 3 | `#0B` | 1 |
| `#06` | 6 | `#0C` | 6 |

All 12 portrait IDs are used. The most common are #01 (8 uses), #03 and #06 and #0C (6 each).

### Cache optimization

The handler compares the requested portrait ID against `$09BE` (current portrait cache). If they match, the entire bitmap/palette load is skipped — only the script yield is performed. This avoids redundant DMA transfers when the same portrait appears in consecutive dialog scenes.

### Yield behavior

Unlike `[C8]` and `[C9]` which return via `RTI` (continue script), `[CA]` returns via `RTL` after saving the script pointer to `$28`/`$2A` and setting `$06 |= #$2000`. This yields the actor's execution — the rendering system must complete a frame before the script resumes. This is necessary because the DMA transfer must complete during VBlank.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02ED4C:214` | `COP [CA] ( #0B )` | Dialog scene: load portrait 11 |
| `actor_02ED65:223` | `COP [CA] ( #03 )` | Dialog scene: load portrait 3 |
| `chunk_038000.asm:3458` | `COP [CA] ( #03 )` | Cutscene: portrait 3 |
| `chunk_038000.asm:4110` | `COP [CA] ( #07 )` | Cutscene: portrait 7 |
| `actor_02F8C2.asm:237` | `COP [CA] ( #0C )` | Dialog: portrait 12 (most used) |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `C8` | `load_spritemap` | 73 |
| `C9` | `load_bitmap` | 24 |
| `CA` | `load_portrait` | 51 |
| | **Total** | **148** |

## Family notes

1. **Two rendering paths**: The game engine supports two rendering modes — spritemap-based (sprites assembled from OAM entries) and bitmap-based (raw pixel data DMA'd to VRAM). `[C8]` sets up the spritemap path; `[C9]`/`[CA]` set up the bitmap path. The render flag `$08 bit #$8000` distinguishes them. The render wait ops (`[9E]`/`[9F]` for spritemap, `[A0]`/`[A1]` for bitmap) drive the appropriate path forward.

2. **Common initialization sequence**: In the player host, the typical setup is `[C8]` → `[C9]` → `[C6]`: load spritemap table, set bitmap buffer, set palette. This prepares both rendering paths simultaneously.

3. **Portrait system**: `[CA]` is a specialized high-level op that encapsulates bitmap pointer computation, DMA queuing, and palette loading for dialog portraits. The 12 portrait IDs likely correspond to the main characters and key NPCs whose faces appear in dialog windows.

4. **WRAM bitmap buffer** (`$7FD000`): 23 of 24 `[C9]` calls point to this WRAM address. The portrait bitmap data is loaded here by `[CA]` (via DMA from ROM to VRAM and palette to WRAM staging), then `[C9]` sets the actor's bitmap pointer to this buffer for the render system to display.

5. **Yield semantics**: `[CA]` is the only op in this family that yields (RTL). It must yield because it queues a DMA transfer that can only execute during the next VBlank. `[C8]` and `[C9]` return via RTI (continue script) because they only set pointers without triggering DMA.

6. **Portrait caching**: The `$09BE` comparison in `[CA]` is a global cache — not per-actor. This means only one portrait can be active at a time across the entire game, which makes sense for a single dialog window system.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Render Configuration](render_config.md) `[91]`–`[96]`, `[9D]`–`[A1]` | Sets up and drives the same rendering fields via table lookups; C8-CA write pointers directly |
| [Sprite Attribute Set](sprite_attribs.md) `[C5]`–`[C7]` | Modifies OAM attributes (priority/palette/nametable) that affect how spritemap data from `[C8]` is rendered |
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | Sets animation ID `$7F000C,X` which indexes into the spritemap table loaded by `[C8]` |
