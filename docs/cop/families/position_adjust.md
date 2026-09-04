# Position Adjust (`[B7]`–`[B9]`)

Three opcodes that adjust the actor's world position (`$00` / `$02`) by a signed offset. The X-axis offset is **facing-relative** (negated when the actor faces left), while the Y-axis offset is always applied directly.

## Overview

| Op | Name | Operands | Adjusts | Uses |
|----|------|----------|---------|-----:|
| `B7` | `adjust_pos_x` | `Word` | `$00` (facing-relative) | 24 |
| `B8` | `adjust_pos_y` | `Word` | `$02` (direct) | 27 |
| `B9` | `adjust_pos_xy` | `Word, Word` | `$00` + `$02` | 21 |

All three use the standard facing check: `LDA $0A; ASL; ASL` shifts bit `#$4000` of `$0A` into carry. If carry is set (facing left), the X offset is negated via two's complement (`EOR #$FFFF; INC`). This is the same mechanism used by the spawn offset ops (`[A5]`/`[AD]`/`[AE]`/`[B1]`).

### Facing-relative semantics

- **Positive word** (e.g., `#$0010`): moves forward (right when facing right, left when facing left)
- **Negative word** (e.g., `#$FFF8`): moves backward (left when facing right, right when facing left)
- Y offset is always applied as-is — positive = down, negative = up

---

## `[B7]` — `adjust_pos_x`

Adjusts the actor's X position by a facing-relative signed offset.

### Handler: `code_00C798`

```
code_00C798:
  TYX
  LDA $0A                       ; read actor flags
  ASL : ASL                     ; bit #$4000 → carry
  LDA [$2C] : INC $2C : INC $2C ; read Word (X offset)
  BCC +                         ; if facing right, skip negate
  EOR #$FFFF : INC              ; negate (two's complement)
+ CLC : ADC $00 : STA $00      ; apply to X position
  LDA $2C : STA $02, S : RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `Word` (2 bytes) | `$00` adj | Signed X offset (negated if `$0A bit #$4000` = facing left) |

### Offset values observed

| Value | Meaning | Sites |
|------:|---------|------:|
| `#$0008` | 8px forward | 5 |
| `#$0010` | 16px forward | 5 |
| `#$0020` | 32px forward | 1 |
| `#$00A0` | 160px forward | 3 |
| `#$FFE0` | 32px backward | 2 |
| `#$FFF8` | 8px backward | 1 |
| `#$FFFD` | 3px backward | 1 |
| `#$FFFF` | 1px backward | 1 |
| `#$FF60` | 160px backward | 1 |
| `#$FFC0` | 64px backward | 1 |
| `#$0002` | 2px forward | 1 |
| `#$0003` | 3px forward | 1 |

### Usage (24 sites)

Three main contexts:

1. **Credits scroll actors** (`credits/credits_heroes/*.asm`, 4 sites): Large lateral shifts (`#$00A0`, `#$FF60`) to position characters entering/exiting the credits scroll.

2. **Battle movement** (`chunk_038000.asm`, 8 sites): Small forward offsets (`#$0008`–`#$0010`) during attack approach animations. Often paired with `[86]` (anim set + speed + velocity) and `[98]` (anim wait multi-frame).

3. **Actor initialization** (`actor_04BCB7.asm`, `actor_04E651.asm`, etc., 12 sites): Repositioning after spawn or during cutscenes. Sometimes used mid-script to shift position between animation sequences.

### Source examples

```
; Credits: slide hero 160px forward
COP [B7] ( #$00A0 )

; Battle: nudge 16px forward during attack
COP [B7] ( #$0010 )
COP [86] ( #0C, #05, #08 )
COP [98]

; Title screen: shift 32px backward, then wait
COP [B7] ( #$FFE0 )
COP [D0] ( #$0078 )
```

---

## `[B8]` — `adjust_pos_y`

Adjusts the actor's Y position by a signed offset. No facing check — the offset is always applied directly.

### Handler: `code_00C7B3`

```
code_00C7B3:
  TYX
  LDA [$2C] : INC $2C : INC $2C ; read Word (Y offset)
  CLC : ADC $02 : STA $02       ; apply to Y position
  LDA $2C : STA $02, S : RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `Word` (2 bytes) | `$02` adj | Signed Y offset (always direct — positive = down) |

### Usage (27 sites)

Primary use cases:

1. **Battle system** (`chunk_038000.asm`, 11 sites): Vertical repositioning during combat — often large negative offsets like `#$FFC0` (−64px, jumping up) or `#$FF70` (−144px) for attack arc positioning.

2. **Player host** (`chunk_0B8000.asm`, 2 sites): Large upward shifts (`#$FF00` = −256px) for screen transition effects.

