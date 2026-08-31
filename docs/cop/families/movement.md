# COP family: Movement / walk steps

_Deep-audited ops: `[51]`, `[52]`, `[53]`, `[54]`, `[55]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

Scripted actor locomotion: aim at a target cell (`[53]` / `[54]` / `[55]`), then run the shared **step bracket** (`[51]` begin → wait anim → `[52]` end). Wander (`[28]` / `[29]`) feeds the same `$0C` / `$1C` / `$1E` state and also ends with `[51]` / `[98]` / `[52]`.

These are among the hottest opcodes in the game (`[51]` / `[52]` ≈ 662 uses each).

## Shared state

- `$0C` — facing / step direction in bits 0–1; **bit15 (`#$8000`)** = step in progress (set by `[51]`, required by `[52]`)
- `$1C` / `$1E` — X / Y step velocity (from `code_00E398` → `unk29_list_01C3B9`)
- `$00` / `$02` — actor sprite X / Y
- `$7F0012,X` / `$7F0014,X` — footprint W/H (also temps during the step)
- `$7F000C,X` — animation id written by walk setup
- `$10` — cleared when a walk packet arms a step
- `code_00E510` / `E517` — read signed cell → pixels (`E510` falls into `E517`)
- `code_00E257` — paint solid **on** at destination (`[51]`)
- `code_00E2D2` — clear actor-solid nibble at footprint (`[52]`)

### Facing / `$0C` low bits

| `$0C & 3` | Meaning | Set by |
|-----------|---------|--------|
| `#00` | down (+Y) | `[54]` when target below |
| `#01` | up (−Y) | `[54]` when target above |
| `#02` | left (−X) | `[53]` when target left |
| `#03` | right (+X) | `[53]` when target right |

Same encoding as wander `[28]` / `[29]`.

### Script encoding note

The COP dispatcher (`code_009EE8`) backs up one byte from the 65816 return PC so `$2C` points at the **opcode byte** of a 2-byte `COP #$nn` instruction. Arrival skips of **+8** therefore mean eight script bytes = three follow-up `COP`s (2 bytes each) + a `BRA` (2 bytes).

## Family notes

- Canonical axis walk: `COP [53|54] (…) / [51] / [97|98] / [52] / BRA` until the walk op sees “arrived” and skips that 8-byte epilogue.
- `[55]` is self-clocking (rewinds to itself via `$28`) and usually pairs with **only** `[97]` — no `[51]` / `[52]`.
- Do **not** merge with tracked-id ops `[56]` / `[57]` (adjacent in the jump table only).
- Wander `[28]`–`[2A]` remains a separate family (random rect + profile); it **consumes** this family’s step bracket.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `51` | `step_begin` | 662 | high | (none) | `code_00B19D` |
| `52` | `step_end` | 662 | high | (none) | `code_00B20E` |
| `53` | `walk_to_x` | 202 | high | Byte×3 | `code_00B27B` |
| `54` | `walk_to_y` | 281 | high | Byte×3 | `code_00B2EC` |
| `55` | `walk_seeks` | 44 | high | Byte×4 | `code_00B341` |

**Family call-site total:** 1851

## Opcodes

#### COP [51] — `step_begin` (occupy destination; arm bit15)

- **Confidence:** high (handler + pairing audit with `[52]` / wander)
- **Preferred name:** `step_begin`
- **Aliases:** `step_toward_target`, `apply_step`, `start_step`
- **Handler:** `code_00B19D` @ `extracted/system/chunk_008000.asm:6911-6976`
- **Parameters:** none
- **Usage count:** 662

##### What it does

1. If `$1C|$1E == 0` (no velocity), fall through: set `$28 = $2C` and continue.
2. Else push `$7F0012/14`, then branch on `$0C & 3`:
   - **right (`3`)**: `code_00E34D` → add to `$00` → `$34`; `$36 = $02`; force `$7F0012 = 1`
   - **left (`2`)**: same helper, negate → `$34`
   - **down (`0`)**: `$7F0014` via `code_00E517` added to `$02` → `$36`; `$34 = $00`
   - **up (`1`)**: `$36 = $02 + #$FFF0` (−16)
3. `JSR code_00E257` — mark destination cell(s) solid (`$7FA000 |= #$F0`).
4. `TSB $0C` with `#$8000` — arm “step in progress”.
5. Restore footprint words; set `$28 = $2C`; `RTI` into the next script byte (usually `COP [97]` / `[98]`).

```asm
code_00B19D {
    TYX
    LDA $1C
    ORA $1E
    BEQ skip_move
    ; …save footprint, compute $34/$36 from $0C&3…
    JSR $&code_00E257          ; solid_on at destination
    LDA #$8000
    TSB $0C                    ; step pending
    ; …restore footprint…
  skip_move:
    LDA $2C
    STA $28
    STA $02, S
    RTI
}
```

