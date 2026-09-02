# Proximity 3-Way Branch — COP `[7A]` `[7B]`

> Deep-audited ops: `[7A]` `[7B]`

## Overview

Three-way **axis proximity branches** that compare the player's distance from the current actor along a single axis and dispatch to one of three code targets: far-negative (left/above), near (within threshold), or far-positive (right/below).

| Op | Axis | Globals used | Center offset |
|----|------|-------------|---------------|
| `[7A]` | Horizontal (X) | `$0BA6` (player X) − `$00` (actor X) | +8 pixels |
| `[7B]` | Vertical (Y) | `$0BA8` (player Y) − `$02` (actor Y) | +16 pixels |

Both ops use the same player-position globals as the `[0E]`–`[16]` proximity family, filled by `code_00FA5E`.

## Shared state

| Address | Role |
|---------|------|
| `$0BA6` | Player cell X (player `$00` − 8) |
| `$0BA8` | Player cell Y (player `$02` − 16) |
| `$00` | Actor X position (from direct page) |
| `$02` | Actor Y position (from direct page) |
| `$2C` | Script pointer — operands read at `[$2C],Y` |

## Opcodes

---

#### COP [7A] — `branch_x_3way` (horizontal 3-way proximity branch)

- **Confidence:** high
- **Preferred name:** `branch_x_3way`
- **Aliases:** `proximity_x_3way`, `branch_player_x`
- **Handler:** `code_00BD5F` @ chunk_008000.asm:8698–8724
- **Parameters:** `Word` (threshold), `&Code` (left), `&Code` (near), `&Code` (right)
- **Usage count:** 7

##### Operand layout

| Offset | Field | Meaning |
|--------|-------|---------|
| 0 | Word | Distance threshold (pixels) |
| 2 | &Code | Branch target if player is far LEFT |
| 4 | &Code | Branch target if player is NEAR (within threshold) |
| 6 | &Code | Branch target if player is far RIGHT |

##### What it does

```asm
code_00BD5F {
    TYX
    LDY #$0004             ; default: Y=4 → near
    LDA $0BA6              ; player X
    CLC
    ADC #$0008             ; + 8 (center player sprite)
    SEC
    SBC $00                ; − actor X
                           ; A = signed horizontal distance
    BEQ loc_00BD85         ; zero → near
    BPL loc_00BD7D         ; positive → player is RIGHT of actor

    ; player is LEFT (distance negative)
    EOR #$FFFF             ; negate → absolute distance
    CMP [$2C]              ; compare with threshold
    BCC loc_00BD85         ; < threshold → near
    LDY #$0002             ; >= threshold → left
    BRA loc_00BD85

  loc_00BD7D:              ; player is RIGHT
    DEC                    ; distance − 1
    CMP [$2C]              ; compare with threshold
    BCC loc_00BD85         ; < threshold → near
    LDY #$0006             ; >= threshold → right

  loc_00BD85:
    LDA [$2C], Y           ; read &Code at offset Y
    STA $02, S             ; set return address
    RTI
}
```

##### Decision table

| Player position relative to actor | Distance vs threshold | Branch target |
|-----------------------------------|-----------------------|---------------|
| Exactly at actor X | — | **Near** (offset 4) |
| To the LEFT, abs(dist) < threshold | within range | **Near** (offset 4) |
| To the LEFT, abs(dist) >= threshold | out of range | **Left** (offset 2) |
| To the RIGHT, (dist−1) < threshold | within range | **Near** (offset 4) |
| To the RIGHT, (dist−1) >= threshold | out of range | **Right** (offset 6) |

The `DEC` on the right-side path makes the threshold slightly asymmetric (right requires distance > threshold, left requires distance >= threshold). In practice with typical thresholds of 16–112 pixels this difference is negligible.

---

#### COP [7B] — `branch_y_3way` (vertical 3-way proximity branch)

- **Confidence:** high
- **Preferred name:** `branch_y_3way`
- **Aliases:** `proximity_y_3way`, `branch_player_y`
- **Handler:** `code_00BD8A` @ chunk_008000.asm:8726–8752
- **Parameters:** `Word` (threshold), `&Code` (above), `&Code` (near), `&Code` (below)
- **Usage count:** 2

##### Operand layout

| Offset | Field | Meaning |
|--------|-------|---------|
| 0 | Word | Distance threshold (pixels) |
| 2 | &Code | Branch target if player is far ABOVE |
| 4 | &Code | Branch target if player is NEAR (within threshold) |
| 6 | &Code | Branch target if player is far BELOW |

##### What it does

