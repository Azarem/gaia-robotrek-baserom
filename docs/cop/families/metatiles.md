# COP family: Metatile id (branch + write)

_Deep-audited ops: `[4A]`, `[4B]`, `[4C]`, `[4D]`, `[4E]`, `[4F]`, `[50]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

Branch on or rewrite per-cell metatile ids in `$7EA000`, with graphics from `$7E2000+id×8` and collision refresh via `code_0AF5A4`. Includes the cooperative multi-row redraw scanner `[50]`.

## Shared state

- `$7EA000` — per-cell tile / metatile id
- `$7E2000` — metatile graphics table (8 bytes per id)
- `$095E` — BG update queue cursor; `≥$80` → writers yield
- `$30` — row cursor (pixels) for `[50]` scan; scripts usually `STZ $30` first
- `code_0AF5A4` flag `$0000`: `0`=write id; `1`=draw/refresh only
- `code_0AF4B6` / `code_0AF514` — cell index / advance along a row

## Family notes

- Subgroups: branch `[4A]`/`[4B]`; write `[4C]`/`[4D]`; draw/refresh `[4E]`/`[4F]`; row scan `[50]`.
- `[4D]` assembler `Byte,Word` packs `dy` (lo) + `tile` (hi).
- `[4F]` unused (0 call sites).
- `[50]` is **not** movement — jump-table neighbor `[51]` starts the walk/step family.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `4A` | `branch_if_tile` | 11 | high | Byte, &Code | `code_00AFD4` |
| `4B` | `branch_if_tile_at` | 19 | high | Byte, Byte, Byte, &Code | `code_00B008` |
| `4C` | `set_tile` | 24 | high | Byte, Byte, Byte | `code_00B044` |
| `4D` | `set_tile_at` | 84 | high | Byte, Word (packs dy+tile) | `code_00B05F` |
| `4E` | `draw_tile_at` | 6 | high | Byte, Byte, Byte | `code_00B0A7` |
| `4F` | `refresh_tile_at` | 0 | high | Byte, Byte | `code_00B0B1` |
| `50` | `redraw_tile_rows` | 128 | high | Byte×6 | `code_00B109` |

**Family call-site total:** 272

## Opcodes

#### COP [4A] — `branch_if_tile` (branch if tile id under actor matches)

- **Confidence:** high (handler + `$7EA000` fill path + call-site audit)
- **Preferred name:** `branch_if_tile`
- **Aliases:** `branch_if_tile_id`, `if_metatile`, `branch_if_facing` (old misnomer — **not** facing)
- **Handler:** `code_00AFD4` @ `extracted/system/chunk_008000.asm:6643-6673`
- **Parameters:** `Byte` tile_id, `&Code` branch target
- **Usage count:** 11

##### What it does

```asm
code_00AFD4 {
    TYX
    PHX
    LDA $00
    SEC
    SBC #$0008
    STA $34                   ; cell origin X
    LDA $02
    SEC
    SBC #$0010
    STA $36                   ; cell origin Y
    JSL $@code_0AF4B6         ; → X = index; leaves A 8-bit
    LDA $7EA000, X            ; tile / metatile id at cell
    CMP [$2C]                 ; vs operand Byte (8-bit)
    BEQ match
    REP #$20
    PLX
    LDA $2C
    CLC
    ADC #$0003                ; skip Byte + &Code
    STA $02, S
    RTI

  match:
    REP #$20
    PLX
    INC $2C                   ; skip Byte
    LDA [$2C]                 ; &Code
    STA $02, S                ; RTI → branch target
    RTI
}
```

`$7EA000` is the **raw tile-id map**, filled alongside collision attrs by `code_0AF5A4` (writes id to `$7EA000`, table-derived attr to `$7FA000`). Same `code_0AF4B6` indexing as `[44]`–`[49]`.

##### Why / how used

Stand-on / touch triggers: poll until the cell under the actor is a specific tile, then fire.

```asm
; mansion exterior — wait until standing on tile $F9
loc:
    COP [CC]
    COP [4A] ( #F9, &on_tile )
    BRA loc
on_tile:
    COP [0A] ( #$8071 )
    COP [B2]
```

Follower that tracks the player and reacts to several floor types:

```asm
; actor_04BADE — snap to player cells, then:
COP [4A] ( #03, &react )
COP [4A] ( #E9, &react )
COP [4A] ( #EA, &react )
RTL
react:
    COP [4D] ( #00, #$E800 )   ; related tile-write family
```

Top tile ids (11 sites): `#F9` (4), `#FD` (2), `#FB`/`#FC`/`#03`/`#E9`/`#EA` (1 each).

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_tile #id, &label` |
| Match | Exact 8-bit equality |
| Miss | Fall through (skip 3 operand bytes) |

- **JSL:** `code_0AF4B6`
- **Source examples:**
  - `prinkys_mansion/mansion_exterior/actor_06CFF1.asm:12` — `#F9`
  - `seaside_cave/actor_0689AB.asm:21` — `#FB`
  - `system/actor_04BADE.asm:34-36` — `#03`/`#E9`/`#EA`
  - `system/actor_0BF77D.asm:36,42` — `#FC`/`#FD`
  - `volcano_base/base_secret_lab/actor_09A3CB.asm:51` — `#FD`

#### COP [4B] — `branch_if_tile_at` (branch if tile id at offset matches)

- **Confidence:** high
- **Preferred name:** `branch_if_tile_at`
- **Aliases:** `branch_if_tile_offset`, `if_metatile_at`, `cop_4b` (old stub)
- **Handler:** `code_00B008` @ `extracted/system/chunk_008000.asm:6675-6708`
- **Parameters:** `Byte` dx, `Byte` dy, `Byte` tile_id, `&Code`
- **Usage count:** 19

##### What it does

```asm
code_00B008 {
    TYX
    PHX
    JSR $&code_00E510         ; dx → signed cells×16 (fall into E517)
    CLC
    ADC $00
    SEC
    SBC #$0008
    STA $34
    JSR $&code_00E510         ; dy
    CLC
    ADC $02
    SEC
    SBC #$0010
    STA $36
    JSL $@code_0AF4B6
    LDA $7EA000, X
    CMP [$2C]                 ; third Byte = tile id
    BEQ match
    ; miss: skip Byte + &Code (+3)
    …
  match:
    INC $2C
    LDA [$2C]
    STA $02, S                ; branch
    RTI
}
```

Same compare/branch shape as `[4A]`, but probe point is **actor + signed cell offset** (identical encoding to `[46]`/`[47]`/`[48]`).

##### Why / how used

Check a **neighbor** cell (often one above the player: `#00,#FF`) for interactive tiles — locked doors, signs, switches:

```asm
; player interact helpers (chunk_0B8000)
COP [4B] ( #00, #FF, #FC, &msg_a )
COP [4B] ( #00, #FF, #F4, &msg_b )
COP [4B] ( #00, #FF, #FA, &locked_door_a )
COP [4B] ( #00, #FF, #F8, &locked_door_b )
```

NPC watches a relative tile for a puzzle state:

```asm
; cave prison — tile $FB at (−3,−5) from actor
COP [4B] ( #FD, #FB, #FB, &on_trigger )
```

Top patterns: `(#00,#FF,#F4/#FA/#F8/#FD/#FC)` player-facing checks; `(#00,#00,#FB/#EC/#ED/#EE)` underfoot; lab `(#FF,#00,#6B)`.

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_tile_at #dx, #dy, #id, &label` |
| Units | dx/dy = signed **cells** |
| vs `[4A]` | Offset form; same `$7EA000` compare |

- **JSR/JSL:** `code_00E510`, `code_0AF4B6`
- **Source examples:**
  - `system/chunk_0B8000.asm:10613-10618` — player tile cues
  - `prinkys_mansion/mansion_underground_switch/actor_06C5C5.asm:84` — `#00,#FE,#EA`
  - `seaside_cave/cave_prison/actor_068DA4.asm:17` — `#FD,#FB,#FB`
  - `system/actor_09D45C.asm:9` / `09D499.asm:9` — `#00,#00,#FB`
  - `volcano_base/base_secret_lab/actor_09A3CB.asm:13,20` — `#FF,#00,#6B`

##### Family summary (`[4A]`–`[4B]` tile-id branch)

| Op | Name | Probe point | Buffer |
|----|------|-------------|--------|
| `[4A]` | `branch_if_tile` | Actor cell | `$7EA000` |
| `[4B]` | `branch_if_tile_at` | Actor + Δcell | `$7EA000` |

Related: `[4C]`/`[4D]` are the **write** side of `$7EA000` (via `code_0AF5A4`). Distinct from `[48]`/`[49]`, which sample `$7FA000` collision nibbles into `$30` without branching.

#### COP [4C] — `set_tile` (write tile id at absolute cell XY)

- **Confidence:** high (handler + `code_0AF5A4` + call-site audit)
- **Preferred name:** `set_tile`
- **Aliases:** `paint_tile_abs`, `set_metatile_xy`, `cop_4c` (old stub)
- **Handler:** `code_00B044` @ `extracted/system/chunk_008000.asm:6711-6722` → shared `loc_00B086` / `code_0AF5A4`
- **Parameters:** `Byte` cell_x, `Byte` cell_y, `Byte` tile_id
- **Usage count:** 24

##### What it does

```asm
code_00B044 {
    TYX
    PHD
    STZ $0000                 ; flag: write both $7EA000 and $7FA000
    LDY $095E
    CPY #$0080
    BCS yield                 ; BG queue full → retry next tick
    JSR $&code_00E510         ; cell_x → pixels (signed×16)
    STA $0014                 ; absolute map X (not actor-relative)
    JSR $&code_00E510         ; cell_y → pixels
    STA $0018
    BRA loc_00B086            ; read tile_id, JSL code_0AF5A4
}
```

`code_0AF5A4` (with `$0000=0`):

1. Index from `$14`/`$18` via `code_0AF4E5`
2. `STA $7EA000,X` ← tile id
3. Table lookup → `STA $7FA000,X` (collision attr for that tile)
4. If on-screen, enqueue a BG rewrite record and `STY $095E` (advance queue cursor)

##### Yield when busy

If `$095E ≥ #$80`, the handler rewinds to the hardware `COP` opcode (`DEC $2C`×2 → `$28`) and `RTL`s. Next actor tick re-issues the same `[4C]` once the NMI drain lowers the queue (`chunk_0B8000` clears `$095E` when idle).

##### Why / how used

Scripted map edits at **fixed room coordinates** — doors opening, switches flipping plaque tiles, cutscene scenery:

```asm
; mansion exterior — swap tile at (17,24): FC → FD
COP [4C] ( #17, #24, #FC )
…
COP [4C] ( #17, #24, #FD )

; puzzle state A vs B (two cells each)
COP [4C] ( #23, #22, #F0 )
COP [4C] ( #07, #12, #F4 )
; …
COP [4C] ( #23, #22, #F1 )
COP [4C] ( #07, #12, #F5 )
```

| Item | Value |
|------|-------|
| Suggested alias | `set_tile #cx, #cy, #id` |
| Coordinates | Absolute **cells** (×16 → pixels in `$14`/`$18`) |
| Side effects | `$7EA000` + `$7FA000` + optional BG queue |

- **JSR/JSL:** `code_00E510`, `code_0AF5A4`
- **Source examples:**
  - `prinkys_mansion/mansion_exterior/actor_06DA20.asm:9,14` — `#17,#24,#FC/#FD`
  - `prinkys_mansion/actor_06C227.asm:28-29,37-38` — dual-cell state swap
  - `native_village/shaman_house/actor_07D621.asm:20,29` — `#1B,#16,#F5`
  - `rococo/police_station/actor_05CE3A.asm:111` — `#0B,#0B,#FC`

#### COP [4D] — `set_tile_at` (write tile id at actor + cell offset)

- **Confidence:** high
- **Preferred name:** `set_tile_at`
- **Aliases:** `paint_tile_rel`, `set_metatile_at`, `write_dp_word` (old misnomer)
- **Handler:** `code_00B05F` @ `extracted/system/chunk_008000.asm:6725-6769` → same `loc_00B086` / `code_0AF5A4`
- **Parameters (assembler):** `Byte` dx, `Word` packed — see encoding below
- **Parameters (runtime):** `Byte` dx, `Byte` dy, `Byte` tile_id
- **Usage count:** 84

##### Operand packing

The handler reads **three bytes** via two `code_00E510` calls + one `LDA [$2C]`; the `Byte, Word` operand layout packs `dy` (low) + `tile_id` (high) into the Word:

| Assembler form | Stream bytes | Runtime |
|----------------|--------------|---------|
| `COP [4D] ( #dx, #$TTdd )` | `dx`, `dd`, `TT` | dx, dy=`dd`, tile=`TT` |

Word little-endian: **low = dy**, **high = tile_id**.

Examples:

| Call | dx | dy | tile |
|------|----|----|------|
| `( #00, #$F900 )` | 0 | 0 | `$F9` |
| `( #00, #$FD01 )` | 0 | +1 | `$FD` |
| `( #00, #$FDFE )` | 0 | −2 | `$FD` |
| `( #00, #$FDFF )` | 0 | −1 | `$FD` |

dx is almost always `#00` (79/84); rare `#01`/`#02`/`#FA`.

##### What it does

```asm
code_00B05F {
    TYX
    PHD
    STZ $0000                 ; full write (same as [4C])
  loc_00B064:
    LDY $095E
    CPY #$0080
    BCS yield
    JSR $&code_00E510         ; dx
    CLC
    ADC $00
    SEC
    SBC #$0008
    STA $0014                 ; actor-relative cell X
    JSR $&code_00E510         ; dy (low byte of Word)
    CLC
    ADC $02
    SEC
    SBC #$0010
    STA $0018
  loc_00B086:
    LDA [$2C]                 ; tile id (high byte of Word)
    INC $2C
    AND #$00FF
    PHA
    LDA #$0000
    TCD
    PLA
    JSL $@code_0AF5A4
    PLD
    LDA $2C
    STA $02, S
    RTI
}
```

Same yield-on-full-queue behavior as `[4C]`.

##### Why / how used

Change the tile **under / beside the actor** after a trigger — often the write twin of a `[4A]`/`[4B]` watch:

```asm
; after detecting tile $F9 underfoot ([4A]), rewrite it
COP [4A] ( #F9, &hit )
…
hit:
    COP [4D] ( #00, #$F900 )          ; set_tile_at (0,0) = $F9 (or swap to neighbor id)

; player interact: rewrite cell above
COP [4D] ( #00, #$FDFF )              ; dy=-1, tile=$FD
```

Top packed words: `#$F100`, `#$F000`, `#$FD00`, `#$FDFF`, `#$F900`, `#$EAFF`, `#$F9FF`.

| Item | Value |
|------|-------|
| Suggested alias | `set_tile_at #dx, #dy, #id` (logical) / `COP [4D] ( #dx, #$id_dy )` (asm) |
| vs `[4C]` | Actor-relative vs absolute cells |
| Queue | Same `$095E` gate |

- **Source examples:**
  - `prinkys_mansion/mansion_exterior/actor_06CFF1.asm:24` — `#$F900` after `[4A] #F9`
  - `system/actor_04BADE.asm:42` — `#$E800` after tile-id branches
  - `fathers_house/fathers_yard/actor_078546.asm:19` — `#$FD01`
  - `credits/credits_fortress/actor_04D9E8.asm:8` — `#$FDFE`
  - `system/chunk_0B8000.asm:10938+` — player `#$FDFF` / `#$F5FF` / `#$F9FF`

##### Family summary (`[4A]`–`[4F]` tile id)

| Op | Name | `$7EA000` | Position |
|----|------|-----------|----------|
| `[4A]` | `branch_if_tile` | read / compare | actor cell |
| `[4B]` | `branch_if_tile_at` | read / compare | actor + Δcell |
| `[4C]` | `set_tile` | **write** + gfx + collision | absolute cell XY |
| `[4D]` | `set_tile_at` | **write** + gfx + collision | actor + Δcell |
| `[4E]` | `draw_tile_at` | unchanged; gfx + collision only | actor + Δcell |
| `[4F]` | `refresh_tile_at` | read id → gfx + collision (no write) | actor + Δcell |

`code_0AF5A4` flag at absolute `$0000`: `0` = also store id; `1` = draw/refresh only; `2` = force enqueue even if off-screen.

#### COP [4E] — `draw_tile_at` (blit tile gfx/collision at offset; keep id)

- **Confidence:** high (handler + `code_0AF5A4` flag path + sole call-site)
- **Preferred name:** `draw_tile_at`
- **Aliases:** `blit_tile_at`, `paint_tile_gfx_at`, `cop_4e` (old stub)
- **Handler:** `code_00B0A7` @ `extracted/system/chunk_008000.asm:6772-6777` → `loc_00B064` / `code_0AF5A4`
- **Parameters:** `Byte` dx, `Byte` dy, `Byte` tile_id — **three plain bytes** (not `[4D]`’s packed Word)
- **Usage count:** 6 (all in one actor)

##### What it does

```asm
code_00B0A7 {
    TYX
    PHD
    LDA #$0001
    STA $0000                 ; ★ flag: skip STA $7EA000
    BRA loc_00B064            ; same actor-relative path as [4D]
}
```

Runtime position math matches `[4D]` (signed cell Δ via `code_00E510`→`E517`, then tile byte → `code_0AF5A4`). Difference is only the `$0000` flag:

| `$0000` | `[4D]` (`0`) | `[4E]` (`1`) |
|---------|--------------|--------------|
| `$7EA000` | written | **left alone** |
| Metatile gfx (`$7E2000 + id×8`) | queued | queued |
| Collision (`$7FA000` from id table) | written | written |
| BG queue / `$095E` yield | yes | yes |

So the cell **looks and collides** like `tile_id`, but `[4A]`/`[4B]` still see the previous id in `$7EA000`.

##### Why / how used

Only site: mansion east library bookcase reveal — a 3×2 block of metatiles relative to the actor:

```asm
; actor_06D07D — after input unlock
COP [41] ( #10 )
COP [4E] ( #FC, #03, #E0 )    ; (−4,+3) draw $E0
COP [4E] ( #FD, #03, #E1 )
COP [4E] ( #FE, #03, #E2 )
COP [4E] ( #FC, #04, #E5 )    ; (−4,+4) …
COP [4E] ( #FD, #04, #E6 )
COP [4E] ( #FE, #04, #E7 )
COP [0A] ( #$8180 )
```

Likely intentional: change appearance/collision of the shelf wall without retargeting any tile-id triggers keyed to the old `$7EA000` values.

| Item | Value |
|------|-------|
| Suggested alias | `draw_tile_at #dx, #dy, #id` |
| vs `[4D]` | Same geometry; does **not** update `$7EA000`; asm uses 3×`Byte` not packed Word |
| Queue | Same `$095E ≥ $80` yield as `[4C]`/`[4D]` |

- **Source examples:**
  - `prinkys_mansion/mansion_east_library/actor_06D07D.asm:19-24` — all six uses

#### COP [4F] — `refresh_tile_at` (redraw from current `$7EA000` id)

- **Confidence:** high (handler unambiguous; **0** script sites)
- **Preferred name:** `refresh_tile_at`
- **Aliases:** `redraw_tile_at`, `yield_halt` (old misnomer)
- **Handler:** `code_00B0B1` @ `extracted/system/chunk_008000.asm:6780-6828`
- **Parameters:** `Byte` dx, `Byte` dy — **no** tile-id operand (reads `$7EA000`)
- **Usage count:** 0

##### What it does

```asm
code_00B0B1 {
    TYX
    PHX
    PHD
    LDA #$0001
    STA $0000                 ; draw/refresh only (no id write)
    LDY $095E
    CPY #$0080
    BCS yield
    JSR $&code_00E510         ; dx → $14 / $34
    CLC
    ADC $00
    SEC
    SBC #$0008
    STA $0014
    STA $34
    JSR $&code_00E510         ; dy → $18 / $36
    …
    JSL $@code_0AF4B6
    LDA $7EA000, X            ; ★ current id at that cell
    REP #$20
    AND #$00FF
    PHA
    LDA #$0000
    TCD
    PLA
    JSL $@code_0AF5A4         ; re-queue gfx + rewrite collision from that id
    …
}
```

Re-applies metatile graphics and collision for whatever id is already stored — useful after external corruption of `$7FA000` / VRAM, or to force a BG refresh without changing logic id. Same queue-full yield (`DEC×2` → `$28`).

##### Why unused

- No `COP [4F]` under `extracted/**/*.asm`
- Scripts that need a redraw either re-`[4D]`/`[4C]` or use `[4E]` with an explicit id

| Item | Value |
|------|-------|
| Suggested alias | `refresh_tile_at #dx, #dy` |

##### Family note (`[4C]`–`[4F]` write modes)

| Op | Abs / rel | Writes `$7EA000`? | Tile id source |
|----|-----------|-------------------|----------------|
| `[4C]` | absolute cells | yes | operand |
| `[4D]` | actor + Δ | yes | operand (Word-packed) |
| `[4E]` | actor + Δ | **no** | operand (3× Byte) |
| `[4F]` | actor + Δ | no | existing `$7EA000` |
| `[50]` | scan rect (multi-frame) | no (refresh only) | existing `$7EA000` per cell |

#### COP [50] — `redraw_tile_rows` (cooperative metatile strip redraw)

- **Confidence:** high (handler + `$095E` / `0AF5A4` / call-site audit)
- **Preferred name:** `redraw_tile_rows`
- **Aliases:** `scan_redraw_tiles`, `blit_tile_strip`, `anim_frame_table` (old misnomer)
- **Handler:** `code_00B109` @ `extracted/system/chunk_008000.asm:6830-6909`
- **Parameters:** `Byte` row_limit, `Byte` width_m1, `Byte` x0, `Byte` y0, `Byte` x1, `Byte` y1 — last four are signed cells via `code_00E510`
- **Usage count:** 128

##### What it does

Multi-frame scan that re-blits existing `$7EA000` ids through `code_0AF5A4` / `code_0AF514`, one horizontal strip per actor tick.

1. If `$095E ≥ #$80` (BG queue busy): rewind `$28` to the `COP #$50` instruction (`$2C - 2`) and yield (`PLA PLA RTL`).
2. Read `row_limit`. If `row_limit < $30`, skip the remaining 5 operands and finish (scan complete).
3. Else read `width_m1` → `$000C`, then four signed cell offsets:
   - `E510` → `$34` (strip origin X)
   - `E510 + $30` → `$36` (origin Y = offset + row cursor)
   - `JSL code_0AF4B6` → tile index in X / `$0002`
   - `E510` → `$0014`, `E510 + $30` → `$0018` (row extent temps for the blit helpers)
4. Loop `width_m1 + 1` times: `LDA $7EA000,X` → `JSL code_0AF5A4` (refresh gfx/collision), `JSL code_0AF514` (next cell), `$14 += #$10`.
5. `$30 += #$10` (advance one metatile row); rewind `$28` by **8** (2-byte `COP` + 6 operands) and yield so the next tick continues the scan.

```asm
code_00B109 {
    TYX
    LDY $095E
    CPY #$0080
    BCS yield_busy
    LDA [$2C]                ; row_limit
    INC $2C
    AND #$00FF
    CMP $30
    BCS do_row
    ; done — skip 5 operands, continue
    …
  do_row:
    ; width, four E510 corners, loop 0AF5A4/0AF514
    LDA $30
    CLC
    ADC #$0010
    STA $30
    LDA $2C
    SEC
    SBC #$0008               ; back to COP #$50
    STA $28
    PLA : PLA : RTL
}
```

##### Authoring model

```asm
    STZ $30
    COP [50] ( #00, #00, #03, #1F, #17, #16 )   ; one row (limit #00)
    ; or
    STZ $30
    COP [50] ( #30, #04, #26, #30, #1D, #18 )   ; rows while $30 ≤ #$30
```

| `row_limit` (first byte) | Rows when starting `$30=0` |
|--------------------------|----------------------------|
| `#00` | 1 (`$30`: 0 → 16, then stop) |
| `#10` | 2 |
| `#20` | 3 |
| `#30` | 4 |
| `#40` | 5 |

First-operand histogram in source: `#00` (40), `#30` (28), `#10` (22), `#40` (17), `#50` (11), `#20` (9).

##### Why / how used

Force a region of the map to re-draw from `$7EA000` after flags / switches change collision or after layered door/wall updates — without rewriting tile ids. Often paired as two strips (different X spans) with `STZ $30` before each.

| Item | Value |
|------|-------|
| Suggested alias | `redraw_tile_rows #limit, #w-1, #x0, #y0, #x1, #y1` |
| Yields | queue busy **or** after each row |
| vs `[4E]` / `[4F]` | whole strip over frames; `[4E]`/`[4F]` are one-shot cells |

- **WRAM:** `$30`, `$095E`, `$34`, `$36`, `$000C`, `$0014`, `$0018`, `$28`, `$7EA000`
- **JSR / JSL:** `code_00E510`, `code_0AF4B6`, `code_0AF514`, `code_0AF5A4`
- **Source examples:**
  - `fathers_house/fathers_yard/actor_0787B0.asm:18` — `#00,#00,#03,#1F,#17,#16`
  - `prinkys_mansion/actor_06C370.asm:10` — `#00,#02,#0D,#32,#02,#26`
  - `prinkys_mansion/actor_06C370.asm:12` — paired second strip after `STZ $30`