3. **System actors** (`actor_02F55D.asm`, `actor_02F8C2.asm`, etc., 6 sites): Vertical position setup for UI elements and menu cursors.

4. **Misc** (`actor_04DB88.asm`, `actor_04ED40.asm`, title screen, etc., 8 sites): Small tweaks (`#$FFF8` = −8px up, `#$0008` = 8px down).

### Source examples

```
; Battle: jump 64px upward
COP [B8] ( #$FFC0 )

; Player host: large vertical shift for transition
COP [B8] ( #$FF00 )

; Small downward nudge
COP [B8] ( #$0008 )
```

---

## `[B9]` — `adjust_pos_xy`

Adjusts both axes in one instruction — facing-relative X followed by direct Y. Functionally equivalent to `COP [B7] + COP [B8]`.

### Handler: `code_00C7C4`

```
code_00C7C4:
  TYX
  LDA $0A : ASL : ASL           ; facing check
  LDA [$2C] : INC $2C : INC $2C ; read Word (X offset)
  BCC +                         ; if facing right
  EOR #$FFFF : INC              ; negate for left
+ CLC : ADC $00 : STA $00      ; apply X
  LDA [$2C] : INC $2C : INC $2C ; read Word (Y offset)
  CLC : ADC $02 : STA $02       ; apply Y
  LDA $2C : STA $02, S : RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `Word` (2 bytes) | `$00` adj | Signed X offset (facing-relative) |
| 2 | `Word` (2 bytes) | `$02` adj | Signed Y offset (direct) |

### Usage (21 sites)

1. **Title screen** (`actor_04E651.asm`, `actor_04E60C.asm`, `actor_04E5C1.asm`, 3 sites): Initial positioning of title screen elements relative to spawn point.

2. **Prologue cutscenes** (`prologue_hackers/*.asm`, 5 sites): Character positioning during intro sequences. Small X + Y adjustments.

3. **Battle system** (`chunk_038000.asm`, 6 sites): Combined attack movement — both horizontal and vertical shifts for special moves. Includes the "approach + arc" pattern:
   ```
   COP [B9] ( #$0004, #$0002 )    ; nudge 4px forward, 2px down
   COP [06]                        ; loop
   ```

4. **Scene actors** (`actor_02EDE2.asm`, `actor_06EE38.asm`, etc., 7 sites): Placement and movement during cutscene sequences.

### Source examples

```
; Title screen: position logo element
COP [B9] ( #$FFE0, #$FFF8 )

; Battle: continuous small movement loop
COP [B9] ( #$0006, #$0001 )
BRA loop

; Prologue: position character
COP [B9] ( #$FFE8, #$0004 )
```

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `B7` | `adjust_pos_x` | 24 |
| `B8` | `adjust_pos_y` | 27 |
| `B9` | `adjust_pos_xy` | 21 |
| | **Total** | **72** |

## Family notes

1. **Same facing mechanism as spawn ops**: The `LDA $0A; ASL; ASL` → carry → negate pattern is identical to `[A5]`/`[AD]`/`[AE]`/`[B1]`. The difference is that spawn ops set the child's initial position at spawn time, while B7-B9 adjust the actor's own position mid-script.

2. **No velocity involvement**: These ops move the actor instantly (position delta) rather than through velocity. Compare with `[B4]`–`[B6]` (velocity set) which change the rate of movement that is consumed by animation ticks.

3. **Balanced usage**: Unlike many combinatorial families where one variant dominates, all three ops see substantial use (24/27/21). The X-only and Y-only variants are used when only one axis needs adjustment, which is common in battle (lateral approach) and scrolling (vertical shifts).

4. **Y is never facing-relative**: Only the X offset is affected by the actor's facing direction. Y always means up (negative) or down (positive) regardless of facing. This matches the standard 2D side-perspective convention where left/right matters for facing but up/down does not.

5. **Loop pattern**: Several sites use `[B9]` inside a tight loop (`COP [B9] + BRA`) to create continuous movement without the velocity/animation system. This is a simple way to move an actor at a fixed per-frame rate.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Actor Spawn — Main Chain](actor_spawn.md) `[A5]`/`[A6]` | Same facing-relative offset applied at spawn time to child position |
| [Actor Spawn — Render Chain](actor_spawn_render.md) `[AD]`/`[AE]`/`[B1]` | Same facing-relative offset at spawn time |
| [Velocity Set](velocity_set.md) `[B4]`–`[B6]` | Velocity approach to movement (rate-based) vs position adjust (instant delta) |
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | Often paired: B7/B8/B9 repositions, then animation ops configure movement animation |
