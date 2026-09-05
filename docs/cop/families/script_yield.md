# Script Yield / Resume (`[CB]`–`[D0]`)

Six opcodes that control actor script scheduling by saving resume points and optionally yielding the actor's time slice. All operate on the same two fields: `$28`/`$2A` (saved script resume pointer) and `$0E` (delay counter).

## Overview

When the actor scheduler ticks an actor, it checks `$0E`. If nonzero, it decrements and skips the actor (the actor is "sleeping"). When `$0E` reaches zero, the scheduler jumps to `$28`/`$2A` to resume the script.

### Combinatorial pattern

| Op | Name | Resume from | Yield | Delay | Uses |
|----|------|-------------|:-----:|-------|-----:|
| `CB` | `mark_resume` | current PC | no (RTI) | unchanged | 744 |
| `CC` | `yield` | current PC | yes (RTL) | unchanged | 393 |
| `CD` | `yield_to_delay` | @Code | yes (RTL) | Word → `$0E` | 6 |
| `CE` | `yield_to` | @Code | yes (RTL) | 0 | 7 |
| `CF` | `set_resume` | @Code | no (RTI) | 0 | 151 |
| `D0` | `delay_frames` | current PC | yes (RTL) | Word → `$0E` | 762 |

Two dimensions define the variants:

1. **Resume source**: *current PC* (the instruction following the COP) vs *explicit @Code operand* (a far address)
2. **Yield**: *yes* (RTL — actor gives up its time slice) vs *no* (RTI — script continues immediately)

A third axis, delay, appears in `[CD]` and `[D0]`.

---

## `[CB]` — `mark_resume`

Saves the current script position as the actor's resume point. The script continues immediately.

### Handler: `code_00CB38`

```
TYX
LDA $2E : STA $2A      ; save current bank → resume bank
LDA $2C : STA $28      ; save current PC → resume address
STA $02,S : RTI         ; set return PC, continue
```

### Usage pattern (744 sites)

The most common COP in this family. Used to keep the actor's resume point up to date in loops:

```
loop_top:
  COP [CB]              ; "if I get interrupted, resume here"
  COP [9C]              ; tick rendering
  BRA loop_top
```

Also used before branching logic to ensure the resume point is set before the script enters a code path that may yield via native RTL:

```
  COP [CB]              ; save resume
  JSR some_function     ; native code that may RTL
```

### Source examples

| File | Line | Context |
|------|------|---------|
| `actor_04B763.asm:45` | `COP [CB]` | Render loop: mark resume before render tick |
| `actor_098000.asm:28` | `COP [CB]` | NPC loop: mark resume in animation loop |
| `actor_05F686.asm:19` | `COP [CB]` | Event actor: mark resume before processing |

---

## `[CC]` — `yield`

Saves the current script position as the actor's resume point and yields the time slice. The actor stops executing until the next scheduler tick.

### Handler: `code_00CB44`

```
TYX
LDA $2E : STA $2A      ; save current bank → resume bank
LDA $2C : STA $28      ; save current PC → resume address
PLA : PLA : RTL         ; yield
```

### Usage pattern (393 sites)

The primary yield instruction. After yielding, the actor resumes at the instruction immediately following `COP [CC]` on the next tick (or after the delay in `$0E` expires, if set previously).

Commonly paired with `COP [D0]` to introduce a frame delay:

```
  COP [D0] ( #$00FA )    ; set delay to 250 frames
  ...
  STA $0E                 ; or set delay via native code
  COP [CC]                ; yield — resumes here after delay
```

Also used as a simple "wait one frame" between operations:

```
  COP [80] ( #04 )       ; set animation
  COP [CC]                ; yield one frame
  COP [80] ( #05 )       ; set next animation
```

### Source examples

| File | Line | Context |
|------|------|---------|
| `actor_04B422.asm:19` | `COP [CC]` | World map actor: yield after random positioning |
| `actor_04B881.asm:96` | `COP [CC]` | Render actor: yield between render steps |
| `actor_06E3A9.asm:8` | `COP [CC]` | NPC: yield in idle loop |

---

## `[CD]` — `yield_to_delay`

Sets an explicit far address as the resume point, loads a delay counter, and yields.

### Handler: `code_00CB50`

