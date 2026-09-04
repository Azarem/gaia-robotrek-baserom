# Sprite Attribute Set (`[C5]`–`[C7]`)

Three opcodes that write SNES OAM sprite attribute fields into the actor's `$0A` flags word. Each clears a specific bit-field, then OR's in the byte operand (shifted to the high byte). The three fields correspond to the standard SNES OAM second attribute byte layout.

## Overview

| Op | Name | Field | `$0A` bits | AND mask | Operand shift | Uses |
|----|------|-------|-----------|----------|---------------|-----:|
| `C5` | `set_sprite_priority` | Priority | 12–13 | `#$CFFF` | byte bits 4–5 | 54 |
| `C6` | `set_sprite_palette` | Palette | 9–11 | `#$F1FF` | byte bits 1–3 | 33 |
| `C7` | `set_sprite_nametable` | Name table | 8 | `#$FEFF` | byte bit 0 | 24 |

### `$0A` high byte ↔ SNES OAM attribute mapping

The high byte of actor field `$0A` maps directly to the SNES OAM second attribute byte (`vhoopppc`):

```
  bit:  15   14   13  12  11  10   9    8
        v    h    o   o   p   p    p    c
        │    │    └─┬─┘   └──┬──┘  │
        │    │      │        │     └── name table (C7)
        │    │      │        └──────── palette 0-7 (C6)
        │    │      └───────────────── priority 0-3 (C5)
        │    └──────────────────────── h-flip / facing ($0A bit #$4000)
        └───────────────────────────── v-flip
```

The low byte of `$0A` holds actor logic flags (not modified by these ops).

### Shared handler pattern

All three use the same structure:

```
  TYX
  LDA $0A
  AND <mask>           ; clear the target field
  PHA
  LDA [$2C] : INC $2C  ; read byte operand
  AND #$00FF : XBA      ; shift to high byte
  ORA $01,S             ; merge into masked $0A
  STA $0A               ; write back
  PLA
  LDA $2C : STA $02,S : RTI
```

The operand byte encodes the value **pre-positioned** in the OAM bit layout. Scripts write the raw SNES attribute bits directly (e.g., `#$30` = priority 3, not `#$03`).

---

## `[C5]` — `set_sprite_priority`

Sets the SNES sprite priority (0–3) controlling render order relative to BG layers.

### Handler: `code_00CA39`

Mask `#$CFFF` clears bits 12–13. Operand bits 4–5 (after XBA) map to priority:

| Operand | Priority | Meaning |
|---------|---------|---------|
| `#$30` | 3 | In front of all BG layers (default for most actors) |
| `#$20` | 2 | Behind BG1, in front of BG2/BG3 |
| `#$10` | 1 | Behind BG1/BG2 |
| `#$00` | 0 | Behind all BG layers |

### Operand distribution

| Value | Count |
|-------|------:|
| `#$30` (priority 3) | 49 |
| `#$20` (priority 2) | 3 |
| `#$00` (priority 0) | 2 |

### Usage (54 sites)

Most actors set priority 3 at spawn (`#$30` at line ~8), ensuring they render above background layers. The 3 priority-2 uses and 2 priority-0 uses create layering effects where actors appear behind specific BG layers.

### Source examples

| File | Call | Context |
|------|------|---------|
| `world/actor_04B422.asm:8` | `COP [C5] ( #30 )` | World map actor: priority 3 at init |
| `credits/actor_04DAC5.asm:8` | `COP [C5] ( #30 )` | Credits sprite: priority 3 |
| `system/chunk_0B8000.asm` | `COP [C5] ( #20 )` | Player host: priority 2 (behind BG1) |

---

## `[C6]` — `set_sprite_palette`

Sets the SNES sprite palette index (0–7) for the actor's OAM entries.

### Handler: `code_00CA52`

Mask `#$F1FF` clears bits 9–11. Operand bits 1–3 (after XBA) map to palette:

| Operand | Palette | Notes |
|---------|---------|-------|
| `#$00` | 0 | Default palette |
| `#$02` | 1 | |
| `#$04` | 2 | |
| `#$06` | 3 | |
| `#$08` | 4 | |
| `#$0A` | 5 | |
| `#$0C` | 6 | |
| `#$0E` | 7 | Highest palette |

