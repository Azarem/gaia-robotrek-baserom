# Tile Collision Check (`[BA]`–`[BD]`)

Four opcodes that test the tile map for passability in each cardinal direction. Each computes a probe point from the actor's position, looks up the tile attribute at that point, and returns the tile type in `$30`. The calling script reads `$30` to determine whether to proceed, stop, or trigger a special action (door, stairs, warp, etc.).

## Overview

| Op | Name | Direction | Helper | Uses |
|----|------|-----------|--------|-----:|
| `BA` | `check_tile_right` | Right (+X) | `code_00DF84` | 2 |
| `BB` | `check_tile_left` | Left (−X) | `code_00E045` | 2 |
| `BC` | `check_tile_up` | Up (−Y) | `code_00DDF4` | 2 |
| `BD` | `check_tile_down` | Down (+Y) | `code_00DEB5` | 4 |

All four handlers share the same prologue:

```
  TYX
  LDA $00 : SEC : SBC #$0008 : STA $34    ; probe X = actor X - 8
  LDA $02 : SEC : SBC #$0010 : STA $36    ; probe Y = actor Y - 16
  JSR <helper>
  LDA $2C : STA $02, S : RTI
```

The `−8` / `−16` offsets center the probe point on the actor's body: `$00` is typically the actor's center X (minus half a 16px tile), and `$02` is the foot Y (minus one full tile to reach body center).

### Result convention

The helpers set `$30` to the tile's low-nibble type:
- `$30 == #$00`: passable, no special property
- `$30 == #$02`: special tile (scene-specific — door, transition, etc.)
- `$30 == #$06`: special tile (scene-specific — stairs, etc.)
- `$30 == #$07`: special tile (scene-specific — ladder/climb zone)
- `$30 == #$0B`: special tile (scene-specific — warp/trigger)
- `$30 == #$0F`: solid wall (forced by helper when blocked)

The full tile attribute byte is also stored in `$32` (upper nibble contains overlay/layer flags).

### Parameters

(none) — all four ops are parameterless.

---

## `[BA]` — `check_tile_right`

Tests whether the tile(s) to the **right** of the actor are passable.

### Helper: `code_00DF84`

**Single-tile path** (actor width + height < 3):
1. `code_0AF4B6`: convert probe `$34`/`$36` → tile map index X into `$7FA000`
2. Read `$7FA000,X AND #$0F` — if `== #$03`, blocked (right-facing wall)
3. `code_08F4FE`: step tile index **up** one row — if boundary hit, blocked
4. Read tile again — check upper nibble (`BIT #$F0`), check `== #$0C` or `#$0F`
5. Return C=0 (passable) or C=1 (blocked, `$30 = #$0F`)

**Multi-tile path** (actor spans 3+ tiles):
1. Compute extended probe: `$34 = $7F000E,X + $00`; `$36 = $7F0010,X + $02`
2. First loop (width times): step **right** (`code_08F479`), check for `#$03` block
3. Second loop (width times): step **right**, check for `#$0C` or `#$0F` block

### Tile types that block rightward movement
- `#$03` — right-facing wall (primary)
- `#$0C` — left-facing wall (secondary, in multi-tile scan)
- `#$0F` — solid block

### Usage (2 sites)

| File | Context |
|------|---------|
| `chunk_0B8000.asm:9356` | Player host: right movement collision check, sets `$0C = 1` before check, followed by `COP [BE]` response handler |
| `actor_09D35D.asm:32` | NPC patrol: animate-then-check-right loop; if `$30 != 0`, keep animating in place; if passable, step right |

---

## `[BB]` — `check_tile_left`

Tests whether the tile(s) to the **left** of the actor are passable.

### Helper: `code_00E045`

**Single-tile path**: Same structure as BA but:
- Block type: `#$0C` (left-facing wall)
- Scan step: `code_08F4DD` (step **down**)
- Secondary block: `#$03`, `#$0F`

**Multi-tile path**: Extended probe adds `(height−1) × 16` to Y for bottom-edge start. Scans width tiles with `code_08F479` (right), then `code_08F4DD` (down).

### Tile types that block leftward movement
- `#$0C` — left-facing wall (primary)
- `#$03` — right-facing wall (secondary)
- `#$0F` — solid block

### Usage (2 sites)

| File | Context |
|------|---------|
| `chunk_0B8000.asm:9418` | Player host: left movement collision, sets `$0C = 0`, followed by `COP [BE]` |
| `actor_09D35D.asm:19` | NPC patrol: animate-then-check-left loop |

---

## `[BC]` — `check_tile_up`

Tests whether the tile(s) **above** the actor are passable.

### Helper: `code_00DDF4`

**Single-tile path**: Same structure but:
- Block type: `#$05` (upward-facing wall / ceiling)
- Scan step: `code_08F4AA` (step **left**)
- Secondary block: `#$0A`, `#$0F`

**Multi-tile path**: Loop counter = height. Scans height tiles with `code_08F4DD` (down), then `code_08F4AA` (left).

