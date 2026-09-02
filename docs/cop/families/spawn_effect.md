# Spawn Effect — COP `[79]`

> Deep-audited ops: `[79]`

## Overview

Spawns a **child sprite/particle effect** at a given tile position with an optional movement path. The child actor runs a hardcoded animation loop at `loc_04C7E5` (chunk_048000.asm) and self-destructs after a set number of frames.

Used for brief visual effects during cutscenes: inventor sparks, earthquake rubble, credits animations.

## Shared state

| Address | Role |
|---------|------|
| `$56` | Actor allocation stack pointer (used by `code_0481EE`) |
| `$0EF6` | Linked list head for child actors |
| `$052A` | Global frame counter (used for motion randomization) |

### Child actor fields (set by handler)

| Offset | Role | Source |
|--------|------|--------|
| `$0000` | X position (pixels) | Byte 1 × 16, sign-extended |
| `$0002` | Y position (pixels) | Byte 2 × 16, sign-extended |
| `$0028`/`$002A` | Code entry point | Hardcoded to `loc_04C7E5` |
| `$0030` | Frame countdown (sprite id bits 0–6) | Byte 5 AND `#$7F` |
| `$0032` | Flip flag | Byte 5 AND `#$80` |
| `$0034` | X movement delta (pixels) | (Byte 3 × 16) − X position, or 0 |
| `$0036` | Y movement delta (pixels) | (Byte 4 × 16) − Y position, or 0 |

### Helpers

| Label | Role |
|-------|------|
| `code_00E55E` | Allocate child actor slot and link into actor chain |
| `code_0481EE` | Actor slot allocator — reads from pool at `($56)` |
| `code_00E510` | Read byte from script, sign-extend, shift left 4 (tile→pixel) |
| `code_00E587` | Copy parent actor template data to child |
| `loc_04C7E5` | Child animation loop — moves sprite, plays SFX, counts down, self-destructs |

## Opcode

---

#### COP [79] — `spawn_effect` (particle/sprite effect spawner)

- **Confidence:** high
- **Preferred name:** `spawn_effect`
- **Aliases:** `spawn_particle`, `create_effect`
- **Handler:** `code_00BD0B` @ chunk_008000.asm:8656–8698
- **Parameters:** `Byte` ×5 (startX, startY, targetX, targetY, flags+frames)
- **Usage count:** 7

##### Operand encoding

| Byte | Meaning |
|------|---------|
| 1 | Start X tile coordinate (sign-extended, ×16 → pixels) |
| 2 | Start Y tile coordinate (sign-extended, ×16 → pixels) |
| 3 | Target X tile coordinate (0 = no X movement) |
| 4 | Target Y tile coordinate (0 = no Y movement) |
| 5 bits 0–6 | Frame countdown — child loops this many times, then self-destructs |
| 5 bit 7 | Flip flag — passed to child's `$0032` field |

If target X/Y is non-zero, the handler computes a movement delta: `delta = (target × 16) − (start × 16)`. The child actor at `loc_04C7E5` uses this delta with the global frame counter `$052A` to produce a modulated motion path.

##### What it does

```asm
code_00BD0B {
    TYX
    PHX                        ; save parent actor index
    JSR $&code_00E55E          ; allocate child actor, link into chain
    TYX                        ; X = new child's direct page
    LDA #$&loc_04C7E5
    STA $0028, X               ; child code pointer (low)
    LDA #$*loc_04C7E5
    STA $002A, X               ; child code pointer (bank)
    JSR $&code_00E510           ; read byte 1 → start X (pixels)
    STA $0000, X
    JSR $&code_00E510           ; read byte 2 → start Y (pixels)
    STA $0002, X
    JSR $&code_00E510           ; read byte 3 → target X
    CMP #$0000
    BEQ no_dx
    SEC
    SBC $0000, X               ; delta X = target - start
  no_dx:
    STA $0034, X               ; child dx
    JSR $&code_00E510           ; read byte 4 → target Y
    CMP #$0000
    BEQ no_dy
    SEC
    SBC $0002, X               ; delta Y = target - start
  no_dy:
    STA $0036, X               ; child dy
    LDA [$2C]
    AND #$0080
    STA $0032, X               ; flip flag
    LDA [$2C]
    AND #$007F
    STA $0030, X               ; frame countdown
    INC $2C                    ; advance past byte 5
    PLX                        ; restore parent actor
    LDA $2C
    STA $02, S
    RTI
}
```

##### Child behavior (`loc_04C7E5`)

The child actor loops:
1. Uses `$052A` (global frame counter) modulo `$34`/`$36` deltas to compute position offset
2. Spawns a visual sprite via `code_04C84C` (spritemap `@spritemap_128000`)
3. Plays SFX via `COP [41]` on alternate frames
4. Waits 8 frames (`COP [D0] ( #$0008 )`)
5. Decrements `$30` (frame countdown)
6. Loops until `$30` < 0, then self-destructs (`COP [B2]`)

##### Call site examples

```asm
    ; Earthquake rubble in volcano quake room
    COP [79] ( #04, #32, #09, #34, #10 )
    ; Start at (4,50), move to (9,52), 16 frames

    ; Inventor sparks during prologue
    COP [79] ( #22, #13, #2E, #1A, #A0 )
    ; Start at (34,19), move to (46,26), 32 frames + flip

    ; Credits inventor animation
    COP [79] ( #14, #25, #1C, #2A, #90 )
    ; Start at (20,37), move to (28,42), 16 frames + flip
```

## Usage statistics

| Op | Name | Sites | Files |
|----|------|------:|------:|
| `[79]` | `spawn_effect` | 7 | 7 |

## Family notes

- The child actor's code is **hardcoded** to `loc_04C7E5` — there is no way for the caller to specify different behavior. The visual appearance comes from `spritemap_128000` and the `$0032` flip flag.
- A target coordinate of `#$00` means "no movement on that axis." The delta is stored as 0, so the child remains stationary on that axis.
- The frame countdown (`$30`) determines how long the effect persists. Observed values range from 6 to 32 (decimal, not BCD).
- The `code_00E510` helper sign-extends the byte operand before shifting: values `#$80`–`#$FF` produce negative pixel positions (screen-relative left/above origin).
