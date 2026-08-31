# COP family: Proximity / player position

_Deep-audited ops: `[0E]`, `[0F]`, `[10]`, `[11]`, `[12]`, `[13]`, `[14]`, `[15]`, `[16]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Branch when the player (or another actor) matches a geometric / facing test. Handlers read globals filled by `code_00FA5E` (`$0BA6`/`$0BA8`/`$0BAA`), not the player actor directly. Covers AABB, exact cell, axis-only, and relative-to-self variants.

## Shared state

- `$0BA6` / `$0BA8` — player cell X/Y (sprite −8 / −16)
- `$0BAA` — player facing
- `$0BB2` / `$0BB4` — coarse player cell (`>>4`)
- `[14]`–`[16]` exist in the jump table but are unused / missing from copdef

## Family notes

- Facing filters and invert bits vary by opcode — see each op’s table.
- `[16]` tests another actor slot’s XY, not the player snapshot.
- Absolute ops (`[0E]`/`[10]`/`[12]`/`[13]`) take map-cell coords; relative ops add this actor’s cell.
- See **Shared reference** for the `code_00FA5E` snapshot and facing-byte encoding.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `0E` | `branch_if_in_rect` | 47 | high | Byte, Word, Word, &Code | `code_00A301` |
| `0F` | `branch_if_near` | 61 | high | Byte×5, &Code | `code_00A357` |
| `10` | `branch_if_at_xy_facing` | 145 | high | Byte, Byte, Byte, &Code | `code_00A3D3` |
| `11` | `branch_if_rel_xy_facing` | 32 | high | Byte, Byte, Byte, &Code | `code_00A401` |
| `12` | `branch_if_x_facing` | 5 | high | Byte, Byte, &Code | `code_00A422` |
| `13` | `branch_if_y_facing` | 18 | high | Byte, Byte, &Code | `code_00A458` |
| `14` | `branch_if_rel_x_facing` | 0 | high | (not in copdef; unused) | `code_00A446` |
| `15` | `branch_if_rel_y_facing` | 0 | high | (not in copdef; unused) | `code_00A47C` |
| `16` | `branch_if_actor_at_xy` | 0 | high | Byte×4, &Code (not in copdef; unused) | `code_00A48E` |

**Family call-site total:** 308

## Shared reference

#### Player position snapshot (`code_00FA5E`)

Proximity COPs `[0E]`–`[15]` do **not** read the player actor directly. Once per update, `code_00FA5E` copies the tracked entity (player) into globals:

```asm
; code_00FA5E (excerpt) — X = player actor
LDA $0000, X
SEC
SBC #$0008
STA $0BA6              ; cell X  (= sprite $00 − 8)
LS : LSR : LSR : LSR
STA $0BB2              ; coarse X
LDA $0002, X
SEC
SBC #$0010
STA $0BA8              ; cell Y  (= sprite $02 − 16)
LS : LSR : LSR : LSR
STA $0BB4              ; coarse Y
LDA $000C, X
STA $0BAA              ; facing
```

**Sprite vs cell:** actor `$00` ≈ cell_x+8, `$02` ≈ cell_y+16 (see also `COP [17]` which writes `$00 = x+8`). Scripts author **cell** coordinates; the −8/−16 bias recovers them.

**Facing byte** (first operand of `[0E]`/`[0F]`, third of `[10]`):

| Value | Meaning |
|-------|---------|
| `#7F` | Match any facing (`AND #$7F` then `CMP #$7F`) |
| `#00`–`#03` (etc.) | Require `$0BAA` equal that value |
| `#FF` | Any facing **and** invert branch (`BIT #$80`) |
| `#80\|dir` | Require facing **and** invert |

Bit7 of that byte **inverts** success: clear → branch to `&Code` when the geometric test passes; set → branch when it fails.

## Opcodes

#### COP [0E] — `branch_if_in_rect` (absolute cell AABB + facing)

- **Confidence:** high (handler + `code_00FA5E` + call-site audit)
- **Preferred name:** `branch_if_in_rect`
- **Aliases:** `branch_if_player_in_box`, `branch_if_on_tiles`, `branch_if_in_xy_range`
- **Handler:** `code_00A301` @ `extracted/system/chunk_008000.asm:4682-4741`
- **Parameters:** `Byte` (facing/polarity), `Word` (min corner), `Word` (max corner), `&Code`
- **Usage count:** 47