##### Why / how used

Always the first half of the step bracket after a walk/wander setup:

```asm
    COP [54] ( #0C, #01, #28 )   ; aim at cell Y
    COP [51]                     ; step_begin
    COP [97]                     ; wait anim frame(s)
    COP [52]                     ; step_end
    BRA loop
```

| Item | Value |
|------|-------|
| Suggested alias | `step_begin` |
| Pairs with | `[52]` (required to clear bit15 / solid) |
| No-op when | `$1C=$1E=0` (wander bounce / idle) |

- **WRAM:** `$0C`, `$1C`, `$1E`, `$00`, `$02`, `$34`, `$36`, `$28`
- **Actor RAM:** `$7F0012`, `$7F0014`
- **JSR:** `code_00E257`, `code_00E34D`, `code_00E517`
- **Source examples:**
  - `credits/credits_cafeteria/actor_04D48A.asm:14`
  - `system/actor_05A9DD.asm:35` — after wander `[28]`
  - `prinkys_mansion/actor_06E420.asm:47`

#### COP [52] — `step_end` (clear bit15; vacate / finish move)

- **Confidence:** high
- **Preferred name:** `step_end`
- **Aliases:** `step_toward_target_alt`, `finish_step`, `end_step`
- **Handler:** `code_00B20E` @ `extracted/system/chunk_008000.asm:6978-7041`
- **Parameters:** none
- **Usage count:** 662

##### What it does

1. If `$0C` bit15 clear (`BPL`), do nothing — continue.
2. Clear bit15 (`AND #$7FFF`).
3. Recompute destination `$34` / `$36` from facing (same `$0C&3` cases as `[51]`, with up/down temp swapped onto `$7F0014`).
4. `JSR code_00E2D2` — strip actor-solid nibble (`$7FA000 &= #$0F`) at the footprint.
5. Restore footprint; `RTI` to next opcode (often `BRA` back to walk/wander).

```asm
code_00B20E {
    TYX
    LDA $0C
    BPL done                   ; not armed → no-op
    ; clear #$8000, recompute $34/$36, …
    JSR $&code_00E2D2          ; clear solid nibble
    ; restore $7F0012/14
  done:
    LDA $2C
    STA $02, S
    RTI
}
```

##### Why / how used

Second half of every step bracket. Harmless if `[51]` was a no-op (bit15 never set).

| Item | Value |
|------|-------|
| Suggested alias | `step_end` |
| Requires | `[51]` having set `$0C` bit15 for a real step |
| vs `[51]` | begin paints solid via `E257`; end clears via `E2D2` |

- **WRAM:** `$0C`, `$00`, `$02`, `$34`, `$36`
- **JSR:** `code_00E2D2`, `code_00E34D`, `code_00E517`
- **Source examples:** same sites as `[51]` (+2 lines)

#### COP [53] — `walk_to_x` (horizontal walk packet)

- **Confidence:** high
- **Preferred name:** `walk_to_x`
- **Aliases:** `walk_horizontal`, `move_to_cell_x`
- **Handler:** `code_00B27B` @ `extracted/system/chunk_008000.asm:7043-7104`
- **Parameters:** `Byte` anim, `Byte` step_index, `Byte` target_cell_x
- **Usage count:** 202

##### What it does

1. Read anim → `$32`, step index → `$30`.
2. `code_00E510` reads target cell X → pixels; compare `A+8` to sprite `$00`.
3. **If equal (arrived):** if anim bit7 set, skip +4 script bytes; then skip **+8** more (standard `[51]` / wait / `[52]` / `BRA` epilogue) and continue past the walk loop.
4. **If not arrived:** pick facing `#02` (left) or `#03` (right); optionally nudge anim / `$30` for parity; write `$7F000C = anim & #$FF7F`; `STY $0C`; `STZ $10`; `code_00E398(step_index) → $1C`; continue into `[51]` same tick.

```asm
; operands: #anim, #step, #target_x_cell
COP [53] ( #0F, #01, #12 )
COP [51]
COP [97]
COP [52]
BRA loop          ; [53] skips these 8 bytes once X matches
```

##### Operand notes

| Op | Role |
|----|------|
| anim | Stored to `$7F000C` (bit7 = longer skip-on-arrive); common `#07`, `#0F`, `#0B` |
| step_index | Velocity table index via `code_00E398`; bit0 participates in left/right anim parity |
| target_cell_x | Absolute map cell X |

| Item | Value |
|------|-------|
| Suggested alias | `walk_to_x #anim, #step, #cell_x` |
| Arrived skip | +8 (+4 if anim bit7) from post-operand PC |
| Sets | `$0C` facing, `$1C` velocity, `$7F000C` anim |

