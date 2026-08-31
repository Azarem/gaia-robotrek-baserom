# COP family: Collision / solid

_Deep-audited ops: `[44]`, `[45]`, `[46]`, `[47]`, `[48]`, `[49]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Occupy or vacate cells in `$7FA000`, and probe terrain / blocked state. High nibble `#$F0` = actor solid; low nibble = terrain type.

## Shared state

- `$7FA000` — collision / occupancy map
- `code_0AF4B6` — pixel XY → cell index
- `code_00E510`→`E517` — signed cell offsets ×16
- `$7F0012`/`$14` — footprint W/H when sum ≥ 3
- `[48]`/`[49]` leave results in `$30`

## Family notes

- `[48]`/`[49]` were formerly misnamed as solid painters — they **probe** only.
- `[48]` ignores actor solid bits; `[49]` treats them as blocked.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `44` | `solid_on` | 453 | high | (none) | `code_00AF56` |
| `45` | `solid_off` | 213 | high | (none) | `code_00AF67` |
| `46` | `solid_on_at` | 145 | high | Byte, Byte (signed cells) | `code_00AF78` |
| `47` | `solid_off_at` | 82 | high | Byte, Byte (signed cells) | `code_00AF91` |
| `48` | `sample_tile_at` | 3 | high | Byte, Byte (signed cells) | `code_00AFAA` |
| `49` | `probe_blocked` | 9 | high | (none) | `code_00AFC3` |

**Family call-site total:** 905

## Opcodes

#### COP [44] — `solid_on` (mark actor footprint occupied)

- **Confidence:** high (handler + `$7FA000` walkthrough + call-site audit)
- **Preferred name:** `solid_on`
- **Aliases:** `occupy_tile`, `set_collision`, `mark_solid`
- **Handler:** `code_00AF56` @ `extracted/system/chunk_008000.asm:6559-6568` → `code_00E257`
- **Parameters:** (none)
- **Usage count:** 453

##### What it does

```asm
code_00AF56 {
    TYX
    LDA $00
    STA $34                   ; sprite X
    LDA $02
    STA $36                   ; sprite Y
    JSR $&code_00E257         ; paint hi nibble #$F0 into $7FA000
    LDA $2C
    STA $02, S
    RTI
}
```

`code_00E257` converts sprite XY → collision index via `code_0AF4B6` (subtracts `#8`/`#16` to cell origin), then:

| Footprint | Condition | Effect |
|-----------|-----------|--------|
| **Single tile** | `$7F0012+$7F0014 < 3` | `ORA #$F0` on one `$7FA000` entry |
| **Multi-tile** | sum `≥ 3` | Rectangle: W=`$7F0012`, H=`$7F0014`, origin offsets `$7F000E`/`$7F0010`; each cell `ORA #$00F0`, step with `code_08F479` |

High nibble `#$F0` = “an actor is standing here.” Low nibble (terrain type) is preserved.

##### Why / how used

Almost every talkable NPC / solid prop: claim the cell so the player cannot walk through.

```asm
COP [17] ( #07, #26, #00 )    ; teleport
COP [44]                      ; occupy new cell
COP [22] ( &on_talk )
```

Often paired with `[45]` when leaving / recruiting / vanishing (110 files use both). After `[17]` teleport, **43/127** sites put `[44]` on the next line.

| Item | Value |
|------|-------|
| Suggested alias | `solid_on` |
| Buffer | `$7FA000` (hi nibble) |
| Pairs with | `[45]` clear; `[17]` teleport |

- **JSR:** `code_00E257` → `code_0AF4B6`
- **Source examples:**
  - `fathers_house/actor_07A684.asm:21,45,49`
  - `fathers_house/chicken_farm/actor_07A575.asm:10,34`
  - `system/actor_0BD8F4.asm:39` — player host claims cell

#### COP [45] — `solid_off` (clear actor footprint occupancy)

- **Confidence:** high
- **Preferred name:** `solid_off`
- **Aliases:** `vacate_tile`, `clear_collision`, `unmark_solid`
- **Handler:** `code_00AF67` @ `extracted/system/chunk_008000.asm:6571-6580` → `code_00E2D2`
- **Parameters:** (none)
- **Usage count:** 213

##### What it does

Same XY setup as `[44]`, then `code_00E2D2`:

```asm
; single-tile path
LDA $7FA000, X
AND #$0F                  ; clear hi nibble only
STA $7FA000, X
```

Multi-tile path uses `AND #$FF0F` across the footprint rectangle. Terrain low nibble unchanged.