##### What it does

Tests whether **player cell** `($0BA6,$0BA8)` lies inside an inclusive axis-aligned rectangle, with optional facing filter.

Word operands are stored little-endian, so a literal `#$0514` emits bytes `14 05` → **minX=$14, minY=$05**. Authors typically write `#$minYminX, #$maxYmaxX`:

| Operand | Bytes (LE) | Role |
|---------|------------|------|
| `#$0514` | `14,05` | minX=14, minY=5 |
| `#$0519` | `19,05` | maxX=19, maxY=5 → horizontal strip |

Condition (facing OK):

```
minX ≤ $0BA6 ≤ maxX  AND  minY ≤ $0BA8 ≤ maxY
```

```asm
; Handler (complete)
code_00A301 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    PHA                     ; facing/polarity byte
    AND #$007F
    CMP #$007F
    BEQ rect_test           ; #7F / #FF → any facing
    CMP $0BAA
    BNE fail_skip4          ; facing mismatch

  rect_test:
    JSR $&code_00E510       ; minX
    CMP $0BA6
    BEQ +
    BCS fail_skip3          ; minX > playerX
  +:
    JSR $&code_00E510       ; minY
    CMP $0BA8
    BEQ +
    BCS fail_skip2
  +:
    JSR $&code_00E510       ; maxX
    CMP $0BA6
    BMI fail_skip1          ; maxX < playerX
    JSR $&code_00E510       ; maxY
    CMP $0BA8
    BMI fail_take           ; maxY < playerY
    PLA
    BIT #$0080
    BNE skip_code           ; invert: inside → fall through
  take:
    LDA [$2C]
    STA $02, S              ; jump &Code
    RTI

  fail_skip4: INC $2C
  fail_skip3: INC $2C
  fail_skip2: INC $2C
  fail_skip1: INC $2C
  fail_take:
    PLA
    BIT #$0080
    BNE take                ; invert: outside → jump
  skip_code:
    JMP $&code_009F00       ; skip &Code
}
```

##### Why / how used

Floor triggers and zone directors: warp pads, puzzle pressure plates, cutscene start when the player steps into a rectangle.

```asm
; west foyer — two vertical door lines (x=0x0D and x=0x17, y=0x1D..0x20)
COP [0E] ( #7F, #$1D0D, #$200D, &code_06E3D2 )
COP [0E] ( #7F, #$1D17, #$2017, &code_06E3D2 )

; shaman altar — horizontal strip y=5, x=14..19
COP [0E] ( #7F, #$0514, #$0519, &code_07D68B )
```

Almost always `#7F` (any facing). Rare `#00` / `#FF` for facing-gated or inverted tests.

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_in_rect #face, #$minYminX, #$maxYmaxX, &label` |
| Units | Map **cells** (same as `$0BA6`/`$0BA8`) |

- **JSR:** `code_00E510`
- **Source examples:**
  - `native_village/shaman_altar/actor_07D661.asm:17` — `#$0514, #$0519`
  - `prinkys_mansion/mansion_west_foyer/actor_06E3A9.asm:9-10` — twin vertical strips
  - `seaside_cave/cave_base_entrance/actor_069061.asm:20` — `#$0507, #$1C0D`
  - `unorganized/map_F2/actor_089DFB.asm:23` — `#FF` inverted point

#### COP [0F] — `branch_if_near` (AABB relative to this actor + facing)

- **Confidence:** high
- **Preferred name:** `branch_if_near`
- **Aliases:** `branch_if_player_near`, `branch_if_near_actor`, `branch_if_rel_rect`
- **Handler:** `code_00A357` @ `extracted/system/chunk_008000.asm:4743-4826`
- **Parameters:** `Byte` (facing/polarity), `Byte`×4 (corner deltas), `&Code`
- **Usage count:** 61

##### What it does

Same facing/invert rules as `[0E]`, but the rectangle is built from **this actor’s** `$00`/`$02` plus four corner offsets, using the same −8/−16 hotspot bias as `code_00FA5E`:

```
left   = dx0 − 8 + $00    ; clamp <0 → 0
top    = dy0 − 16 + $02   ; clamp <0 → 0
right  = dx1 − 8 + $00
bottom = dy1 − 16 + $02
```

