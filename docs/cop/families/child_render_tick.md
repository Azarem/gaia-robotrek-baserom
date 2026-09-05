# Child Render Tick (`[FA]`)

A single system-only opcode that yields a child rendering actor with a frame-limited delay. Checks the parent actor's status each tick and auto-destructs if the parent is done.

## Overview

| Op | Name | Operands | Action | Uses |
|----|------|----------|--------|-----:|
| `FA` | `child_render_yield` | Byte | Yield with conditional delay; destroy if parent done | 25 |

---

## `[FA]` — `child_render_yield`

### Handler: `code_00DB86`

```
TYX
LDA $7F0022,X : TAY                  ; get parent actor
LDA $0006,Y : BIT #$0080             ; check parent $06 bit 7
BNE destroy                           ; parent done → destroy self+children

LDY $30                               ; save current $30 (frame counter / animation state)
LDA [$2C] : INC $2C : AND #$00FF     ; read Byte (frame limit)
CMP $32                               ; compare limit vs $32 (current frame index)
BCS use_delay                          ; if limit ≥ frame index → use $30 as delay
TYA : SEC : SBC #$0008 : TAY         ; else → reduce delay by 8

use_delay:
STY $0E                               ; set delay counter
LDA $2E : STA $2A                    ; save bank
LDA $2C : STA $28                    ; save PC as resume
PLA : PLA : RTL                       ; yield

destroy:
TXY : JSL code_04FD85                ; destroy self + all children
PLA : PLA : RTL                       ; yield (will never resume)
```

### Operand

| Part | Size | Meaning |
|------|------|---------|
| Byte | 1 | Frame limit — if `$32 > Byte`, delay is reduced by 8 frames |

### Logic flow

```
parent $06 bit 7 set? ──yes──► code_04FD85 (destroy self + children)
         │
         no
         │
  $32 > Byte? ──no──► delay = $30 (full delay)
         │
        yes
         │
  delay = $30 - 8 (reduced delay)
         │
  $0E = delay, save resume, yield
```

### Parent death check

FA reads the parent actor's `$0006` (indexed via `$7F0022,X`). If bit 7 (`#$0080`) is set, the parent is considered "done" (e.g., behavior phase complete, animation finished). The child destroys itself and all its own children via `code_04FD85`.

### Frame-limited animation

The Byte operand acts as a frame limit for the animation sequence. When `$32` (the current frame index, maintained by the calling animation loop) exceeds the limit, the delay is shortened by 8 frames. This causes later frames in a long animation to play faster — a form of animation acceleration.

### Call site pattern

FA is used exclusively in a table-driven animation sequence. Each frame is a separate routine that sets animation, waits, then calls FA with a decreasing frame limit:

```asm
code_03B548:                         ; frame 24
    COP [80] ( #04 )                 ; set animation
    COP [97]                         ; wait animation done
    COP [FA] ( #18 )                 ; yield (limit = 24)

code_03B550:                         ; frame 23
    COP [80] ( #05 )
    COP [97]
    COP [FA] ( #17 )                 ; yield (limit = 23)

...

code_03B608:                         ; frame 0 (last)
    COP [80] ( #1C )
    COP [97]
    COP [FA] ( #00 )                 ; yield (limit = 0)
    COP [42] ( #20 )                 ; play SFX
    ...                              ; cleanup
```

The sequence counts down from `#18` (24) to `#00` (0). As the animation progresses, `$32` increases, and once it exceeds the frame limit, delays shorten by 8 — creating a speed-up effect in the final frames.

### Source examples

| File | Call | Context |
|------|------|---------|
| `chunk_038000.asm:6140` | `COP [FA] ( #18 )` | Frame 24 — full delay |
| `chunk_038000.asm:6206` | `COP [FA] ( #0D )` | Frame 13 |
| `chunk_038000.asm:6278` | `COP [FA] ( #01 )` | Frame 1 — near-final |
| `chunk_038000.asm:6284` | `COP [FA] ( #00 )` | Frame 0 — last frame, cleanup follows |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `FA` | `child_render_yield` | 25 |
| | **Total** | **25** |

## Family notes

1. **System-only**: All 25 call sites are in `chunk_038000.asm`, in a single table-driven animation sequence.

2. **Sequential frame limits**: The 25 call sites use Byte values `#00` through `#18` (0–24), one per animation frame, in a strictly descending order.

3. **Parent-guarded lifecycle**: FA ensures child actors are cleaned up when their parent finishes — a key pattern for preventing orphaned sprites.

4. **`code_04FD85`**: This is the "destroy self + children" function, the same helper used by `[B3]` (destroy_self_and_children). It walks the forward chain (`$26`) freeing consecutive children, then unlinks and frees the actor itself.

5. **Frame acceleration**: The `$30 - 8` delay reduction creates a visible speed-up as the animation nears completion, producing a natural deceleration-then-snap visual effect.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Actor Destroy](actor_destroy.md) `[B2]`–`[B3]` | FA's destroy path uses `code_04FD85` — same as `[B3]` |
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | FA follows `[80]` + `[97]` in its animation frame pattern |
| [Animation Wait](anim_wait.md) `[97]`–`[9C]` | `[97]` waits for animation; FA then yields with the frame delay |
| [Script Yield / Resume](script_yield.md) `[CB]`–`[D0]` | FA yields like `[D0]` (delay_frames) but adds the parent death check and frame acceleration |