##### Why / how used

Before moving, despawning, or joining the party (follower claim clears interact + often `[45]`):

```asm
COP [45]                  ; leave old cell walkable
COP [2B] ( #$80xx, &join )
…
COP [44]                  ; re-occupy after settle
```

Credits puppets and cutscene actors spam `[45]` when sprites leave the stage.

| Item | Value |
|------|-------|
| Suggested alias | `solid_off` |
| Inverse of | `[44]` |

- **JSR:** `code_00E2D2` → `code_0AF4B6`
- **Source examples:**
  - `fathers_house/actor_07A684.asm:32`
  - `fathers_house/chicken_farm/actor_07A575.asm:23`
  - `credits/credits_family/actor_04D09A.asm:17,35`
  - `system/actor_0BD8F4.asm:64` — clear when terrain says water/special

#### COP [46] — `solid_on_at` (occupy cell at signed offset)

- **Confidence:** high
- **Preferred name:** `solid_on_at`
- **Aliases:** `solid_at_offset`, `occupy_offset`
- **Handler:** `code_00AF78` @ `extracted/system/chunk_008000.asm:6583-6597` → `code_00E257`
- **Parameters:** `Byte` dx, `Byte` dy — **signed cell deltas**
- **Usage count:** 145

##### What it does

```asm
code_00AF78 {
    TYX
    JSR $&code_00E510         ; read Byte; fall into E517
    CLC
    ADC $00
    STA $34                   ; X + dx*16
    JSR $&code_00E510
    CLC
    ADC $02
    STA $36                   ; Y + dy*16
    JSR $&code_00E257         ; same paint as [44]
    …
}
```

`code_00E510` has **no `RTS`** — it falls into `code_00E517`, which sign-extends bit7 and `ASL×4` (cell → pixel). So `#FF` = −1 cell, `#FE` = −2, `#01` = +1.

##### Why / how used

Block a **row/area** around a director without moving the actor. Shaman altar barrier:

```asm
COP [46] ( #FE, #00 )     ; x-2
COP [46] ( #FF, #00 )
COP [46] ( #00, #00 )
COP [46] ( #01, #00 )
COP [46] ( #02, #00 )     ; five-cell wide wall
```

Top offsets: `(#01,#00)`, `(#FF,#00)`, `(#00,#01)`, `(#00,#FF)`, diagonals, `(#00,#00)`.

| Item | Value |
|------|-------|
| Suggested alias | `solid_on_at #dx, #dy` |
| Units | Signed **cells** (not pixels) |

- **Source examples:**
  - `native_village/shaman_altar/actor_07D661.asm:9-13` — 5-wide barrier
  - Many doors / multi-cell props paint neighbors then `[44]` on self

#### COP [47] — `solid_off_at` (vacate cell at signed offset)

- **Confidence:** high
- **Preferred name:** `solid_off_at`
- **Aliases:** `solid_at_offset_alt` (old), `vacate_offset`
- **Handler:** `code_00AF91` @ `extracted/system/chunk_008000.asm:6599-6612` → `code_00E2D2`
- **Parameters:** `Byte` dx, `Byte` dy — same signed-cell encoding as `[46]`
- **Usage count:** 82

##### What it does

Identical offset math to `[46]`, then `code_00E2D2` (clear hi nibble) — the offset counterpart of `[45]`.

##### Why / how used

Clear previously painted neighbor cells (e.g. after a puzzle wall opens, or when a multi-tile object moves):

```asm
COP [47] ( #FF, #00 )
COP [47] ( #01, #00 )
COP [47] ( #00, #01 )
COP [47] ( #00, #FF )
```

| Item | Value |
|------|-------|
| Suggested alias | `solid_off_at #dx, #dy` |
| Inverse of | `[46]` |

- **Source examples:**
  - `prinkys_mansion/actor_06C370.asm:53-56` — clear 4-neighbors
  - `prinkys_mansion/mansion_towerB_lair/actor_06BE6E.asm:53` — `#00,#13`

#### COP [48] — `sample_tile_at` (read terrain type at offset → `$30`)

- **Confidence:** high (helper + all 3 call sites read `$30`)
- **Preferred name:** `sample_tile_at`
- **Aliases:** `read_collision`, `probe_terrain`, `solid_at_offset_alt2` (old misnomer — **does not paint**)
- **Handler:** `code_00AFAA` @ `extracted/system/chunk_008000.asm:6615-6628` → `code_00E114`
- **Parameters:** `Byte` dx, `Byte` dy — signed cells (same as `[46]`)
- **Usage count:** 3