Because `$00≈cell_x+8` and `$0BA6=cell_x`, this is algebraically:

```
cell_x + dx0  ≤  player_x  ≤  cell_x + dx1
cell_y + dy0  ≤  player_y  ≤  cell_y + dy1
```

So the four bytes are **cell deltas from this actor**. Call sites heavily use `$80+` values (`#FE`, `#F8`, `#FC`…) as small negatives (−2, −8, −4…). `code_00E510` zero-extends the byte (`AND #$00FF`); authoring treats bit7 as two’s-complement sign so those deltas form a valid AABB around the NPC.

```asm
; Handler (complete)
code_00A357 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    PHA                     ; facing/polarity
    AND #$007F
    CMP #$007F
    BEQ near_test
    CMP $0BAA
    BNE fail_skip4

  near_test:
    JSR $&code_00E510       ; dx0
    SEC
    SBC #$0008
    CLC
    ADC $00
    BPL +
    LDA #$0000              ; clamp
  +:
    CMP $0BA6
    BEQ +
    BCS fail_skip3          ; left > playerX
  +:
    JSR $&code_00E510       ; dy0
    SEC
    SBC #$0010
    CLC
    ADC $02
    BPL +
    LDA #$0000
  +:
    CMP $0BA8
    BEQ +
    BCS fail_skip2
  +:
    JSR $&code_00E510       ; dx1
    SEC
    SBC #$0008
    CLC
    ADC $00
    CMP $0BA6
    BMI fail_skip1          ; right < playerX
    JSR $&code_00E510       ; dy1
    SEC
    SBC #$0010
    CLC
    ADC $02
    CMP $0BA8
    BMI fail_take           ; bottom < playerY
    PLA
    BIT #$0080
    BNE skip_code
  take:
    LDA [$2C]
    STA $02, S
    RTI

  fail_skip4: INC $2C
  fail_skip3: INC $2C
  fail_skip2: INC $2C
  fail_skip1: INC $2C
  fail_take:
    PLA
    BIT #$0080
    BNE take
  skip_code:
    JMP $&code_009F00
}
```

##### Why / how used

NPC “talk when close” and chase/lead checks while the speaker walks (`[81]`/`[82]` + `[97]` then `[0F]`). Also directors with a fixed absolute-looking box when the actor sits at the origin.

```asm
; ~2×2 cell box around NPC (signed deltas)
COP [0F] ( #7F, #FE, #FE, #02, #02, &talk )

; after a walk step — box in front / beside
COP [82] ( #05, #12 )
COP [97]
COP [0F] ( #7F, #FE, #F8, #02, #00, &code_06DECC )

; inverted: branch if player is NOT overlapping actor cell
COP [0F] ( #FF, #00, #00, #00, #00, &away )
```

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_near #face, #dx0, #dy0, #dx1, #dy1, &label` |
| vs `[0E]` | Relative to **this** actor, not absolute map cells |

- **JSR:** `code_00E510`
- **Source examples:**
  - `fathers_house/chicken_farm/actor_07A78C.asm:10` — `#04,#0D,#0A,#0D` zone
  - `prinkys_mansion/mansion_east_hallway/actor_06DD4C.asm:43,49` — walk+near ladder
  - `seaside_cave/cave_base_entrance/actor_069061.asm:57-87` — multi-step near checks
  - `rococo/rococo/actor_05A48F.asm:13` — `#FF` inverted near

#### COP [10] — `branch_if_at_xy_facing` (exact cell + facing)

- **Confidence:** high
- **Preferred name:** `branch_if_at_xy_facing`
- **Aliases:** `branch_if_at_cell`, `branch_if_player_at`, `branch_if_at_xy_entity` (legacy; third byte is **facing**, not entity id)
- **Handler:** `code_00A3D3` @ `extracted/system/chunk_008000.asm:4828-4859`
- **Parameters:** `Byte` (cell X), `Byte` (cell Y), `Byte` (facing / `#FF`=any), `&Code`
- **Usage count:** 145 (most-used of the proximity trio)

##### What it does

Exact equality on player cell, then facing:

```
$0BA6 == X  AND  $0BA8 == Y  AND  (facing==#FF OR facing==$0BAA)
```

Unlike `[0E]`/`[0F]`, the facing byte here has **no invert bit** — `#FF` is only the any-facing wildcard (`CMP #$00FF`).

