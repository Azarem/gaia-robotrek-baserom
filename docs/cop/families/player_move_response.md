# Player Move Response (`[BE]`–`[C0]`)

Three opcodes that handle the player's collision response after a directional tile check (`[BA]`–`[BD]`). They set up walking animation, velocity, and direction state based on the tile type encountered. All three are **player-host exclusive** (only used in `actor_0BD8F4.asm` / `chunk_0B8000.asm`).

## Overview

| Op | Name | Axis | Parameters | Handler | Uses |
|----|------|------|------------|---------|-----:|
| `BE` | `move_response_horiz` | Horizontal (R/L) | Byte, &Code | `code_00C84E` | 2 |
| `BF` | `move_response_vert` | Vertical (U/D) | Byte, &Code | `code_00C8CD` | 2 |
| `C0` | `move_response_idle` | Idle/standing | Byte | `code_00C94C` | 1 |

### Typical call sequence

```
LDA #$0001 : STA $0C        ; direction = right
COP [BA]                     ; check_tile_right → $30
COP [BE] (#FF, &idle_handler); move response; branch to idle if blocked
LDA $30 : STA $0BAC          ; dispatch on tile type (doors, stairs, etc.)
```

The player host always follows `[BA]`/`[BB]` with `[BE]`, and `[BC]`/`[BD]` with `[BF]`. When the player is standing still (at `code_0BD937`), it calls `[C0]` instead.

---

## `[BE]` — `move_response_horiz`

Collision response for horizontal (right/left) movement.

### Parameters
- **Byte**: special tile enable flag (nonzero = handle type-2 tiles)
- **&Code**: branch target if blocked (`$30 == #$0F`) or no movement available

### Handler: `code_00C84E`

1. If `$30 == #$000F` (solid wall) → branch to &Code target
2. Clear scratch: `$0006 = 0`, `$0004 = 0`
3. Set animation state: `$0BAE = $7F101A,X = #$0009` (walking)
4. If `$0560 bit #$8000` set: change to `#$000B` (alternate walk, e.g. ice/slippery) and set `$0004 = #$0018`
5. `code_00E4E1`: update direction bits in `$0A10,Y` based on tile type and direction
6. `code_00E3BA`: look up cross-axis velocity from tile/direction tables → result → `$1E` (Y velocity)
7. Clear `$10` (timer)
8. If `code_00E3BA` returned carry set (idle/no valid movement) → branch to &Code target
9. **Special tile handling** (if byte operand ≠ 0 AND `$30 == #$0002`):
   - `$09F8 >> 2 AND #$3F` → `$7F000C,X` (animation ID override, if nonzero)
   - `$09FE` → `$1C` (X velocity override)
   - `$0A00` → `$1E` (Y velocity override, if nonzero)
   - `$09FC` high byte → `$12` (animation duration)
10. Skip &Code pointer, continue script

The special tile handling applies stair/slope corrections: when moving horizontally on stairs, a Y velocity component is applied so the player moves diagonally.

### Usage (2 sites)

| File | Line | Context |
|------|------|---------|
| `actor_0BD8F4.asm:144` | `COP [BE] ( #FF, &code_0BD937 )` | After `COP [BA]` (right check), `$0C = 1` |
| `actor_0BD8F4.asm:207` | `COP [BE] ( #FF, &code_0BD937 )` | After `COP [BB]` (left check), `$0C = 0` |

---

## `[BF]` — `move_response_vert`

Collision response for vertical (up/down) movement. Structurally identical to `[BE]` but swaps axis assignments.

### Parameters
- **Byte**: special tile enable flag
- **&Code**: branch target if blocked

### Handler: `code_00C8CD`

Same flow as `[BE]` except:
- Step 6: velocity from `code_00E3BA` → `$1C` (X velocity, cross-axis for vertical movement)
- Step 9: Special tile overrides swap — `$0A00` → `$1E` (Y velocity), `$09FE` → `$1C` (X velocity), `$09FA` high byte → `$12`

### Usage (2 sites)

| File | Line | Context |
|------|------|---------|
| `actor_0BD8F4.asm:253` | `COP [BF] ( #FF, &code_0BD937 )` | After `COP [BC]` (up check), `$0C = 2` |
| `actor_0BD8F4.asm:297` | `COP [BF] ( #FF, &code_0BD937 )` | After `COP [BD]` (down check), `$0C = 3` |

---

## `[C0]` — `move_response_idle`

Idle/standing animation setup. Called when the player stops or hits a wall.

### Parameters
- **Byte**: special tile enable flag

### Handler: `code_00C94C`

1. Clear scratch: `$0004 = 0`, `$0006 = 0`
2. Set animation state: `$0BAE = $7F101A,X = #$0009`
3. Clear direction bits in `$0A10,Y`: `AND #$FFC3`
4. `code_00E420`: look up idle animation from `word_01C78D` table → sets `$7F000C,X` (animation ID) and `$12` (duration)
5. Clear all motion: `$10 = 0`, `$1C = 0`, `$1E = 0`
6. **Special tile handling** (if byte operand ≠ 0 AND `$30 == #$0002`):
   - `$09FE` → `$1C` (X velocity)
   - `$0A00` → `$1E` (Y velocity)
   - `$09F8 >> 2 AND #$3F`: if nonzero → `$7F000C,X` (animation ID)
   - If zero: compute duration from `$09FA | $09FC` — shifts and scales based on comparison with `#$0003`

