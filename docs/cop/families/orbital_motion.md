# Orbital Motion (`[F8]`–`[F9]`)

Two system-only opcodes implementing accumulator-based position interpolation, used for orbital/curved movement of party member actors. F8 initializes the accumulators; F9 steps them each frame by adding delta operands and converting to world position via sine/cosine lookup.

## Overview

| Op | Name | Operands | Action | Uses |
|----|------|----------|--------|-----:|
| `F8` | `set_orbit_accum` | Word, Word | Initialize position accumulators `$7F0032`/`$7F0034` | 4 |
| `F9` | `orbit_step` | Word, Word | Add deltas to accumulators, compute position, yield | 8 |

---

## `[F8]` — `set_orbit_accum`

Initializes the two 16-bit position accumulators used by F9 for orbital interpolation.

### Handler: `code_00DB08`

```
TYX
LDA [$2C] : INC $2C : INC $2C      ; read Word 1
STA $7F0032,X                       ; → accumulator X (angle/radius component)
LDA [$2C] : INC $2C : INC $2C      ; read Word 2
STA $7F0034,X                       ; → accumulator Y (angle/radius component)
LDA $2C : STA $02,S : RTI           ; continue
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Word 1 | 2 | Initial value for `$7F0032,X` (X accumulator) |
| Word 2 | 2 | Initial value for `$7F0034,X` (Y accumulator) |

### Observed values

| Word 1 | Word 2 | Context |
|--------|--------|---------|
| `#$0000` | `#$0000` | Zero start (fresh orbit) |
| `#$7F00` | `#$0000` | Pre-rotated X, zero Y |
| `#$7F00` | `#$8000` | Pre-rotated X, negative Y offset |

---

## `[F9]` — `orbit_step`

Steps the orbital accumulators by adding Word delta operands each frame. Decrements `$30` as a step counter; when exhausted, skips operands and continues. While stepping, converts accumulated values to world X/Y via sine/cosine lookup tables and yields with resume set to re-execute.

### Handler: `code_00DB22`

```
TYX
DEC $30                               ; decrement step counter
BMI done                               ; if < 0 → skip operands, continue

; Still stepping:
LDA $2C : DEC : DEC                   ; back up PC to re-execute this opcode
STA $000028,X                          ; save as resume point

; Read and accumulate deltas:
LDA [$2C] : INC $2C : INC $2C         ; read Word 1 (delta pair: lo=X.lo, hi=X.hi)
STA $32
LDA [$2C] : INC $2C : INC $2C         ; read Word 2 (delta pair: lo=Y.lo, hi=Y.hi)

; Byte-wise accumulation into $7F0032–$7F0035:
SEP #$20
CLC : ADC $7F0034,X : STA $7F0034,X : STA $34   ; add Word2.lo → accum Y.lo
XBA
CLC : ADC $7F0035,X : STA $7F0035,X : STA $35   ; add Word2.hi → accum Y.hi
LDA $33
CLC : ADC $7F0033,X : STA $7F0033,X              ; add Word1.hi → accum X.hi
XBA
LDA $32
CLC : ADC $7F0032,X : STA $7F0032,X              ; add Word1.lo → accum X.lo
REP #$20

STA $36
LDA $7F0036,X : TAY                   ; target entity → Y
JSL code_03CE6D                        ; convert accumulators to world position
PLA : PLA : RTL                        ; yield

done:
LDA $2C : CLC : ADC #$0004            ; skip 4 bytes (2 Words)
STA $02,S : RTI                        ; continue
```

### Position conversion: `code_03CE6D`

Converts the byte-level accumulators in `$34`/`$35` to world X/Y coordinates using sine/cosine lookup tables:

| Input | Source | Role |
|-------|--------|------|
| `$34` | `$7F0034,X` (accum Y lo) | Sine table index |
| `$35` | `$7F0035,X` (accum Y hi) | Cosine table index |
| `$36` | `$7F0032,X` (accum X lo) | Multiply operand (radius) |
| `$37` | `$7F0032,X` hi byte | Multiply operand (radius) |
| `Y` | `$7F0036,X` | Target entity pointer |