```asm
; Handler (complete)
code_00A3D3 {
    TYX
    JSR $&code_00E510       ; X
    CMP $0BA6
    BNE fail_skip2
    JSR $&code_00E510       ; Y
    CMP $0BA8
    BNE fail_skip1

  facing:
    LDA [$2C]
    INC $2C
    AND #$00FF
    CMP #$00FF
    BEQ take                ; #FF → any facing
    CMP $0BAA
    BNE skip_code           ; facing mismatch

  take:
    LDA [$2C]
    STA $02, S              ; jump &Code
    RTI

  fail_skip2: INC $2C
  fail_skip1: INC $2C
  skip_code:
    JMP $&code_009F00       ; skip facing byte + &Code
}
```

Note: miss paths cascade `INC $2C` so leftover operands are skipped — X-miss skips Y then facing then `&Code`; Y-miss skips facing then `&Code`; facing-miss only skips `&Code` via `code_009F00`.

##### Why / how used

Point triggers: stand on this tile (often with a required facing) to talk, set a flag, or start a cutscene. Frequently polled in a tight `COP [CC]` / `RTL` loop.

```asm
; director: watch two tiles
loc:
    COP [CC]
    COP [10] ( #0A, #06, #FF, &mark_a )
    COP [10] ( #07, #1C, #FF, &mark_b )
    RTL

; NPC waits for player on same cell, facing down (#01)
COP [17] ( #07, #26, #00 )          ; NPC stands here
...
COP [10] ( #07, #26, #01, &talk )   ; player must arrive facing 01
```

Facing operand counts: `#FF` (71), `#01` (32), `#00` (27), `#02` (9), `#03` (6).

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_at_xy_facing #x, #y, #face, &label` |
| Related | `[11]` = same test but X/Y are **relative** to this actor (`−8/+00`, `−16/+02`) |

- **JSR:** `code_00E510`
- **Source examples:**
  - `fathers_house/fathers_house/actor_078AA9.asm:9-10` — dual tile watchers
  - `rococo/tunnel_entrance/actor_05F686.asm:33` — `#07,#26,#01`
  - `system/actor_04BD1D.asm:21` — `#29,#16,#03`
  - `prinkys_mansion/mansion_west_foyer/actor_06E3A9.asm:11-12` — with `[0E]` ladder

#### COP [11] — `branch_if_rel_xy_facing` (exact cell relative to this actor)

- **Confidence:** high
- **Preferred name:** `branch_if_rel_xy_facing`
- **Aliases:** `branch_if_at_rel_xy`, `branch_if_on_me`, `branch_if_at_xy` (legacy; ambiguous with absolute `[10]`)
- **Handler:** `code_00A401` @ `extracted/system/chunk_008000.asm:4861-4878` (facing / miss paths shared with `[10]` at `loc_00A3E4` / `loc_00A3FA`)
- **Parameters:** `Byte` (dx), `Byte` (dy), `Byte` (facing / `#FF`=any), `&Code`
- **Usage count:** 32

##### What it does

Exact match of player cell against **this actor’s** cell plus deltas, then facing — the relative twin of `[10]`:

```
$0BA6 == ($00 + dx − 8)   AND   $0BA8 == ($02 + dy − 16)
AND (facing == #FF OR facing == $0BAA)
```

With the usual sprite convention (`$00≈cell_x+8`, `$02≈cell_y+16`) this is:

```
player_x == actor_cell_x + dx
player_y == actor_cell_y + dy
```

```asm
; Handler (complete) — falls into [10]'s facing / fail epilogue
code_00A401 {
    TYX
    JSR $&code_00E510       ; dx
    SEC
    SBC #$0008
    CLC
    ADC $00
    CMP $0BA6
    BNE loc_00A3FA          ; miss → skip dy, facing, &Code ([10] path)
    JSR $&code_00E510       ; dy
    SEC
    SBC #$0010
    CLC
    ADC $02
    CMP $0BA8
    BNE loc_00A3FC          ; miss → skip facing, &Code
    BRA loc_00A3E4          ; → [10] facing test + take/skip
}
```

No invert bit (same as `[10]`). No clamp on negative intermediate results (unlike `[0F]`).

##### Why / how used

“Is the player on / beside **me**?” — NPC interact, door/guard triggers, and directors spawned on a pad. Dominant pattern is **same cell, any facing**:

| Pattern | Meaning | Notes |
|---------|---------|-------|
| `#00, #00, #FF` | Player on this actor’s cell | Most common (~half of sites) |
| `#00, #00, #00` / `#01` | Same cell, specific facing | e.g. shaman house facing 0 |
| `#00, #FF, #FF` | One cell “north” (dy=`#FF`≈−1) | cave entrance approach |
| `#00, #FD, #FF` | dy≈−3 | cafeteria |
| `#01, #00, #FF` / `#FF, #00, #FF` | One cell east / west | bedroom / map_1A9 |

```asm
; NPC idle: react when player steps onto my tile
COP [11] ( #00, #00, #FF, &talk )
COP [CB]
RTL

; two approach cells (same X, y and y−1)
COP [11] ( #00, #FF, #FF, &from_north )
COP [11] ( #00, #00, #FF, &on_me )
```

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_rel_xy_facing #dx, #dy, #face, &label` |
| vs `[10]` | Absolute map cell vs actor-relative |
| vs `[0F]` | Exact point vs AABB |

- **JSR:** `code_00E510`
- **Source examples:**
  - `native_village/shaman_house/actor_07D621.asm:9` — `#00,#00,#00`
  - `seaside_cave/cave_base_entrance/actor_069061.asm:14-15` — `#00,#FF` / `#00,#00`
  - `prinkys_mansion/actor_06C370.asm:26,58` — `#00,#00,#FF`
  - `ocean/fishermans_hut/actor_079AB1.asm:21` — `#00,#FF,#FF`
  - `prinkys_mansion/mansion_west_bedroom/actor_06F1E6.asm:87` — `#01,#00,#FF`

#### COP [12] — `branch_if_x_facing` (absolute cell X + facing)

- **Confidence:** high
- **Preferred name:** `branch_if_x_facing`
- **Aliases:** `branch_if_x`, `branch_if_player_x`
- **Handler:** `code_00A422` @ `extracted/system/chunk_008000.asm:4880-4905`
- **Parameters:** `Byte` (cell X), `Byte` (facing / `#FF`=any), `&Code`
- **Usage count:** 5

##### What it does

```
$0BA6 == X  AND  (facing == #FF OR facing == $0BAA)
```

Y is ignored — a vertical line / column trigger on the map.

```asm
; Handler (complete)
code_00A422 {
    TYX
    JSR $&code_00E510       ; absolute cell X
    CMP $0BA6
    BNE miss_x

  facing:                   ; shared shape with [10]/[13]
    LDA [$2C]
    INC $2C
    AND #$00FF
    CMP #$00FF
    BEQ take
    CMP $0BAA
    BNE skip_code

  take:
    LDA [$2C]
    STA $02, S
    RTI

  miss_x:
    INC $2C                 ; skip facing
  skip_code:
    JMP $&code_009F00       ; skip &Code
}
```

##### Why / how used

Rare column gates: wait until the player reaches a given X (any facing almost always `#FF`). Hallway NPC that starts a cutscene when you cross X=$2A; transport / map scripts similarly.

```asm
loc:
    COP [80] ( #00 )
    COP [97]
    COP [12] ( #2A, #FF, &cutscene )   ; player cell X == 0x2A
    BRA loc
```

All 5 call sites: `#2A,#FF`, `#11,#FF`, `#21,#FF`, `#1D,#FF`, `#0D,#03` (only one with a concrete facing).

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_x_facing #x, #face, &label` |
| Relative twin | `[14]` (`code_00A446`) — unused / not in `copdef.json` |

- **JSR:** `code_00E510`
- **Source examples:**
  - `prinkys_mansion/mansion_east_hallway/actor_06DD4C.asm:16` — `#2A,#FF`
  - `seaside_cave/cave_transport/actor_069AF5.asm:27` — `#11,#FF`
  - `unorganized/map_ED/actor_089B53.asm:21` — `#0D,#03`

#### COP [13] — `branch_if_y_facing` (absolute cell Y + facing)

- **Confidence:** high
- **Preferred name:** `branch_if_y_facing`
- **Aliases:** `branch_if_y`, `branch_if_player_y`
- **Handler:** `code_00A458` @ `extracted/system/chunk_008000.asm:4919-4944`
- **Parameters:** `Byte` (cell Y), `Byte` (facing / `#FF`=any), `&Code`
- **Usage count:** 18