### Tile types that block upward movement
- `#$05` — ceiling/upward wall (primary)
- `#$0A` — floor/downward wall (secondary)
- `#$0F` — solid block

### Usage (2 sites)

| File | Context |
|------|---------|
| `chunk_0B8000.asm:9463` | Player host: up movement collision, sets `$0C = 2`, followed by `COP [BF]` |
| `actor_09D35D.asm:50` | NPC patrol: animate-then-check-up loop |

---

## `[BD]` — `check_tile_down`

Tests whether the tile(s) **below** the actor are passable.

### Helper: `code_00DEB5`

**Single-tile path**: Same structure but:
- Block type: `#$0A` (downward-facing wall / floor edge)
- Scan step: `code_08F479` (step **right**)
- Secondary block: `#$05`, `#$0F`

**Multi-tile path**: Extended probe adds `(width−1) × 16` to X for right-edge start. Loop counter = height. Scans with `code_08F4DD` (down), then `code_08F479` (right).

### Tile types that block downward movement
- `#$0A` — floor edge/downward wall (primary)
- `#$05` — ceiling (secondary)
- `#$0F` — solid block

### Usage (4 sites)

| File | Context |
|------|---------|
| `chunk_0B8000.asm:9506` | Player host: down movement collision, sets `$0C = 3`, followed by `COP [BF]` |
| `actor_09D35D.asm:63` | NPC patrol: animate-then-check-down loop |
| `actor_08A981.asm:44` | NPC: wait for passable tile below before moving (`$30 == 0` → proceed) |
| `map_F2/actor_089DFB.asm:32` | NPC: down collision check in movement sequence |

---

## Helper functions

### `code_0AF4B6` — Pixel position to tile index

Converts pixel coordinates `$34` (X) / `$36` (Y) to a tile map index in `$7FA000`:
- Y is aligned to 16px grid (`AND #$FFF0`), multiplied by the map stride (`$0823`)
- X is divided by 16 (`LSR×4`) and added
- Returns X = offset into `$7FA000` tile attribute array (clamped to < `#$4000`)

### Tile step helpers (bank `$08`)

| Helper | Direction | Operation |
|--------|-----------|-----------|
| `code_08F479` | Step right | Increment column; wrap to next row at right edge |
| `code_08F4AA` | Step left | Decrement column; wrap to previous row at left edge |
| `code_08F4DD` | Step down | Add 16 to index (one row); check screen bounds |
| `code_08F4FE` | Step up | Subtract 16 from index (one row); check screen bounds |

All return C=0 (stepped successfully) or C=1 (hit boundary — treated as blocked).

### Actor collision fields

| Field | Role |
|-------|------|
| `$7F0012,X` | Actor width in tiles |
| `$7F0014,X` | Actor height in tiles |
| `$7F000E,X` | X collision box offset |
| `$7F0010,X` | Y collision box offset |

The multi-tile path activates when `width + height >= 3` (actor spans multiple tiles). Loop counters `$000C` / `$000E` scan across the actor's bounding box edges.

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `BA` | `check_tile_right` | 2 |
| `BB` | `check_tile_left` | 2 |
| `BC` | `check_tile_up` | 2 |
| `BD` | `check_tile_down` | 4 |
| | **Total** | **10** |

## Family notes

1. **Player host integration**: The player host (`chunk_0B8000.asm`) is the primary consumer. It sets `$0C` to a direction index (0=left, 1=right, 2=up, 3=down) before calling the collision check, then calls `COP [BE]` (horizontal) or `COP [BF]` (vertical) as a response handler. After that, it reads `$30` to dispatch to special tile behaviors (doors, stairs, warps).

2. **NPC patrol pattern**: `actor_09D35D.asm` demonstrates the classic patrol loop — animate in place, check collision in movement direction, loop until passable, step one tile, repeat in opposite direction. All four directions are used.

3. **Directional tile types**: The tile attribute low nibble encodes directional passability. `#$03` and `#$0C` are horizontal walls (right/left), `#$05` and `#$0A` are vertical walls (up/down). `#$0F` is universal solid. The multi-tile scan checks for walls from both directions, ensuring the full bounding box is clear.

4. **Shared probe offset**: The `−8, −16` probe offset in all four handlers centers the check on the actor's visual body. The multi-tile paths use `$7F000E,X` / `$7F0010,X` for a more precise collision box that may differ from the visual position.

5. **Sparse but critical**: Only 10 total call sites, but these are the fundamental walkability checks for both the player and NPCs.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [BG Tile Attributes](bg_tile_attrs.md) `[24]` | Reads/writes tile attributes in `$7FA000`; collision checks read from the same tile map |
| [Position Adjust](position_adjust.md) `[B7]`–`[B9]` | Often used after collision passes to move the actor into the cleared tile |
| [Wander / Step Profile](wander.md) `[28]`–`[2A]` | Higher-level movement system that likely uses collision checks internally |
