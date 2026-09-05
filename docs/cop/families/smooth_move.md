# Smooth Movement (`[DA]`–`[DC]`)

Three opcodes that implement smooth interpolated movement for actors. `[DA]` computes a target position (typically from a party member's location), `[DB]` configures the interpolation parameters, and `[DC]` executes the movement tick by tick.

## Overview

| Op | Name | Operands | Role | Uses |
|----|------|----------|------|-----:|
| `DA` | `calc_target_pos` | Byte, Word | Compute target → `$34`/`$36` | 33 |
| `DB` | `setup_smooth_move` | Byte, Word | Configure interpolation from `$00`/`$02` → `$34`/`$36` | 42 |
| `DC` | `exec_smooth_move` | (none) | Execute one step per tick | 42 |

### Typical sequence

```
COP [DA] ( #mode, #$offset )     ; compute target position
COP [DB] ( #anim, #$steps_delay ) ; set up smooth movement
COP [DC]                          ; execute movement (yields per step)
```

DA is optional — scripts can compute `$34`/`$36` via native code instead. DB reads the target from `$34`/`$36` and the actor's current position from `$00`/`$02`.

---

## `[DA]` — `calc_target_pos`

Calculates a target position based on a party member index and offset.

### Handler: `code_00CEF0`

```
TYX : PHX
LDA $0B12 : BPL main_path        ; check mode flag
JMP code_00CF7E                   ; negative → alternate path

main_path:
LDA $7F0008,X : TAY              ; Y = party slot index
LDA $06 : BIT #$0400             ; check secondary character flag
BEQ skip_add : TYA : CLC : ADC #$0006 : TAY  ; Y += 6

LDA [$2C] : INC $2C : AND #$00FF ; read Byte (mode)
STA $30 : LSR                     ; bit 0 → carry
BCC use_slot : LDY $22           ; bit 0 set → use $22 as slot index

LDX $0A02,Y : BEQ no_target     ; look up entity at index Y
; Entity exists:
LDA [$2C] : INC $2C : INC $2C    ; read Word (Y offset)
CLC : ADC $0002,X : STA $36     ; target Y = entity.Y + offset
LDA $0000,X : STA $34            ; target X = entity.X
PLX : BRA apply

no_target:
PLX
LDA [$2C] : INC $2C : INC $2C : STA $36  ; read Word → Y offset
; Grid-based fallback:
TYA : ...                         ; compute position from screen grid
; (slot-1) * 16 + $0816 + offset → $36
; $0812 + 32 + facing offset → $34

apply:
LDA $30 : BIT #$0002             ; check bit 1
BEQ done
LDA $34 : STA $00                ; copy target → actor position (teleport)
LDA $36 : STA $02

done:
LDA $2C : STA $02,S : RTI
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte | 1 | Mode flags (bit 0: use `$22` for slot; bit 1: copy result to actor position) |
| Word | 2 | Y-axis offset (signed, added to target Y) |

### Mode byte values

| Value | Bit 0 | Bit 1 | Meaning |
|------:|:-----:|:-----:|---------|
| `#00` | 0 | 0 | Compute target only (→ `$34`/`$36`) |
| `#01` | 1 | 0 | Use `$22` as slot index; compute only |
| `#02` | 0 | 1 | Compute + copy to position (teleport) |
| `#03` | 1 | 1 | Use `$22` + teleport |

### Alternate path (`code_00CF7E`, `$0B12 < 0`)

When `$0B12` is negative (special mode), DA uses a different calculation:
- Computes grid position similar to the main path
- Calls `code_04812A` to get collision/facing data
- May flip `$0A` bit `#$4000` (facing direction) based on position comparison
- Used in cinematic or battle-mode positioning

### Operand distribution

| Operands | Count | Notes |
|----------|------:|-------|
| `( #00, #$0000 )` | 7 | Target party member 0, no offset |
| `( #01, #$0000 )` | 7 | Target from `$22`, no offset |
| `( #03, #$0000 )` | 6 | Target from `$22`, teleport |
| `( #02, #$0000 )` | 4 | Target party member, teleport |
| `( #03, #$FF60 )` | 3 | Target from `$22`, teleport, Y offset -160 |
| others | 6 | Various negative Y offsets |

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02F1F3.asm:54` | `COP [DA] ( #02, #$FF00 )` | Teleport to party member, Y-256 |
| `actor_02F1F3.asm:55` | `COP [DA] ( #00, #$FFF8 )` | Compute target at party member, Y-8 |
| `chunk_038000.asm:4592` | `COP [DA] ( #00, #$0000 )` | Compute target at party member 0 |
| `chunk_038000.asm:9886` | `COP [DA] ( #02, #$0000 )` | Teleport to party member |

---

## `[DB]` — `setup_smooth_move`

Configures smooth interpolated movement from the actor's current position to the target in `$34`/`$36`.

### Handler: `code_00CFF6`

```
TYX
LDA [$2C] : INC $2C : AND #$00FF ; read Byte (animation ID)
STA $7F000C,X : STZ $10           ; set animation + clear frame counter

; Calculate deltas:
LDY #$0000
LDA $34 : SEC : SBC $00          ; delta X = target X - actor X
BPL pos_x : LDY #$4000 : negate  ; |delta X|, flag negative
STA $34 : TYA : STA $32          ; $32 = X direction flag

LDY #$0000
LDA $36 : SEC : SBC $02          ; delta Y = target Y - actor Y
BPL pos_y : LDY #$8000 : negate  ; |delta Y|, flag negative
STA $36

CMP $34 : BCS use_dy : LDA $34  ; max_dist = max(|dX|, |dY|)
TYA : ORA $32 : STA $32          ; $32 = direction flags (bit14=X neg, bit15=Y neg)

; Scale for 8-bit arithmetic:
LDA #$0000 : STA $7F0036,X       ; shift counter = 0
loop:
BIT #$FF00 : BEQ fits            ; if max_dist fits in 8 bits → done
LSR : LSR $34 : LSR $36          ; halve all distances
INC $7F0036,X                     ; track how many times we halved
BRA loop

fits:
; Hardware division: steps_per_frame = max_dist / step_count
STA $WRDIVL
LDA [$2C] : INC $2C : AND #$00FF ; read low byte of Word (step count)
SEP #$20 : STA $WRDIVB : REP #$20

LDA [$2C] : INC $2C : AND #$00FF ; read high byte of Word (frame limit)
XBA : STA $7F0034,X              ; store: high byte = frame limit, low byte = 0

LDA $RDDIVL : INC : ORA $32     ; quotient + 1 + direction flags
STA $32

LDA #$0000
STA $1C : STA $1E                ; clear velocity
STA $30 : STA $7F0032,X         ; clear step counter + accumulators
LDA $2C : STA $28 : STA $02,S : RTI
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte | 1 | Animation ID for the movement |
| Word | 2 | Low byte: step count (interpolation divisions); High byte: frame limit (`$FF` = unlimited) |

### Word operand encoding

| Word | Steps | Frame limit | Count | Notes |
|------|------:|-------------|------:|-------|
| `#$FF04` | 4 | unlimited | 23 | Most common — 4-step smooth move |
| `#$FF02` | 2 | unlimited | 10 | Quick 2-step move |
| `#$FF08` | 8 | unlimited | 7 | Slow 8-step move |
| `#$FF01` | 1 | unlimited | 2 | Instant (single step) |

All observed uses have `#$FF` frame limit (unlimited — movement completes based on distance, not a frame cap).

### Interpolation fields

| Field | Role | Set by DB |
|-------|------|-----------|
| `$32` | **Movement control** — low bits: pixels-per-step (+1); bit 14: X direction neg; bit 15: Y direction neg | Computed |
| `$34` | **Scaled |delta X|** | Computed |
| `$36` | **Scaled |delta Y|** | Computed |
| `$30` | **Step counter** (incremented by DC each tick) | Cleared to 0 |
| `$7F0032,X` | **X accumulator** (fractional position tracking) | Cleared to 0 |
| `$7F0033,X` | **Y accumulator** (fractional position tracking) | Cleared to 0 |
| `$7F0034,X` | **Per-step animation delay** (low byte) | Set to 0 initially |
| `$7F0035,X` | **Frame limit counter** (high byte) | Set from Word high byte; `$FF` = skip |
| `$7F0036,X` | **Shift counter** (precision recovery) | Set from scaling loop |

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:182` | `COP [DB] ( #09, #$FF04 )` | Party: anim 9, 4 steps |
| `actor_02EF9F.asm:184` | `COP [DB] ( #09, #$FF02 )` | Party: anim 9, 2 steps |
| `actor_02F8C2.asm:170` | `COP [DB] ( #08, #$FF08 )` | Party: anim 8, 8 steps |
| `chunk_038000.asm:4593` | `COP [DB] ( #2A, #$FF04 )` | Player: anim 42, 4 steps |
| `actor_04B506.asm:46` | `COP [DB] ( #11, #$FF04 )` | Space world: anim 17, 4 steps |

---

## `[DC]` — `exec_smooth_move`

Executes the smooth movement configured by DB, one step per tick.

### Handler: `code_00D091` + `code_00D135`

```
TYX

code_00D092:
  LDA $32 : AND #$3FFF           ; step_size = $32 masked
  CMP $30                         ; compare to step counter
  BNE step                        ; steps remain → do step
  JMP code_00D135                 ; done → finish/precision recovery

step:
  ; Y position update (hardware multiply/divide):
  SEP #$20
  LDA $30 : STA $WRMPYA           ; step_counter × delta_Y
  LDA $36 : JSR code_00D155       ; → (step * dY) / (total - 1)
  SBC $7F0033,X                    ; subtract previous Y accumulator
  ; Apply direction sign from $32 bit 15:
  CLC : ADC $02 : STA $02         ; update actor Y

  ; X position update (same pattern):
  LDA $34 : JSR code_00D155       ; → (step * dX) / (total - 1)
  SBC $7F0032,X                    ; subtract previous X accumulator
  ; Apply direction sign from $32 bit 14:
  CLC : ADC $00 : STA $00         ; update actor X

  ; Frame limit check:
  SEP #$20
  LDA $7F0035,X                    ; frame limit counter
  BMI skip_limit                   ; $FF → skip (unlimited)
  DEC : BEQ done                   ; reaches 0 → movement complete
  STA $7F0035,X

skip_limit:
  ; Animation frame advance:
  LDA $7F0034,X : DEC             ; per-step delay counter
  BPL save_frame                   ; ≥ 0 → still waiting

  JSL code_04FC71                  ; advance animation frame
  BCS loop                        ; carry set → more frames to advance
  SEP #$20 : LDA $0E              ; read anim frame's built-in delay

save_frame:
  STA $7F0034,X                    ; save delay counter
  REP #$20
  STZ $0E : INC $30               ; clear delay, advance step counter
  PLA : PLA : RTL                  ; yield (one step done)

code_00D135:  ; precision recovery
  REP #$20
  LDA $7F0036,X : BEQ loc_done    ; shift counter = 0 → fully done
  DEC : STA $7F0036,X             ; decrement shift counter
  STZ $7F0032,X : STZ $30         ; reset accumulators
  JMP code_00D092                  ; continue with next precision pass

loc_done:
  LDA $2C : STA $28               ; save resume
  PLA : PLA : RTL                  ; yield (movement complete)
```

### Helper: `code_00D155`

Performs `(step_counter × delta) / (total_steps - 1)` using SNES hardware multiply (`$WRMPYA`/`$WRMPYB` → `$RDMPYL`) and divide (`$WRDIVL`/`$WRDIVB` → `$RDDIVL`) registers.

### Interpolation algorithm

1. Each tick, DC computes the ideal accumulated position for step N: `position_N = (N × total_delta) / (steps - 1)`
2. Subtracts the previous accumulated position to get the per-step delta
3. Applies direction signs from `$32` (bit 14 for X, bit 15 for Y)
4. Updates actor position `$00`/`$02`
5. If DB had to scale distances down (shift counter > 0), DC repeats the interpolation at increasing precision

### Usage (42 sites)

Always paired 1:1 with `COP [DB]`. Every DB call site is followed by a DC call.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:187` | `COP [DC]` | Party: execute smooth move |
| `chunk_038000.asm:4594` | `COP [DC]` | Player: execute smooth move after DA+DB |
| `actor_04B506.asm:47` | `COP [DC]` | Space world: execute smooth move |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `DA` | `calc_target_pos` | 33 |
| `DB` | `setup_smooth_move` | 42 |
| `DC` | `exec_smooth_move` | 42 |
| | **Total** | **117** |

## Family notes

1. **System-focused**: Like D7–D9, nearly all call sites are in system chunks (`chunk_038000.asm`, `actor_02Exxx.asm`). Only 1 use of DB is in a regular actor (`actor_04B506.asm`, space world).

2. **DA is optional**: DB can be called without DA if the script computes `$34`/`$36` through native code. In `actor_02E9AA.asm:180–182`, native code sets `$34` via PRNG + screen offset, then DB starts movement.

3. **Linear interpolation**: DB+DC implement true linear interpolation using hardware division. The movement is evenly divided into N steps, with sub-pixel precision maintained through the accumulator fields.

4. **Animation during movement**: DB sets the animation ID, and DC advances animation frames (`code_04FC71`) each step. The animation runs alongside the position update, creating smooth walking/flying visuals.

5. **DA double-call pattern**: DA is sometimes called twice in sequence — first with `#02` (teleport to a party member) and then with `#00` (compute target for movement). This positions the actor at one character and moves it to another.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Player Idle / Interact](player_idle.md) `[D7]`–`[D9]` | Used in the same player host scripts; DA/DB provide movement between idle states |
| [Movement](movement.md) `[51]`–`[55]` | `[51]`–`[55]` provide grid-based step movement; DA/DB provide pixel-precise smooth interpolation |
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | DB sets `$7F000C,X` (animation ID) like `[80]`; DC uses `code_04FC71` like `[97]` |
| [Render Source Load](render_source_load.md) `[C8]` | DC calls `code_04FC71` for frame advance, same as `[C8]` with byte=1 |