##### What it does

```
$0BA8 == Y  AND  (facing == #FF OR facing == $0BAA)
```

X ignored — a horizontal row / latitude trigger. Handler is the Y mirror of `[12]`.

```asm
; Handler (complete)
code_00A458 {
    TYX
    JSR $&code_00E510       ; absolute cell Y
    CMP $0BA8
    BNE miss_y

    LDA [$2C]
    INC $2C
    AND #$00FF
    CMP #$00FF
    BEQ take
    CMP $0BAA
    BNE skip_code

  take:
    LDA [$2C]
    STA $02, S
    RTI

  miss_y:
    INC $2C                 ; skip facing
  skip_code:
    JMP $&code_009F00
}
```

##### Why / how used

Row triggers and “when you reach this latitude” directors — often polled with `COP [CC]` / `RTL`. Common with a **required facing** (`#01` = down) so the event only fires when walking onto the row from the expected direction.

```asm
; illusion warning: two Y lines, facing down
COP [CC]
COP [13] ( #1A, #01, &line_a )
COP [13] ( #10, #01, &line_b )
RTL

; object waits until player reaches Y then moves
COP [0F] ( #FF, #F9, #FC, #06, #04, &wait )
COP [13] ( #17, #FF, &go )
```

Facing mix: many `#01` (map_162 / forest), also `#FF`, rare `#00`.

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_y_facing #y, #face, &label` |
| Relative twin | `[15]` (`code_00A47C`) — unused / not in `copdef.json` |

- **JSR:** `code_00E510`
- **Source examples:**
  - `forest_of_illusions/illusion_warning/actor_06AF58.asm:13-14` — `#1A,#01` / `#10,#01`
  - `rococo/rococo/actor_05A48F.asm:15` — `#17,#FF`
  - `prinkys_mansion/mansion_towerB_lair/actor_06BAD7.asm:39` — `#07,#01`
  - `snow_mountain/snow_cave/actor_0C971C.asm:12` — `#06,#FF`
  - `unorganized/map_162/*.asm` — repeated Y=`#$05`/`#$20`/`#$30` with facing `#01`

#### COP [14] — `branch_if_rel_x_facing` (unused)

- **Confidence:** high (handler clear; **0** call sites; not in `copdef.json`)
- **Preferred name:** `branch_if_rel_x_facing`
- **Handler:** `code_00A446` @ `extracted/system/chunk_008000.asm:4907-4917`
- **Parameters:** (would be) `Byte` dx, `Byte` facing, `&Code` — same epilogue as `[12]`
- **Notes:** Relative X twin of `[12]`: `($00 + dx − 8) == $0BA6`, then facing. Never emitted in extracted scripts.
- **Usage count:** 0

```asm
code_00A446 {
    TYX
    JSR $&code_00E510
    SEC
    SBC #$0008
    CLC
    ADC $00
    CMP $0BA6
    BNE loc_00A441          ; [12] miss path
    BRA loc_00A42B          ; [12] facing path
}
```

#### COP [15] — `branch_if_rel_y_facing` (unused)

- **Confidence:** high (handler clear; **0** call sites; not in `copdef.json`)
- **Preferred name:** `branch_if_rel_y_facing`
- **Handler:** `code_00A47C` @ `extracted/system/chunk_008000.asm:4946-4956`
- **Parameters:** (would be) `Byte` dy, `Byte` facing, `&Code` — same epilogue as `[13]`
- **Notes:** Relative Y twin of `[13]`: `($02 + dy − 16) == $0BA8`, then facing. Never emitted in extracted scripts.
- **Usage count:** 0

```asm
code_00A47C {
    TYX
    JSR $&code_00E510
    SEC
    SBC #$0010
    CLC
    ADC $02
    CMP $0BA8
    BNE loc_00A477          ; [13] miss path
    BRA loc_00A461          ; [13] facing path
}
```

#### COP [16] — `branch_if_actor_at_xy` (exact position of actor slot N)

- **Confidence:** high (handler + `code_00E524` / `code_0480FA`; **0** call sites; not in `copdef.json`)
- **Preferred name:** `branch_if_actor_at_xy`
- **Aliases:** `branch_if_slot_at_xy_facing`, `branch_if_actor_at_xy_facing`
- **Handler:** `code_00A48E` @ `extracted/system/chunk_008000.asm:4958-4997`
- **Parameters (inferred):** `Byte` slot, `Byte` x, `Byte` y, `Byte` facing (`#FF`=any), `&Code`
- **Usage count:** 0 in extracted ASM

