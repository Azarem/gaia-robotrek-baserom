# Player Idle / Interact (`[D7]`–`[D9]`)

Three opcodes that implement the player character's idle animation loop with built-in interaction detection. These are the core "wait for player to be interacted with" instructions used by the player host controller. All share `code_03CD92` (interact check) and `code_00CDFB` (player state update).

## Overview

| Op | Name | Operands | Interact flag | Idle anim | Uses |
|----|------|----------|---------------|-----------|-----:|
| `D7` | `player_idle_facing` | (none) | `$05CC` | 2/3 (facing) | 1 |
| `D8` | `player_idle` | (none) | `$05CE` | `$7F002C,X` | 58 |
| `D9` | `player_idle_base` | Byte | `$05CE` | Byte → `$7F002C,X` | 3 |

### Shared control flow

All three ops follow the same pattern:

1. **Clear** `$7F002C,X` (D7/D8) or **set** it from operand (D9)
2. **Back up** `$2C` by 2 → `$28` (re-execute point) and save to `$7F200E,X`/`$7F2010,X`
3. **Scene lock check**: if `$05D8 ≠ 0`, skip to idle animation
4. **Interact state check** via `$7F100C,X`:
   - **Nonzero** (interaction active): clear bit 0 of `$06`, check focus ID (`$05CA`) vs actor `$04`, clear interact flag (`$05CC` or `$05CE`), then set idle animation
   - **Zero** (no interaction): call `code_03CD92` to check for new interaction
5. **If interact triggered** (`code_03CD92` returns carry clear): set interact flag (`#$4000` in `$05CC`/`$05CE`), clear `$7F0028,X`, clear bits 3–4 of `$06`, save player position to `$7F1030,X`/`$7F1032,X`, call `code_00CDFB`, then **skip 4 bytes** past the COP
6. **If no interact**: set idle animation + continue (RTI loops back)

### Idle loop pattern

The standard usage is a tight loop:

```
code_XXXX:
    COP [D8]         ; idle + interact check
    COP [97]          ; wait_anim_done
    BRA code_XXXX     ; loop (re-enters D8 which re-checks)

  loc_interact:       ; 4 bytes past [D8] — entered when interact triggers
    ...               ; interaction handler code
```

The COP instruction re-executes each tick (via the backed-up `$28`) until an interaction occurs, at which point it skips forward into the inline interact handler.

---

## `[D7]` — `player_idle_facing`

Primary player idle with facing-dependent animation.

### Handler: `code_00CCF1`

```
TYX
LDA #$0000 : STA $7F002C,X       ; clear anim base
LDA $2C : DEC : DEC : STA $28    ; re-execute point
STA $7F200E,X : LDA $2A : STA $7F2010,X  ; save re-execute PC+bank

; Scene lock / interact check (same as D8)...

; Idle animation (facing-dependent):
LDY #$0002
LDA $0A : BIT #$4000             ; check facing
BNE skip : INY                   ; Y=2 (right) or Y=3 (left)
skip:
TYA : STA $7F000C,X : STZ $10   ; set animation ID 2 or 3
LDA $2C : STA $28 : STA $02,S : RTI

; Interact path:
JSL code_03CD92                   ; check interaction
BCS idle_anim                     ; carry set → no interact
LDA #$4000 : TSB $05CC           ; set interact flag in $05CC
LDA #$0000 : STA $7F0028,X      ; clear interact handler
LDA #$0018 : TRB $06
LDA $00 : STA $7F1030,X         ; save position
LDA $02 : STA $7F1032,X
JSR code_00CDFB                   ; player state update
LDA $2C : CLC : ADC #$0004       ; skip 4 bytes (to inline handler)
STA $02,S : RTI
```

### Key differences from D8

- Uses **`$05CC`** interact flag (vs `$05CE` for D8)
- Idle animation is **facing-dependent**: anim 2 (right) or 3 (left)
- Only **1 call site** — used in the primary player character controller

### Source example

| File | Call | Context |
|------|------|---------|
| `chunk_038000.asm:3716` | `COP [D7]` | Primary player idle loop |

---

## `[D8]` — `player_idle`

Secondary/party player idle with configurable animation base.

### Handler: `code_00CD6F`

Same structure as D7 but:
- Uses **`$05CE`** interact flag
- Idle animation = `#$0000 + $7F002C,X` (animation base offset, typically 0)
- **Decrements** `$7F100C,X` on the idle path (state counter)
- **Increments** `$7F100C,X` on the interact-check path (sets state to 1)

### Usage (58 sites)

