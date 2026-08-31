# COP family: BG tile attributes

_Deep-audited ops: `[24]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Paint attribute bits into the WRAM tilemap buffer `$7EF000` / `$7EF040`. Unrelated to switch tables `[25]`/`[26]` despite adjacent opcodes.

## Shared state

- `$7EF000` / `$7EF040` — attribute buffers

## Family notes

- Distinct from metatile map edits `[4C]`–`[4F]` (`$7EA000` / `$7E2000`).

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `24` | `paint_tile_attrs` | 60 | high | Byte, Word, Byte | `code_00A6F3` |

**Family call-site total:** 60

## Opcodes

#### COP [24] — `paint_tile_attrs` (BG map palette/priority run)

- **Confidence:** high
- **Preferred name:** `paint_tile_attrs`
- **Aliases:** `paint_tilemap_attrs`, `set_bg_palette_run`, `fill_tile_attrs`
- **Handler:** `code_00A6F3` @ `extracted/system/chunk_008000.asm:5318-5352`
- **Parameters:** `Byte` attr, `Word` start_index, `Byte` count_minus_1
- **Usage count:** 60 (only in `chunk_0B8000` + `chunk_038000`)

##### What it does

Paints **attribute bits** into a run of entries in the WRAM tilemap buffer `$7EF000` (and mirror `$7EF040`):

1. `attr` → `$30` via `XBA` (byte becomes high byte: `#04→$0400`, `#08→$0800`, `#0C→$0C00`)
2. `start_index` → `X` (word index into `$7EF000`)
3. `count_minus_1` → `Y`; loop **Y+1** times (`DEY` / `BPL`)
4. Per entry: `AND #$E3FF` (clear bits 10–12) then `ORA $30`; write **both** `$7EF000,X` and `$7EF040,X`

Bits 10–12 of an SNES BG map word are the **palette** (and related attr). So this recolors a horizontal run of tiles without changing tile indices.

```asm
; Handler (complete)
code_00A6F3 {
    TYX
    PHX
    LDA [$2C]
    INC $2C
    AND #$00FF
    XBA
    STA $30                 ; attr in high byte ($0C00 = pal 3, etc.)
    LDA [$2C]
    INC $2C
    INC $2C
    TAX                     ; start word index
    LDA [$2C]
    INC $2C
    AND #$00FF
    TAY                     ; iterations = Y+1

  loop:
    LDA $7EF000, X
    AND #$E3FF              ; clear bits 10–12
    ORA $30
    STA $7EF000, X
    LDA $7EF040, X          ; mirror / second plane (+$40)
    AND #$E3FF
    ORA $30
    STA $7EF040, X
    INX
    INX
    DEY
    BPL loop
    PLX
    LDA $2C
    STA $02, S
    RTI
}
```

##### Why / how used

UI / menu / cutscene tile highlighting — almost all sites are system banks. Recolor a strip of BG tiles (menu chrome, highlight bars, room FX).

| Attr byte | `$30` | Typical |
|-----------|-------|---------|
| `#04` | `$0400` | palette 1 (most common in `$0B`) |
| `#08` | `$0800` | palette 2 |
| `#0C` | `$0C00` | palette 3 |

```asm
; recolor 4 tiles starting at index $00E6
COP [24] ( #0C, #$00E6, #03 )

; paint several rows of menu chrome
COP [24] ( #04, #$04DC, #06 )
COP [24] ( #04, #$055C, #06 )
COP [24] ( #04, #$05DC, #06 )
```

| Item | Value |
|------|-------|
| Suggested alias | `paint_tile_attrs #pal, #index, #n_minus_1` |
| Buffer | `$7EF000` / `$7EF040` |

- **Source examples:**
  - `system/chunk_0B8000.asm:939+` — UI highlight strips
  - `system/chunk_038000.asm:8213+` — battle/cutscene tile FX
  - `system/chunk_0B8000.asm:7354+` — multi-row `#04` paints