- **Source examples:**
  - `credits/credits_cafeteria/actor_04D48A.asm:20` — `#0F,#01,#12`
  - `system/actor_05A9DD.asm:70` — `#07,#11,#07`
  - `prinkys_mansion/actor_06E420.asm:56` — `#07,#01,#09`

#### COP [54] — `walk_to_y` (vertical walk packet)

- **Confidence:** high
- **Preferred name:** `walk_to_y`
- **Aliases:** `walk_vertical`, `move_to_cell_y`
- **Handler:** `code_00B2EC` @ `extracted/system/chunk_008000.asm:7106-7149`
- **Parameters:** `Byte` anim, `Byte` step_index, `Byte` target_cell_y
- **Usage count:** 281

##### What it does

Same structure as `[53]`, but:

- Compares `E510(target)` to sprite `$02` (no +8 bias).
- Facing `#01` (up) / `#00` (down).
- Velocity lands in **`$1E`** (not `$1C`).
- Shares the arrived label `loc_00B2D4` with `[53]` (same +8 / +4 skip).

```asm
COP [54] ( #0C, #01, #28 )
COP [51]
COP [97]
COP [52]
BRA loop
```

| Item | Value |
|------|-------|
| Suggested alias | `walk_to_y #anim, #step, #cell_y` |
| vs `[53]` | Y axis; velocity → `$1E`; facing 0/1 |

- **Source examples:**
  - `credits/credits_cafeteria/actor_04D48A.asm:13` — `#0C,#01,#28`
  - `system/actor_0589D9.asm:76` — `#04,#01,#30`
  - `ocean/eatern_hut/actor_0C9D46.asm:35` — `#08,#01,#2C`

#### COP [55] — `walk_seeks` (multi-phase seek along two facings)

- **Confidence:** high (handler state machine + call-site patterns)
- **Preferred name:** `walk_seeks`
- **Aliases:** `walk_diagonal`, `walk_path`, `seek_dirs`
- **Handler:** `code_00B341` @ `extracted/system/chunk_008000.asm:7151-7274` (+ helpers `code_00B428` / `B438`)
- **Parameters:** `Byte` dir_a, `Byte` dir_b, `Byte` anim_base, `Byte` step_index
- **Usage count:** 44

##### What it does

A **re-entrant** walker. Scripts `STZ $30` then loop:

```asm
    STZ $30
  loop:
    COP [55] ( #00, #02, #04, #11 )   ; dirs + anim + step
    COP [97]
    BRA loop
```

Handler phases (actor `$30` as phase counter; also uses `$20`, `$06` bit3):

1. Snapshot sprite → cell-ish `$34` / `$36` (−8 / −16).
2. While `$30 == 0`, probe `dir_a` via `code_00B438` (dispatches to collision walk trials `code_00E045` / `DF84` / `DDF4` / `DEB5`). Failure → skip packet (`code_00B428` → `code_009F07`).
3. Read four operands; may flip `dir_b` and `TSB $06,#$0008` if the alternate probe is blocked.
4. Across yields, alternate applying `dir_a` / `dir_b`: set `$7F000C = anim_base + dir`, bump step index for diagonal facings, `code_00E398` → `$1C` or `$1E`, clear `$10`, **rewind `$28 = $2C`** so the next tick re-enters `[55]`.
5. When the phase counter finishes (`loc_00B430`), `TRB $06,#$0008` and skip ahead with `code_009F07`.

`code_00B438` preserves `$30` / `$32` across the collision probe.

##### Operand notes

| Op | Role | Common values |
|----|------|----------------|
| dir_a / dir_b | Facing 0..3 for the two seek legs | `#00/#02`, `#00/#03`, `#03/#00` |
| anim_base | Added to facing for `$7F000C` | `#04`, `#08`, `#10` |
| step_index | Velocity band (`E398`); low bit often `#01` / `#11` | `#01`, `#11` |

| Item | Value |
|------|-------|
| Suggested alias | `walk_seeks #dir_a, #dir_b, #anim, #step` |
| vs `[53]` / `[54]` | No `[51]` / `[52]`; self-yields; two-direction seek |
| Init | Caller must `STZ $30` before first enter |

- **WRAM:** `$30`, `$20`, `$06`, `$34`, `$36`, `$1C`, `$1E`, `$10`, `$28`, `$32`
- **JSR:** `code_00B438`, `code_00E398`
- **Source examples:**
  - `system/actor_05A9DD.asm:58` — `#00,#02,#04,#11`
  - `credits/credits_family/actor_04D09A.asm:21` — `#01,#03,#08,#01`
  - `ocean/eatern_hut/actor_0C9D46.asm:30` — `#00,#02,#08,#01`