Tables: `byte_01CA81` (sine), `byte_01CAC1` (cosine). Uses `code_0480FA` for 8×8 signed multiply. Result written to `$0000,Y` (X position) and `$0002,Y` (Y position) of the target entity.

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Word 1 | 2 | Delta pair: lo byte → `$7F0032` (X.lo), hi byte → `$7F0033` (X.hi) |
| Word 2 | 2 | Delta pair: lo byte → `$7F0034` (Y.lo), hi byte → `$7F0035` (Y.hi) |

### Setup requirement

Before calling F9, scripts must set:
- `$30` = step count (number of frames to execute)
- `$7F0036,X` = target entity pointer (typically set from `$7F0022,X` — parent actor)

### Call site patterns

F8/F9 always appear together. F8 initializes accumulators, then F9 is called in a loop:

```asm
code_02EAE4:
    LDA $7F0022,X : STA $7F0036,X   ; target = parent entity
    COP [F8] ( #$0000, #$0000 )      ; zero accumulators
    LDA #$000C : STA $30             ; 12 steps
    COP [F9] ( #$0800, #$0400 )      ; step with deltas

loop:
    LDA #$0001 : STA $30             ; 1 step per iteration
    COP [F9] ( #$0000, #$0800 )      ; continue stepping
    BRA loop                          ; infinite orbit
```

```asm
code_03F06B:
    LDA $7F0022,X : STA $7F0036,X
    COP [F8] ( #$0000, #$0000 )
    COP [05] ( #$0010 )              ; start repeat loop (16 times)
    LDA #$0001 : STA $30
    COP [F9] ( #$0303, #$2020 )      ; diagonal orbit step
    COP [B9] ( #$0004, #$0002 )      ; position adjust
    COP [06]                          ; loop

loop:
    LDA #$0001 : STA $30
    COP [F9] ( #$0000, #$2020 )      ; continue orbit
    COP [B9] ( #$0006, #$0001 )      ; position adjust
    BRA loop
```

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:140` | `COP [F8] ( #$0000, #$0000 )` | Zero accumulators |
| `actor_02E9AA.asm:143` | `COP [F9] ( #$0800, #$0400 )` | 12-step initial orbit |
| `actor_02E9AA.asm:148` | `COP [F9] ( #$0000, #$0800 )` | 1-step infinite loop |
| `actor_02F1F3.asm:236` | `COP [F8] ( #$7F00, #$0000 )` | Pre-rotated start |
| `actor_02F1F3.asm:240` | `COP [F9] ( #$0000, #$0200 )` | 10-step approach |
| `chunk_038000.asm:14042` | `COP [F8] ( #$0000, #$0000 )` | Zero start |
| `chunk_038000.asm:14046` | `COP [F9] ( #$0303, #$2020 )` | 1-step diagonal |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `F8` | `set_orbit_accum` | 4 |
| `F9` | `orbit_step` | 8 |
| | **Total** | **12** |

## Family notes

1. **System-only**: All 12 call sites are in party member system actors (`actor_02E9AA`, `actor_02F1F3`, `chunk_038000`).

2. **Accumulator model**: The four bytes at `$7F0032`–`$7F0035` form a 4-component accumulator. Each F9 call adds per-byte deltas, allowing independent control of angle and radius components.

3. **Sine/cosine conversion**: `code_03CE6D` converts accumulators to Cartesian X/Y via ROM lookup tables (`byte_01CA81`/`byte_01CAC1`) and hardware multiply (`code_0480FA`). This produces smooth curved trajectories.

4. **Self-re-executing**: F9 saves its own instruction address minus 2 as the resume point, causing it to re-execute on the next tick until `$30` reaches zero.

5. **Target entity**: The converted position is written to `$0000,Y` / `$0002,Y` of a target entity (typically the parent, via `$7F0036,X`). This moves the parent rather than the calling actor.

6. **Variable step counts**: Scripts set different `$30` values for different phases of movement — large counts for initial arcs, then `$30 = 1` for frame-by-frame infinite loops.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Smooth Movement](smooth_move.md) `[DA]`–`[DC]` | Both implement multi-frame position interpolation. Smooth move uses linear interpolation; orbital motion uses trigonometric (sine/cosine) curves |
| [Position Adjust](position_adjust.md) `[B7]`–`[B9]` | F9 is sometimes paired with `[B9]` for additional per-frame position corrections |
| [Velocity Set](velocity_set.md) `[B4]`–`[B6]` | Both use velocity tables (`unk29_list_01C3B9`); orbital motion uses separate sin/cos tables |