##### What it does

Unlike `[10]`–`[15]`, this does **not** read the player snapshot (`$0BA6`/`$0BA8`/`$0BAA`). It looks up **another actor by slot index**, then tests that actor’s live `$00` / `$02` / `$0C`.

**Slot → DP base** via `code_00E524`:

```asm
; A = slot index (0..)
; hardware multiply: index × $38
; Y = $1000 + index × $38   ; actor direct-page base in WRAM
```

`$38` (56) is the per-actor DP stride; `$1000` is the pool base (same bases actors `TCD` when they run).

Then (with `X` = that base):

```
(x_operand + 8) == $0000,X     ; sprite X — same +8 as COP [17]
 y_operand      == $0002,X     ; raw $02 (same units [17] writes)
(facing == #FF) OR (facing == $000C,X)
```

On success: restore the **calling** actor’s slot index (`PLX`), jump to `&Code`.  
On miss: skip leftover operands, `PLX`, fall through (`code_009F00`).

```asm
; Handler (complete)
code_00A48E {
    TYX
    PHX                     ; save calling actor slot index
    LDA [$2C]
    INC $2C
    AND #$00FF              ; slot N
    JSR $&code_00E524       ; Y = $1000 + N*$38
    TYX                     ; X → target actor DP base
    JSR $&code_00E510       ; cell X
    CLC
    ADC #$0008
    CMP $0000, X            ; == target.$00 ?
    BNE miss_x
    JSR $&code_00E510       ; Y
    CMP $0002, X            ; == target.$02 ?  (no ±16)
    BNE miss_y
    LDA [$2C]
    INC $2C
    AND #$00FF
    CMP #$00FF
    BEQ take
    CMP $000C, X            ; facing vs target.$0C
    BNE miss_facing

  take:
    PLX                     ; restore caller slot
    LDA [$2C]
    STA $02, S              ; jump &Code
    RTI

  miss_x:     INC $2C       ; skip Y
  miss_y:     INC $2C       ; skip facing
  miss_facing:
    PLX
    JMP $&code_009F00       ; skip &Code
}
```

##### Why it exists (design)

`[10]`/`[12]`/`[13]` answer “where is the **player**?” using the FA5E snapshot.  
`[11]`/`[14]`/`[15]` answer “where is the player relative to **me**?”  

`[16]` answers “where is **actor slot N**?” — e.g. wait until a companion/NPC/object reaches a cell, or gate a cutscene on another actor’s pose. That needs a slot lookup (`×$38+$1000`) and must not clobber the caller’s `X` (hence `PHX`/`PLX`).

It sits next to `[17]` (`teleport_xy_facing`) in the jump table: `[17]` **writes** `$00=$x+8`, `$02=$y`, `$0C=facing`; `[16]` **tests** the same layout on a chosen slot. Likely authored for multi-actor sync that never shipped (or was removed) — zero call sites, omitted from `copdef.json`.

##### Authoring model (hypothetical)

```asm
; if actor slot $03 stands at cell (0x0A, 0x06), any facing → branch
COP [16] ( #03, #0A, #06, #FF, &code_ready )

; require facing down
COP [16] ( #02, #07, #1C, #01, &code_talk )
```

| Operand | Role |
|---------|------|
| slot | Index into actor DP pool (`$1000 + n×$38`) |
| x | Cell X (engine adds 8 before compare) |
| y | Compared **raw** to actor `$02` — matches `[17]`’s Y write (not the player’s `$02−16` cell recovery) |
| facing | `#FF` = any; else must equal that actor’s `$0C` |

**Caution:** targeting a player-style actor whose `$02` is stored as cell+16 means the Y operand must match that storage, not the cell number used with `[10]`.

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_actor_at_xy #slot, #x, #y, #face, &label` |
| vs `[10]` | Player snapshot vs arbitrary actor slot |
| vs `[17]` | Read test vs write teleport (same XY/facing packing) |

- **JSR:** `code_00E510`, `code_00E524` → `code_0480FA` (WRMPY × `$38`)
- **Source examples:** none in extracted corpus