### Operand distribution

| Value | Count |
|-------|------:|
| `#$00` (palette 0) | 13 |
| `#$0E` (palette 7) | 9 |
| `#$08` (palette 4) | 6 |
| `#$04` (palette 2) | 2 |
| `#$02` (palette 1) | 2 |
| `#$06` (palette 3) | 1 |

### Usage (33 sites)

Used for palette swaps (color cycling effects, alternate NPC appearances) and restoring the default palette. `actor_02E9AA` cycles through palettes 1→2→0 based on a counter for a visual effect. The player host uses palette 7 (`#$0E`) in certain contexts.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:112` | `COP [C6] ( #02 )` | Palette cycle: set palette 1 |
| `actor_02E9AA.asm:115` | `COP [C6] ( #04 )` | Palette cycle: set palette 2 |
| `actor_02E9AA.asm:118` | `COP [C6] ( #00 )` | Palette cycle: reset to palette 0 |
| `chunk_0B8000.asm:538` | `COP [C6] ( #0E )` | Player host: palette 7 |

---

## `[C7]` — `set_sprite_nametable`

Sets the SNES OAM character name table high bit, selecting between two 256-tile pages of sprite graphics.

### Handler: `code_00CA6B`

Mask `#$FEFF` clears bit 8. Operand bit 0 (after XBA) selects the page:

| Operand | Page | Meaning |
|---------|------|---------|
| `#$00` | 0 | First 256 tiles (standard) |
| `#$01` | 1 | Second 256 tiles |

### Operand distribution

| Value | Count |
|-------|------:|
| `#$00` (page 0) | 22 |
| `#$01` (page 1) | 2 |

### Usage (24 sites)

Overwhelmingly used to reset to page 0 (`#$00`). The 22 page-0 calls are concentrated in the player host (`chunk_0B8000.asm`) — likely resetting the name table after equipment/costume changes. The 2 page-1 uses (`credits/credits_chickens/actor_04D745.asm`) select alternate tile graphics.

### Source examples

| File | Call | Context |
|------|------|---------|
| `chunk_0B8000.asm:5837` | `COP [C7] ( #00 )` | Player host: reset to page 0 |
| `credits_chickens/actor_04D745.asm:113` | `COP [C7] ( #01 )` | Credits: select page 1 for alternate tiles |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `C5` | `set_sprite_priority` | 54 |
| `C6` | `set_sprite_palette` | 33 |
| `C7` | `set_sprite_nametable` | 24 |
| | **Total** | **111** |

## Family notes

1. **Pre-positioned operand encoding**: The byte operand is not a simple 0–N value. It's the raw SNES OAM attribute bits pre-shifted to their correct positions within the `vhoopppc` byte. Scripts write `#$30` for priority 3 (not `#$03`), `#$0E` for palette 7 (not `#$07`), and `#$01` for page 1. This avoids any shifting in the handler — just mask, OR, done.

2. **Complementary to facing flag**: The h-flip bit (bit 14, `#$4000`) is the well-known facing flag used by spawn offset ops (`[A5]`/`[AD]`/`[B7]`). C5–C7 never touch bit 14 — it's managed by the facing/direction system instead.

3. **Priority dominance**: Priority 3 (`#$30`) accounts for 49 of 54 C5 uses — almost every actor wants to render in front of backgrounds. The rare priority 2/0 uses create depth layering effects.

4. **Palette as visual variant**: C6 enables runtime palette swaps without reloading graphics — a standard SNES technique for color cycling, damage flash, elemental effects, and NPC variants using the same tile graphics with different color palettes.

5. **Name table rarely changed**: C7 is almost always `#$00` (reset). The SNES sprite name table bit selects between two 256-tile banks; most actors live entirely within one bank.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Render Configuration](render_config.md) `[91]`–`[96]`, `[9D]`–`[A1]` | Sets spritemap pointers and render mode; C5–C7 modify the per-sprite OAM attributes applied during rendering |
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | Sets animation state; C5–C7 modify the visual presentation (priority/palette/page) independently |
| [Actor Spawn (render)](actor_spawn_render.md) `[A9]`–`[B1]` | Some spawn ops set `$06` flags that affect rendering; C5–C7 directly edit the OAM attributes in `$0A` |