```
TYX
LDA [$2C] : INC $2C : INC $2C    ; read @Code low word
STA $28                            ; resume address
LDA [$2C] : INC $2C : AND #$00FF ; read bank byte
STA $2A                            ; resume bank
LDA [$2C] : INC $2C : INC $2C    ; read Word
STA $0E                            ; delay counter
PLA : PLA : RTL                    ; yield
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| `@Code` | 3 bytes | Far address to resume at |
| `Word` | 2 bytes | Delay in frames before resuming |

### Usage (6 sites)

Rare. Used when the script needs to jump to a specific routine after a timed delay — combining the effects of `[CF]` + `COP [D0]` + `[CC]` in a single instruction.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_04B881.asm:103` | `COP [CD] ( @code_04B92C, #$0005 )` | Resume at render routine after 5 frames |
| `actor_04DB88.asm:89` | `COP [CD] ( @code_04DC05, #$0020 )` | Resume at cutscene handler after 32 frames |
| `actor_04EB34.asm:35` | `COP [CD] ( @code_04EB65, #$0002 )` | Resume at prologue step after 2 frames |

---

## `[CE]` — `yield_to`

Sets an explicit far address as the resume point (no delay) and yields immediately.

### Handler: `code_00CB6D`

```
TYX
LDA [$2C] : INC $2C : INC $2C    ; read @Code low word
STA $28                            ; resume address
LDA [$2C] : INC $2C : AND #$00FF ; read bank byte
STA $2A                            ; resume bank
STZ $0E                            ; clear delay
PLA : PLA : RTL                    ; yield
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| `@Code` | 3 bytes | Far address to resume at |

### Usage (7 sites)

Used for "go to this code on the next tick" — an unconditional far jump with a yield boundary. The script does not continue past CE; next tick, execution begins at @Code.

In the player host (`chunk_0B8000.asm`), CE is used to transition between major execution phases:

```
code_0B83A4:
  COP [CE] ( @code_0B8391 )    ; resume at main player loop next tick
```

### Source examples

| File | Call | Context |
|------|------|---------|
| `chunk_0B8000.asm:356` | `COP [CE] ( @code_0B8391 )` | Player host: jump to main loop |
| `chunk_0B8000.asm:526` | `COP [CE] ( @code_0B84A1 )` | Player host: jump to dialog handler |
| `actor_0BEFFE.asm:68` | `COP [CE] ( @code_0BF00B )` | World map: jump to processing loop |
| `actor_06861D.asm:41` | `COP [CE] ( @code_068628 )` | Cave actor: jump to idle loop |

---

## `[CF]` — `set_resume`

Sets an explicit far address as the resume point but continues executing the current script. The script runs past CF normally; the resume point only takes effect when the actor later yields.

### Handler: `code_00CB84`

```
TYX
LDA [$2C] : INC $2C : INC $2C    ; read @Code low word
STA $28                            ; resume address
LDA [$2C] : INC $2C : AND #$00FF ; read bank byte
STA $2A                            ; resume bank
STZ $0E                            ; clear delay
LDA $2C : STA $02,S : RTI         ; set return PC, continue
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| `@Code` | 3 bytes | Far address to resume at (when actor next yields) |

### Usage pattern (151 sites)

The most common @Code variant. Used to set a "loop top" or "idle entry point" that the actor returns to after completing work:

```
  COP [CF] ( @loop_top )   ; set resume = loop_top
  ... do one-shot work ...
  RTL                        ; yield → next tick resumes at loop_top
```

This pattern is pervasive in NPC scripts: CF sets the actor's main loop entry point, the script does initialization or event handling work, then yields via RTL. Next tick, the actor starts fresh at the loop top.

Also used in event callbacks:

```
code_05C5F6:
  ... play sound, set tiles ...
  COP [CF] ( @code_05C5E5 )  ; set resume to idle loop
  RTL                          ; yield → idle loop next tick
```

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_05C5DC.asm:29` | `COP [CF] ( @code_05C5E5 )` | NPC: set resume to idle loop after event |
| `actor_07DE2B.asm:52` | `COP [CF] ( @code_07DE54 )` | Volcano NPC: set resume to patrol loop |
| `actor_0CA0C4.asm:51` | `COP [CF] ( @code_0CA0D3 )` | House NPC: set resume to interaction loop |
| `actor_0691F9.asm:228` | `COP [CF] ( @code_069254 )` | Transport: set resume to wait loop |

---

## `[D0]` — `delay_frames`

Reads a frame delay, saves the current script position as resume, and yields. The actor sleeps for the specified number of frames.

### Handler: `code_00CB9D`

```
TYX
LDA [$2C] : INC $2C : INC $2C    ; read Word
STA $0E                            ; delay counter
LDA $2E : STA $2A                 ; save current bank → resume bank
LDA $2C : STA $28                 ; save current PC → resume address
PLA : PLA : RTL                    ; yield
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| `Word` | 2 bytes | Delay in frames before resuming |