Unlike BE/BF, C0 always returns C=1 (from `code_00E420`) since there's no movement to validate.

### Usage (1 site)

| File | Line | Context |
|------|------|---------|
| `actor_0BD8F4.asm:43` | `COP [C0] ( #FF )` | In `code_0BD937` (idle handler), after `COP [44]` + `COP [48]` |

---

## Helper functions

### `code_00E4E1` — Direction state update

Updates the player's direction bits in `$0A10,Y` (state array indexed by `$04`):
1. Clears bits: `$0A10,Y AND #$FFC3`
2. Computes index from `$30` (tile type) × 8 + `$7F101C,X`
3. Optionally adds `#$0080` if `$05B0` bit 0 is set (alternate mapping)
4. OR's with direction byte from `byte_08D454` table

### `code_00E3BA` — Movement velocity/animation lookup

Looks up the player's walking animation and velocity based on the current tile type and direction:
1. Reads `$7F101A,X` (movement state) and `$30` (tile type) to compute table index
2. Looks up `byte_01C645` — movement availability byte (0 = idle)
3. If nonzero: adjusts for direction and `$0C` to compute animation ID → `$7F000C,X`
4. Looks up `word_01C745` — packed velocity/duration: low byte → `$12` (duration), high byte → velocity via `code_00E398`
5. Returns A = velocity, C = 0 (movement available)
6. If availability byte is 0: falls through to `code_00E420` (idle)

### `code_00E420` — Idle animation lookup

Called when no movement is available:
1. Reads `$7F101A,X`, masks to `AND #$FFFC`, shifts left
2. Looks up `word_01C78D` — idle animation table
3. Stores animation ID to `$7F000C,X`, duration to `$12`
4. Returns A = 0, C = 1 (no movement)

---

## WRAM addresses

| Address | Role |
|---------|------|
| `$0BAE` | Current movement animation state (9 = walk, 11 = alternate walk) |
| `$0BAC` | Last tile type encountered (copy of `$30`) |
| `$0560` | Movement mode flags (bit 15 = alternate walk, e.g. ice) |
| `$0A10,Y` | Player direction state array (indexed by `$04`); bits cleared by `#$FFC3`, set from `byte_08D454` |
| `$09F8` | Tile-specific data: animation ID (bits 7-2) |
| `$09FA` | Tile-specific data: vertical direction component |
| `$09FC` | Tile-specific data: duration (high byte) |
| `$09FE` | Tile-specific data: X velocity component |
| `$0A00` | Tile-specific data: Y velocity component |
| `$0BBE` | Cached animation duration (written when actor == `$0EEE`) |

### Data tables (bank `$01`)

| Table | Size | Role |
|-------|------|------|
| `byte_01C645` | ? | Movement availability by tile+direction (0 = idle) |
| `word_01C745` | ? | Packed velocity+duration for walking |
| `word_01C78D` | ? | Packed animation ID+duration for idle |

### Data tables (bank `$08`)

| Table | Size | Role |
|-------|------|------|
| `byte_08D454` | ? | Direction bits for `$0A10,Y` |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `BE` | `move_response_horiz` | 2 |
| `BF` | `move_response_vert` | 2 |
| `C0` | `move_response_idle` | 1 |
| | **Total** | **5** |

## Family notes

1. **Player-host exclusive**: All 5 call sites are in the player actor (`actor_0BD8F4.asm` / `chunk_0B8000.asm`). No NPC or other actor uses these ops.

2. **Tightly coupled to tile collision**: BE/BF always follow a `[BA]`-`[BD]` collision check. The `$30` result from the collision determines whether to walk, idle, or trigger a special tile response. C0 is the idle fallback used when the player stops at `code_0BD937`.

3. **Stair/slope handling**: The special tile path (type `#$02`) applies cross-axis velocity so the player moves diagonally on stairs. The data registers `$09F8`–`$0A00` are presumably written by the tile collision system when it encounters a stair tile.

4. **Alternate walk mode**: `$0560 bit #$8000` switches to animation state 11 and adds offset `$0004 = #$0018`. This likely corresponds to slippery surfaces (ice, etc.) where a different walk animation and speed profile is used.

5. **Direction convention**: `$0C` encodes the direction index: 0=left, 1=right, 2=up, 3=down. This is set before the `[BA]`-`[BD]` collision check and consumed by BE/BF/C0 to select the correct animation and velocity.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Tile Collision](tile_collision.md) `[BA]`–`[BD]` | Always called immediately before BE/BF; provides `$30` tile type |
| [Screen Edge Branch](screen_edge_branch.md) `[C1]`–`[C4]` | Called after movement response in some modes; gates map transition |
| [Collision / Solid](collision.md) `[44]`–`[49]` | `[44]`/`[48]` used alongside C0 for idle tile occupation |