The most common of the three. Used by party member actors (`actor_02E9AA`, `actor_02EDE2`, `actor_02EF9F`, `actor_02F1F3`, etc.) and extensively in `chunk_038000.asm` for various player controller states.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:14` | `COP [D8]` | Party member idle loop |
| `actor_02EF9F.asm:18` | `COP [D8]` | Party member idle loop |
| `chunk_038000.asm:9676` | `COP [D8]` | Player controller state |

---

## `[D9]` — `player_idle_base`

D8 with explicit animation base offset.

### Handler: `code_00CED6`

```
TYX
LDA [$2C] : INC $2C : AND #$00FF
STA $7F002C,X                     ; set animation base from operand
LDA $2C : DEC : DEC : DEC        ; back up PC by 3 (to COP instruction)
STA $28 : STA $7F200E,X
JMP code_00CD81                   ; enter D8's main body
```

The Byte operand sets the animation base (`$7F002C,X`), then execution falls through to D8's handler body at `code_00CD81`. The 3-byte backup accounts for the Byte operand that D8 doesn't have.

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte | 1 | Animation base offset → `$7F002C,X` |

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:210` | `COP [D9] ( #0A )` | Party member: anim base 10 |
| `chunk_038000.asm:10300` | `COP [D9] ( #09 )` | Player controller: anim base 9 |
| `chunk_038000.asm:11382` | `COP [D9] ( #01 )` | Player controller: anim base 1 |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `D7` | `player_idle_facing` | 1 |
| `D8` | `player_idle` | 58 |
| `D9` | `player_idle_base` | 3 |
| | **Total** | **62** |

## Helper functions

### `code_03CD92` — interact check

Checks whether the player should enter interaction mode:
- Tests `$05C8` (interact capability flags)
- Tests `$05CA` (current interact target — negative = special mode)
- On success: sets `$06 |= #$0001`, stores actor `$04` to `$05CA`, returns **carry clear**
- On failure: optionally sets `$04 | #$8000` into `$05CC`/`$05CE`, returns **carry set**

### `code_00CDFB` — player state update

Complex helper that manages player visual state through `$0A10,Y` and `$0A24,Y`:
- Decays animation counters (priority, palette fade, blink)
- Manages DMA slot allocation (`$0EE2`)
- Handles multiple bit-flag tiers in `$0A10,Y` (bits 0, 6, 8) and `$0A24,Y`
- On certain conditions, redirects execution to `code_03B8E1` (interact handler dispatch)

## Actor fields

| Field | Role | Modified by |
|-------|------|-------------|
| `$7F002C,X` | **Animation base offset** — added to computed anim ID. D7/D8 clear to 0; D9 sets from operand | D7, D8, D9 |
| `$7F200E,X` / `$7F2010,X` | **Re-execute PC / bank** — saved for re-entry on interaction cancel | D7, D8, D9 |
| `$7F100C,X` | **Interact state counter** — 0 = idle (check for interact); nonzero = interaction active (counting down) | D7, D8 |
| `$7F0028,X` | **Interact handler pointer** — cleared to 0 when interaction starts | D7, D8 |
| `$7F1030,X` / `$7F1032,X` | **Saved player position** — X/Y coords at interaction start | D7, D8 |

## WRAM addresses

| Address | Role |
|---------|------|
| `$05C8` | Player interact capability flags |
| `$05CA` | Current interact target actor ID (or negative for special mode) |
| `$05CC` | D7 interact availability flag — `#$4000` set when interact starts |
| `$05CE` | D8/D9 interact availability flag — `#$4000` set when interact starts |
| `$05D8` | Scene lock — when nonzero, skips interact check |
| `$0A10,Y` | Player direction/animation state bits (indexed by `$04`) |
| `$0A24,Y` | Player animation decay counters (indexed by `$04`) |

## Family notes

1. **System-only ops**: All call sites are in system chunks (`chunk_038000.asm`, `actor_02E9AA.asm`, etc.). These are never used in regular map actors — they're reserved for the player host controller.

2. **D7 vs D8 distinction**: D7 uses `$05CC` and is used once (primary player character). D8 uses `$05CE` and is used 58 times (party members, secondary states). The separate flags likely prevent interaction conflicts between the primary and secondary character controllers.

3. **4-byte skip**: When interaction triggers, the COP skips exactly 4 bytes past the end of the instruction. This space typically contains inline data or a branch target for the interact handler code.

4. **Re-execute pattern**: Like the Screen Effect ops (D1–D4), these use the `DEC $2C : STA $28 : RTL` busy-wait pattern to re-execute each tick. The actor stays in the idle loop until an external event (interaction) breaks out.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Script Yield / Resume](script_yield.md) `[CB]`–`[D0]` | Shares the `$28` re-execute pattern; D7–D9 effectively yield each tick while idle |
| [Smooth Movement](smooth_move.md) `[DA]`–`[DB]` | DA/DB are used alongside D7–D9 in player host scripts; DA computes positions relative to party members |
| [Interact](interact.md) `[22]` | `[22]` sets actor interact handlers (`$7F0028,X`); D7–D9 clear it and invoke `code_03CD92` for the player side |
