# Screen Edge Branch (`[C1]`–`[C4]`)

Four opcodes that conditionally branch when the actor is near a screen boundary. Each takes a margin byte and a code pointer: if the actor's position (adjusted by the margin) exceeds the corresponding screen edge, execution jumps to the target. Otherwise the code pointer is skipped and execution continues normally.

All four are **player-host exclusive** (only used in `chunk_0B8000.asm`).

## Overview

| Op | Name | Edge | Boundary | Parameters | Handler | Uses |
|----|------|------|----------|------------|---------|-----:|
| `C1` | `branch_screen_top` | Top | `$0862` | Byte, &Code | `code_00C9C1` | 3 |
| `C2` | `branch_screen_bottom` | Bottom | `$0866` | Byte, &Code | `code_00C9E2` | 3 |
| `C3` | `branch_screen_left` | Left | `$0860` | Byte, &Code | `code_00C9FB` | 3 |
| `C4` | `branch_screen_right` | Right | `$0864` | Byte, &Code | `code_00CA1C` | 3 |

### Parameters (all four)

- **Byte**: margin — how many pixels inside the edge to trigger
- **&Code**: branch target when the edge condition is met

---

## `[C1]` — `branch_screen_top`

Branches if the actor is near the **top** edge of the visible screen.

### Handler: `code_00C9C1`

```
  operand = read byte (margin)
  test = $02 - margin - 16 - 1
  if test < $0862 → branch to &Code (near top edge)
  else → skip &Code, continue (JMP code_009F00)
```

The `−16` offset centers the check on the actor's body (same as the tile collision probe).

### Usage (3 sites)

| Line | Call | Context |
|------|------|---------|
| 10067 | `COP [C1] ( #20, &code_0BDF7F )` | Walk mode: `$0C = 1` (up), margin 32px |
| 10192 | `COP [C1] ( #10, &code_0BE0B9 )` | Alternate mode: `$0C = 1`, margin 16px |
| 10283 | `COP [C1] ( #10, &code_0BE17E )` | Third mode: `$0C = 1`, margin 16px |

---

## `[C2]` — `branch_screen_bottom`

Branches if the actor is near the **bottom** edge of the visible screen.

### Handler: `code_00C9E2`

```
  operand = read byte (margin)
  test = $02 + margin + 1
  if test >= $0866 → branch to &Code (near bottom edge)
  else → skip &Code, continue
```

### Usage (3 sites)

| Line | Call | Context |
|------|------|---------|
| 10059 | `COP [C2] ( #00, &code_0BDF7F )` | Walk mode: `$0C = 0` (down), margin 0 |
| 10184 | `COP [C2] ( #10, &code_0BE0B9 )` | Alternate mode: `$0C = 0`, margin 16px |
| 10275 | `COP [C2] ( #00, &code_0BE17E )` | Third mode: `$0C = 0`, margin 0 |

---

## `[C3]` — `branch_screen_left`

Branches if the actor is near the **left** edge of the visible screen.

### Handler: `code_00C9FB`

```
  operand = read byte (margin)
  test = $00 - margin - 8 - 1
  if test < $0860 → branch to &Code (near left edge)
  else → skip &Code, continue
```

The `−8` offset centers the check horizontally (same as tile collision probe).

### Usage (3 sites)

| Line | Call | Context |
|------|------|---------|
| 10075 | `COP [C3] ( #00, &code_0BDF7F )` | Walk mode: `$0C = 2` (left), margin 0 |
| 10200 | `COP [C3] ( #10, &code_0BE0B9 )` | Alternate mode: `$0C = 2`, margin 16px |
| 10291 | `COP [C3] ( #00, &code_0BE17E )` | Third mode: `$0C = 2`, margin 0 |

---

## `[C4]` — `branch_screen_right`

Branches if the actor is near the **right** edge of the visible screen.

### Handler: `code_00CA1C`

```
  operand = read byte (margin)
  test = $00 + margin + 8 + 1
  if test >= $0864 → branch to &Code (near right edge)
  else → skip &Code, continue
```

### Usage (3 sites)

