# Velocity Set (`[B4]`–`[B6]`)

Three opcodes that set actor velocity fields (`$1C` / `$1E`) via lookup in the animation velocity table `unk29_list_01C3B9`. These provide a way to change an actor's movement speed independently from setting its animation.

## Overview

Each op reads one or two Byte operands, indexes into the velocity table, and stores the result to the X-axis velocity (`$1C`), Y-axis velocity (`$1E`), or both. The lookup is identical to `code_00E398` (used by the [Animation Setup](anim_setup.md) family) but performed inline.

| Op | Name | Operands | Target | Uses |
|----|------|----------|--------|-----:|
| `B4` | `set_velocity_x` | `Byte` | `$1C` | 10 |
| `B5` | `set_velocity_y` | `Byte` (not in copdef) | `$1E` | 0 |
| `B6` | `set_velocity_xy` | `Byte, Byte` (not in copdef) | `$1C`, `$1E` | 0 |

### Velocity table

`unk29_list_01C3B9` is a 32-entry pointer table (indices `#$00`–`#$1F`) in bank `$01`. Each entry points to a velocity data structure. Common indices seen in call sites:

| Index | Typical use |
|------:|------------|
| `#$00` | Zero / stop |
| `#$02` | Slow walk |
| `#$04` | Medium walk |
| `#$07` | Standard movement speed |
| `#$15` | Fast approach |
| `#$16` | Fast retreat |

The same table is used by `[80]`–`[8C]` (animation setup) via `code_00E398`, and by `[8C]` via `code_00E39E`/`code_00E3AC` (velocity + acceleration).

---

## `[B4]` — `set_velocity_x`

Sets the X-axis velocity (`$1C`) from a velocity table index without affecting animation state.

### Handler: `code_00C74E`

```
code_00C74E:
  TYX                           ; X = actor slot
  LDA [$2C] : INC $2C           ; read Byte operand
  AND #$00FF                    ; mask to byte
  ASL                           ; ×2 (word index)
  TAY                           ; Y = table index
  LDA unk29_list_01C3B9, Y      ; lookup velocity value
  STA $1C                       ; store to X velocity
  LDA $2C : STA $02, S : RTI   ; advance script pointer
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `Byte` | `$1C` | Velocity table index (0–31) → X-axis velocity |

### Usage (10 sites)

Two distinct use patterns:

**1. Battle movement** (`chunk_038000.asm`, 6 sites): Sets movement speed for combat actor approach/retreat sequences, often paired with `[89]` (animation set with speed) and `[97]` (animation wait):

```
COP [B4] ( #02 )           ; set X velocity = slow
COP [89] ( #05 )           ; set anim + speed
COP [97]                   ; wait for animation

COP [B4] ( #07 )           ; set X velocity = standard
COP [89] ( #09 )           ; set anim + speed
COP [97]                   ; wait
```

**2. Velocity readback** (`actor_04BA77.asm`, 4 sites): Uses `[B4]` as a lookup utility — sets `$1C` then immediately reads it into another address:

```
COP [B4] ( #00 )           ; look up velocity for index 0
LDA $1C
STA $084C                  ; store to global WRAM

COP [B4] ( #15 )           ; look up velocity for index 21
LDA $1C
STA $084C                  ; store to global WRAM
```

---

## `[B5]` — `set_velocity_y`

Sets the Y-axis velocity (`$1E`) from a velocity table index.

### Handler: `code_00C762`

```
code_00C762:
  TYX
  LDA [$2C] : INC $2C
  AND #$00FF
  ASL : TAY
  LDA unk29_list_01C3B9, Y
  STA $1E                       ; store to Y velocity
  LDA $2C : STA $02, S : RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `Byte` | `$1E` | Velocity table index (0–31) → Y-axis velocity |

### Usage

**0 sites.** Not in `copdef.json`. Valid handler exists but is never called. This is the Y-axis counterpart of `[B4]`.

---

## `[B6]` — `set_velocity_xy`

Sets both X and Y velocity from two velocity table indices. Combines `[B4]` and `[B5]` into a single opcode.

### Handler: `code_00C776`

```
code_00C776:
  TYX
  LDA [$2C] : INC $2C          ; read first Byte (X velocity index)
  AND #$00FF : ASL : TAY
  LDA unk29_list_01C3B9, Y
  STA $1C                       ; store to X velocity
  LDA [$2C] : INC $2C          ; read second Byte (Y velocity index)
  AND #$00FF : ASL : TAY
  LDA unk29_list_01C3B9, Y
  STA $1E                       ; store to Y velocity
  LDA $2C : STA $02, S : RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `Byte` | `$1C` | Velocity table index (0–31) → X-axis velocity |
| 2 | `Byte` | `$1E` | Velocity table index (0–31) → Y-axis velocity |

### Usage

**0 sites.** Not in `copdef.json`. Valid handler exists but is never called. This is the combined variant — functionally equivalent to `COP [B4] + COP [B5]`.

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `B4` | `set_velocity_x` | 10 |
| `B5` | `set_velocity_y` | 0 |
| `B6` | `set_velocity_xy` | 0 |
| | **Total** | **10** |

## Family notes

1. **Independent velocity control**: The key distinction from [Animation Setup](anim_setup.md) is that B4-B6 change velocity **without** resetting the animation. The `[80]`–`[8C]` ops always set the animation ID and timer alongside velocity. B4-B6 allow mid-animation speed changes or velocity configuration before/after animation setup.

2. **Inline lookup**: The velocity table lookup (`AND #$00FF; ASL; TAY; LDA unk29_list_01C3B9, Y`) is identical to `code_00E398`. B4-B6 inline it rather than calling the subroutine.

3. **Sparse usage**: Only `[B4]` is used (10 sites). The Y-only (`[B5]`) and combined (`[B6]`) variants exist as valid handlers but have zero call sites and are absent from `copdef.json`. In practice, Y velocity is always set through the animation setup ops rather than independently.

4. **Velocity readback pattern**: The `actor_04BA77.asm` usage pattern (set `$1C` then immediately read it) suggests `[B4]` was also used as a general-purpose table lookup utility, not just for setting movement speed.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | Sets velocity as part of full animation init (via `code_00E398`); B4-B6 set velocity independently |
| [Animation Wait](anim_wait.md) `[97]`–`[9C]` | Consumes velocity values to advance position each frame |