### Usage pattern (762 sites)

The **second-most-used** op in this family and the most common way to pause an actor. Delay values are in frames (60 fps):

| Value | Frames | Time | Count |
|-------|-------:|------|------:|
| `#$003C` | 60 | 1.0 s | 126 |
| `#$001E` | 30 | 0.5 s | 110 |
| `#$0078` | 120 | 2.0 s | 71 |
| `#$0020` | 32 | 0.5 s | 57 |
| `#$0010` | 16 | 0.3 s | 45 |
| `#$0168` | 360 | 6.0 s | 42 |
| `#$01A4` | 420 | 7.0 s | 31 |
| `#$0002` | 2 | 0.03 s | 28 |

The most common delays are 0.5–2 seconds — typical for NPC idle pauses, event timing, and cutscene beats. Very short delays (2–4 frames) are used for animation synchronization.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_04B422.asm:14` | `COP [D0] ( #$00FA )` | World map: wait 250 frames (~4 s) |
| `actor_08C293.asm:12` | `COP [D0] ( #$0020 )` | Rocket takeoff: wait 32 frames |
| `actor_06EA31.asm:14` | `COP [D0] ( #$003C )` | Mansion: wait 60 frames (1 s) |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `CB` | `mark_resume` | 744 |
| `CC` | `yield` | 393 |
| `CD` | `yield_to_delay` | 6 |
| `CE` | `yield_to` | 7 |
| `CF` | `set_resume` | 151 |
| `D0` | `delay_frames` | 762 |
| | **Total** | **2063** |

## Actor fields

| Field | Role | Modified by |
|-------|------|-------------|
| `$28` / `$2A` | **Saved resume pointer** (16-bit address / 8-bit bank). The scheduler jumps here when the actor's tick arrives and `$0E == 0`. | All six: CB/CC/D0 save current PC; CD/CE/CF save @Code operand |
| `$0E` | **Delay counter**. Decremented each tick; actor skipped while nonzero. | CD/D0 set from Word; CE/CF clear to 0; CB/CC leave unchanged |
| `$2C` / `$2E` | **Current script pointer** (live PC / bank). Read by CB/CC/D0 to save as resume point. | Not modified by these ops (read only) |

## Family notes

1. **Yield = RTL**: All yielding variants (CC, CD, CE, D0) exit via `PLA : PLA : RTL`. The double PLA removes the COP handler's stack frame (the RTI return address), and RTL returns to the actor scheduler. The non-yielding variants (CB, CF) use `STA $02,S : RTI` which sets the return address and continues the script.

2. **D0 is the most common yield**: D0 (762) is the single most-used opcode in this family, ahead of even CB (744). Together with CB and CC, the three "current PC" variants account for 92% of the family.

3. **Complete combinatorial grid**: The six opcodes CB–D0 cover all practical combinations of {resume source} × {yield} × {delay}. The only "missing" slot — @Code + no yield + delay — has no practical use case (setting a future resume point with delay but continuing current execution is contradictory).

4. **CB + native RTL pattern**: CB is often used in render loops where the actor runs native 65816 code that may RTL at any point. The CB at the top of the loop ensures the resume point is current. Without it, an RTL yield would resume at an old (stale) position.

5. **CF + RTL = "goto far"**: CF followed by RTL effectively becomes a far goto — the script sets the resume point to @Code, then immediately yields. The net effect is that next tick, the actor begins at @Code. This is why the monolith previously named CF `goto_far`.

6. **$0E interaction**: CB and CC do not touch `$0E`. This means scripts can set a delay (via D0 or native `STA $0E`) and then use CC to yield with that delay active. CD and D0 explicitly set `$0E` from their Word operand; CE and CF explicitly clear it to 0.

7. **D0 + CC common pairing**: A frequent pattern is `COP [D0] ( #$XXXX )` to set the delay, followed later by `COP [CC]` to yield. D0 combines the delay-set and yield into one instruction, making it the preferred "sleep" command.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Script Control](control_flow.md) `[00]`–`[09]` | Manages call stack (gosub/return), repeat loops, and goto. CB–CF manage the yield/resume lifecycle that those control flow ops execute within |
| [Animation Wait](anim_wait.md) `[97]`–`[9C]` | `[97]`/`[98]` also yield (wait for animation), but they combine rendering logic with the yield. CB–CF are pure scheduling ops |
| [Render Source Load](render_source_load.md) `[CA]` | `[CA]` yields via RTL after DMA setup — the yield behavior is built into the rendering op rather than using a separate CC/CE |