| Line | Call | Context |
|------|------|---------|
| 10083 | `COP [C4] ( #00, &code_0BDF7F )` | Walk mode: `$0C = 3` (right), margin 0 |
| 10208 | `COP [C4] ( #10, &code_0BE0B9 )` | Alternate mode: `$0C = 3`, margin 16px |
| 10299 | `COP [C4] ( #00, &code_0BE17E )` | Third mode: `$0C = 3`, margin 0 |

---

## Screen boundary WRAM

| Address | Role |
|---------|------|
| `$0860` | Screen left edge (pixels) |
| `$0862` | Screen top edge (pixels) |
| `$0864` | Screen right edge (pixels) |
| `$0866` | Screen bottom edge (pixels) |

These are the visible viewport boundaries in world coordinates. They are updated as the camera scrolls and represent the currently visible area of the map.

## Skip mechanism

When the edge condition is **not** met, all four handlers jump to `code_009F00`, which skips the 2-byte &Code operand (`INC $2C; INC $2C`) and returns via RTI. This is the standard COP "skip branch target and continue" dispatcher shared with many conditional branch opcodes.

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `C1` | `branch_screen_top` | 3 |
| `C2` | `branch_screen_bottom` | 3 |
| `C3` | `branch_screen_left` | 3 |
| `C4` | `branch_screen_right` | 3 |
| | **Total** | **12** |

## Call site pattern

The player host has **three movement mode blocks**, each containing all four edge checks in the same order:

1. **Walk mode** (`code_0BDF86`–`code_0BDFB9`): branches to `code_0BDF7F`
2. **Alternate mode** (`code_0BE0C0`–`code_0BE0F3`): branches to `code_0BE0B9`
3. **Third mode** (`code_0BE185`–`code_0BE1B6`): branches to `code_0BE17E`

Each block follows the same pattern:
```
STZ $0C                          ; direction = 0 (down)
COP [C2] (margin, &handler)      ; check bottom edge
COP [82]/[80] (anim)             ; play movement animation
COP [97]                         ; wait for animation
BRA loop                         ; loop back

LDA #$0001 : STA $0C             ; direction = 1 (up)
COP [C1] (margin, &handler)      ; check top edge
COP [82] (anim)
COP [97]
BRA loop

LDA #$0002 : STA $0C             ; direction = 2 (left)
COP [C3] (margin, &handler)
COP [81] (anim)
COP [97]
BRA loop

LDA #$0003 : STA $0C             ; direction = 3 (right)
COP [C4] (margin, &handler)
COP [81] (anim)
COP [97]
BRA loop
```

The edge check gates whether the movement animation plays. When at the edge, branching to the handler triggers a map transition or prevents further movement.

## Family notes

1. **Player-host exclusive**: All 12 call sites are in the player actor. No NPC uses screen edge checks — they use tile collision only.

2. **Map transition gate**: The branch targets (`code_0BDF7F`, `code_0BE0B9`, `code_0BE17E`) are the map-transition/edge-stop handlers for each movement mode. When the player reaches the screen boundary, movement animation is suppressed and the handler decides whether to scroll the map, transition to a new area, or stop.

3. **Asymmetric margins**: The top edge (`C1`) in walk mode uses margin `#$20` (32 pixels), while bottom/left/right use `#$00`. This likely accounts for the HUD or status bar at the top of the screen. The alternate/third modes use `#$10` (16 pixels) for top and sometimes for others.

4. **Probe offset matches tile collision**: The `−8` (X) and `−16` (Y) adjustments are identical to those in `[BA]`–`[BD]`, centering the check on the actor's body rather than the anchor point.

5. **Direction convention**: Matches the `$0C` values used by `[BA]`–`[BD]` and `[BE]`–`[C0]`: 0=down, 1=up, 2=left, 3=right.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Tile Collision](tile_collision.md) `[BA]`–`[BD]` | Checks tile passability; screen edge is a separate spatial check |
| [Player Move Response](player_move_response.md) `[BE]`–`[C0]` | Called before screen edge checks in the movement pipeline |
| [Proximity](proximity.md) `[0E]`–`[16]` | Similar conditional branch pattern, but checks distance to player rather than screen bounds |