```asm
code_00BD8A {
    TYX
    LDY #$0004             ; default: Y=4 → near
    LDA $0BA8              ; player Y
    CLC
    ADC #$0010             ; + 16 (center player sprite)
    SEC
    SBC $02                ; − actor Y
                           ; A = signed vertical distance
    BEQ loc_00BDB0         ; zero → near
    BPL loc_00BDA8         ; positive → player is BELOW actor

    ; player is ABOVE (distance negative)
    EOR #$FFFF             ; negate → absolute distance
    CMP [$2C]              ; compare with threshold
    BCC loc_00BDB0         ; < threshold → near
    LDY #$0002             ; >= threshold → above
    BRA loc_00BDB0

  loc_00BDA8:              ; player is BELOW
    DEC                    ; distance − 1
    CMP [$2C]              ; compare with threshold
    BCC loc_00BDB0         ; < threshold → near
    LDY #$0006             ; >= threshold → below

  loc_00BDB0:
    LDA [$2C], Y           ; read &Code at offset Y
    STA $02, S             ; set return address
    RTI
}
```

Identical logic to `[7A]` but on the vertical axis.

## Usage patterns

### Single-axis patrol (most common)

The mansion/cave actors use `[7A]` alone to create left-right patrol behavior:

```asm
  code_06F7A1:
    COP [80] ( #00 )                 ; idle animation
    COP [97]                          ; yield
    COP [7A] ( #$0060, &code_06F7A1, &code_06F7B0, &code_06F7A1 )
    ;           threshold=96px  LEFT→idle   NEAR→act    RIGHT→idle
```

The breezeway bat stays idle when the player is far away on either side, and acts when the player is within 96 pixels. The two branch-to-self targets create a "hold position until player approaches" loop.

### 2D quadrant dispatch (system actor)

`actor_0C8000` chains `[7B]` → `[7A]` to create a full 2D proximity quadrant system:

```asm
  code_0C8140:
    COP [CC]                          ; yield
    COP [63] ( &code_0C8140 )        ; wait-facing
    COP [7B] ( #$0010, &above, &near_y, &below )

  near_y:
    COP [7A] ( #$0010, &left, &near_xy, &right )

  near_xy:
    COP [7B] ( #$0000, &above2, &exact_y, &below2 )

  exact_y:
    COP [7A] ( #$0000, &left2, &exact_xy, &right2 )
```

The first pair (threshold 16) determines the quadrant; the second pair (threshold 0) refines to the exact direction. Each leaf sets a different animation frame via `COP [80]`.

### Threshold values observed

| Threshold | Pixels | Context |
|-----------|-------:|---------|
| `#$0000` | 0 | Exact position match (system actor fine pass) |
| `#$0010` | 16 | 1 tile (system actor coarse pass) |
| `#$0040` | 64 | 4 tiles (mansion east foyer ghost) |
| `#$0060` | 96 | 6 tiles (mansion breezeway bat) |
| `#$0070` | 112 | 7 tiles (seaside cave guard) |

## Usage statistics

| Op | Name | Sites | Files |
|----|------|------:|------:|
| `[7A]` | `branch_x_3way` | 7 | 3 |
| `[7B]` | `branch_y_3way` | 2 | 1 |
| | **Total** | **9** | |

## Family notes

- These ops are **sibling to the `[0E]`–`[16]` proximity family** — they read the same player-position globals (`$0BA6`/`$0BA8`) filled by `code_00FA5E`. The difference is that `[0E]`–`[16]` provide 2-way branches (condition met → jump, else continue), while `[7A]`/`[7B]` provide 3-way branches (left/near/right or above/near/below).
- The center offsets (+8 for X, +16 for Y) correspond to the player sprite's 16×32 bounding box center. `$0BA6` stores `player.$00 − 8` and `$0BA8` stores `player.$02 − 16`, so adding back 8/16 recovers the true sprite position.
- `[7A]` is used 3.5× more than `[7B]` because horizontal patrol/approach is more common than vertical.
- The `DEC` on the positive-distance path introduces a 1-pixel asymmetry in the threshold comparison. This is likely intentional to avoid a double-count at exactly the threshold distance, or simply a minor engine quirk.
- `[7B]` is only used by the system actor `actor_0C8000`, always in cascade with `[7A]`. No standalone vertical 3-way usage exists in the ROM.

## Relationship to other families

```
[7A]/[7B] ←→ [0E]–[16] proximity family
  Same globals ($0BA6/$0BA8), same code_00FA5E snapshot
  [0E]–[16]: 2-way branch (condition → target, else continue)
  [7A]/[7B]: 3-way branch (far-neg / near / far-pos)

[7A]/[7B] ←→ [63] wait_facing (interact_wait family)
  Often used together: [63] yields until player faces actor,
  then [7A]/[7B] dispatches based on approach direction
```