##### What it does

Offset math like `[46]`, then `code_00E114` **reads** `$7FA000` (no `ORA`/`AND` paint):

```asm
; single-tile path (code_00E114)
LDA $7FA000, X
AND #$0F
STA $30                   ; terrain type
CMP #$0F
BEQ blocked               ; SEC if type == $F
; else CLC — $30 keeps type
```

Carry is **ignored** by the COP handler; scripts always `LDA $30` afterward.

Does **not** treat actor solid hi-nibble as blocking (unless the low nibble is already `$F`). Multi-tile actors scan the footprint and treat `$0F` / `code_08F479` failure as blocked.

##### Why / how used

Player host samples the tile underfoot to pick movement / water / special reactions:

```asm
; system/actor_0BD8F4.asm
COP [44]
COP [48] ( #00, #00 )
COP [C0] ( #FF )
LDA $30
STA $0BAC                 ; cache move mode from terrain
CMP #$000B                ; water-ish?
BEQ swim_anim
CMP #$0002
BEQ vacate_and_idle
```

Only three sites: `actor_0BD8F4` `(#00,#00)`, and two in `chunk_0B8000` (`(#00,#00)`, `(#00,#FF)` one cell above).

| Item | Value |
|------|-------|
| Suggested alias | `sample_tile_at #dx, #dy` |
| Output | `$30` = terrain low nibble |
| vs `[49]` | Ignores actor `#$F0` occupancy |

#### COP [49] — `probe_blocked` (test footprint blocked → `$30`)

- **Confidence:** high
- **Preferred name:** `probe_blocked`
- **Aliases:** `test_collision`, `collision_check`, `solid_refresh` (old misnomer — **does not refresh/paint**)
- **Handler:** `code_00AFC3` @ `extracted/system/chunk_008000.asm:6631-6640` → `code_00E1AD`
- **Parameters:** (none) — uses current `$00`/`$02`
- **Usage count:** 9

##### What it does

```asm
code_00AFC3 {
    TYX
    LDA $00
    STA $34
    LDA $02
    STA $36
    JSR $&code_00E1AD
    …
}
```

`code_00E1AD` (vs `[48]`’s `E114`):

```asm
LDA $7FA000, X
AND #$0F
STA $30
LDA $7FA000, X
BIT #$F0
BNE blocked               ; ★ actor solid counts
CMP #$0F
BEQ blocked
; free → CLC, $30 = terrain type
blocked:
LDA #$000F
STA $30                   ; unify “blocked” as $F
SEC
```

Again, COP ignores carry; scripts read `$30`.

##### Why / how used

Combat / projectile / step logic: “can I occupy here?”

```asm
; before claiming a cell
COP [49]
LDA $30
BEQ free_path             ; clear + terrain 0
; or:
CMP #$000F
BEQ blocked
COP [44]                  ; safe to occupy
```

All 9 sites immediately `LDA $30` (`BEQ` / `BNE` / `CMP #$000F`).

| Item | Value |
|------|-------|
| Suggested alias | `probe_blocked` |
| Output | `$30 = #$0F` if blocked (terrain `$F` **or** actor solid); else terrain type |
| vs `[48]` | Counts hi-nibble occupancy; no XY offset operands |

- **Source examples:**
  - `system/actor_02E9AA.asm:186` — combat actor gate
  - `system/actor_02EBB5.asm:181,255`
  - `system/actor_02EDE2.asm:128`
  - `system/chunk_038000.asm:5630,9993,11689,12862,14612`

##### Family summary (`[44]`–`[49]` collision)

| Op | Name | Writes `$7FA000`? | Result |
|----|------|-------------------|--------|
| `[44]` | `solid_on` | hi `#$F0` at actor | — |
| `[45]` | `solid_off` | clear hi at actor | — |
| `[46]` | `solid_on_at` | hi at actor+Δcell | — |
| `[47]` | `solid_off_at` | clear hi at actor+Δcell | — |
| `[48]` | `sample_tile_at` | no (read lo nibble) | `$30` = terrain |
| `[49]` | `probe_blocked` | no (read lo+hi) | `$30` = `$0F` if blocked |

Shared: `$34`/`$36` pixel probe point; `code_0AF4B6` index; footprint via `$7F0012`/`$14` (+ `$7F000E`/`$10` when large). Offset ops share `code_00E510`→`E517` (signed cell × 16).

> **Neighbor family:** `[4A]`/`[4B]` use the **same cell index** but read `$7EA000` (tile id), not `$7FA000` (collision).
