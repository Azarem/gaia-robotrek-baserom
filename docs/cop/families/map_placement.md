# COP family: Map / placement

_Deep-audited ops: `[17]`, `[18]`, `[19]`, `[1A]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Teleport the current actor, request/queue map loads, and branch on the current map id (`$05A8`). Often paired with collision `[44]` after teleport. `[18]` is the primary transition; `[19]` stages an alternate/deferred request.

## Shared state

- `$05A6` — pending map id; becomes `$05A8` when consumed
- `$05A8` — current map / scene id (`[1A]` tests this)
- `$05BA`/`$05BE` — camera / spawn cells for `[18]`
- `$05E8`+ — deferred alt block for `[19]`

## Family notes

- `[1B]` is **not** in this family (flag reset).
- `[17]` does not mark the new cell solid — scripts usually follow with `[44]`.
- See **Shared reference** for the map-request register layout shared by `[18]`/`[19]`.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `17` | `teleport_xy_facing` | 127 | high | Byte, Byte, Byte | `code_00A4CE` |
| `18` | `request_map` | 127 | high | Word, Byte×4 | `code_00A4F6` |
| `19` | `queue_map_alt` | 1 | high | Word, Byte×4 | `code_00A52B` |
| `1A` | `branch_if_map` | 107 | high | Word, &Code | `code_00A55A` |

**Family call-site total:** 362

## Shared reference

#### Map request registers (shared by `[18]` / `[19]`)

Scene changes are **queued into WRAM**, then consumed by the map-load path (e.g. around `code_0084xx`):

```asm
; consume pending request
LDY $05A6
STY $05A8              ; current map id ([1A] compares this)
STY $05AA              ; script_meta index base
ASL $05AA
...
STZ $05A6              ; request cleared
LDA $05AC
JSR $&code_0097F8      ; fade / entrance mode from $05AC
; if $05AC < $0A and $05B6 < $0A → also run door/spawn helper code_00833F
```

Camera follow (`code_00F9BD`) prefers `$05BC`/`$05C0` when either is non-zero; else `$05BA`/`$05BE`; else live player (`code_00FA5E`).

## Opcodes

#### COP [17] — `teleport_xy_facing` (instant relocate this actor)

- **Confidence:** high
- **Preferred name:** `teleport_xy_facing`
- **Aliases:** `warp_xy`, `place_xy_facing`, `set_pos_facing`
- **Handler:** `code_00A4CE` @ `extracted/system/chunk_008000.asm:4999-5019`
- **Parameters:** `Byte` x, `Byte` y, `Byte` facing
- **Usage count:** 127

##### What it does

Moves **this** actor to a new cell and facing in one shot:

1. Save old `$00`/`$02` → `$34`/`$36`
2. `JSR code_00E2D2` — clear solid/occupancy at the **old** position
3. `$00 ← x + 8` (sprite X; same packing as `[16]` tests / player hotspot math)
4. `$02 ← y` (raw; same as `[16]` / no +16)
5. `$0C ← facing`

Does **not** mark the new tile solid — scripts often follow with `COP [44]` (`solid_on` / `code_00E257`). **43/127** call sites have `[44]` on the next line.

```asm
; Handler (complete)
code_00A4CE {
    TYX
    LDA $00
    STA $34                 ; old X for occupancy clear
    LDA $02
    STA $36                 ; old Y
    JSR $&code_00E2D2       ; clear solid at old cell
    JSR $&code_00E510       ; x
    CLC
    ADC #$0008
    STA $00
    JSR $&code_00E510       ; y
    STA $02
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $0C                 ; facing
    LDA $2C
    STA $02, S
    RTI
}
```

##### Why / how used

Cutscene placement and NPC resets: put an actor on a known tile before dialog, walks, or a `[10]` “wait until player arrives here” loop. Facing operand: `#00` (69), `#01` (37), `#02` (13), `#03` (7), rare `#FF`.

```asm
; stand on pad, then solid, then wait for player facing down
COP [17] ( #07, #26, #00 )
COP [44]                            ; solid_on new cell
...
COP [10] ( #07, #26, #01, &talk )

; cutscene: snap NPC, face right, speak
COP [17] ( #07, #08, #01 )
COP [0A] ( #$8000 )
COP [1D] ( &string_… )
```

| Item | Value |
|------|-------|
| Suggested alias | `teleport_xy_facing #x, #y, #face` |
| Pairs with | `[44]` solid_on; `[16]` tests same packing; `[10]` player-at-cell |
| vs walk COPs | Instant — no anim / path |

- **JSR:** `code_00E2D2`, `code_00E510`
- **Source examples:**
  - `rococo/tunnel_entrance/actor_05F686.asm:14-15` — `#07,#26,#00` then `[44]`
  - `native_village/elders_hut/actor_07D0D7.asm:47` — `#07,#08,#01`
  - `fathers_house/fathers_house/actor_079519.asm:27-28` — then `[44]`
  - `prinkys_mansion/mansion_east_library/actor_06DFA3.asm:37` — facing `#FF`
  - `credits/credits_chickens/actor_04D745.asm:30` — `#11,#06,#02`

#### COP [18] — `request_map` (queue primary map transition)

- **Confidence:** high
- **Preferred name:** `request_map`
- **Aliases:** `load_map`, `enter_map`, `setup_camera_or_scroll` (legacy; too narrow)
- **Handler:** `code_00A4F6` @ `extracted/system/chunk_008000.asm:5021-5044`
- **Parameters:** `Word` map_id, `Byte` mode (`$05AC`), `Byte` param (`$05B6`), `Byte` cam_x (`$05BA`), `Byte` cam_y (`$05BE`)
- **Usage count:** 127

##### What it does

Writes the **primary** pending-transition block and clears alternate camera overrides:

| Operand | Destination | Role |
|---------|-------------|------|
| Word | `$05A6` | Pending map / scene id |
| Byte | `$05AC` | Transition / entrance mode → `code_0097F8` |
| Byte | `$05B6` | Entrance param (with `$05AC`, must both be `<$0A` for door-table spawn path) |
| Byte | `$05BA` | Primary camera / spawn cell X |
| Byte | `$05BE` | Primary camera / spawn cell Y |
| (fixed) | `$05BC`/`$05C0` ← 0 | Force primary cam pair |

The COP itself does **not** load the map; it only arms `$05A6`. Scripts usually `COP [CB]` / `RTL` right after and let the engine transition.

```asm
; Handler (complete)
code_00A4F6 {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    STA $05A6              ; pending map id
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $05AC              ; mode
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $05B6              ; param
    JSR $&code_00E510
    STA $05BA              ; cam/spawn X
    JSR $&code_00E510
    STA $05BE              ; cam/spawn Y
    STZ $05BC
    STZ $05C0              ; clear alt cam
    LDA $2C
    STA $02, S
    RTI
}
```

##### Why / how used

**Scene exits and boot flow.** Title/prologue directors request the next story map; field directors warp to another room with a spawn cell. First operand is the map id (often matches `map_XXX` / `$05A8` values used with `[1A]`).

```asm
; boot logo → map $0004
COP [18] ( #$0004, #01, #01, #00, #00 )
COP [CB]
RTL

; in-map warp: map $0090, mode 4/param 1, camera (0x16, 0x39)
COP [18] ( #$0090, #04, #01, #16, #39 )
COP [CB]
RTL

; two exits from one actor
COP [18] ( #$016D, #04, #00, #17, #08 )
...
COP [18] ( #$016E, #04, #01, #08, #2A )
```

Common middle pairs: `#08,#01`, `#01,#01`, `#04,#01`, `#04,#00`, …

| Item | Value |
|------|-------|
| Suggested alias | `request_map #id, #mode, #param, #cam_x, #cam_y` |
| Follow with | Usually `[CB]` / yield so the loader can run |
| Related | `[1A]` tests `$05A8` after load; `[19]` alt queue |

- **Source examples:**
  - `boot/boot_logo/actor_04B187.asm:33` — `#$0004`
  - `boot/prologue_hackers/actor_04E8B2.asm:25` — `#$0035`
  - `volcano_base/actor_09821D.asm:32` — `#$0090, #04, #01, #16, #39`
  - `unorganized/map_16A/actor_08A470.asm` — dual exits `#$016D` / `#$016E`
  - `unorganized/map_D9/actor_05ECA1.asm` — `#$0161, #01, #00, #28, #3D`

#### COP [19] — `queue_map_alt` (deferred / alternate map request)

- **Confidence:** high (handler clear; **1** call site; apply paths verified)
- **Preferred name:** `queue_map_alt`
- **Aliases:** `request_map_alt`, `setup_camera_alt` (legacy)
- **Handler:** `code_00A52B` @ `extracted/system/chunk_008000.asm:5046-5067`
- **Parameters:** `Word` map_id, `Byte`, `Byte`, `Byte`, `Byte` → `$05E8`, `$05E0`, `$05E2`, `$05E4`, `$05E6`
- **Usage count:** 1

##### What it does

Same five-field shape as `[18]`, but into the **alt / deferred** block:

| Operand | Destination |
|---------|-------------|
| Word | `$05E8` |
| Byte | `$05E0` |
| Byte | `$05E2` |
| Byte | `$05E4` |
| Byte | `$05E6` |

```asm
; Handler (complete)
code_00A52B {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    STA $05E8
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $05E0
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $05E2
    JSR $&code_00E510
    STA $05E4
    JSR $&code_00E510
    STA $05E6
    LDA $2C
    STA $02, S
    RTI
}
```

**Later apply (two known paths):**

1. `code_008869` (bit `$20` on `$0B72`): `LDA $05E8 / STA $05A6 / STZ $05E8` — promotes **map id only** into the normal pending slot.
2. Combat / return helper in `chunk_038000` (`code_039A47` area): if `$05E8≠0`, copies into the live request **and** alt camera slots:

```asm
LDA $05E8 : STA $05A6 : STA $05C2
LDA $05E0 : STA $05AC
LDA $05E2 : STA $05B8
LDA $05E4 : STA $05BC      ; alt cam X (not $05BA)
LDA $05E6 : STA $05C0      ; alt cam Y
```

So `[19]` is for “remember a destination for after this sequence / combat / submenu,” not an immediate `[18]`-style arming of the primary cam pair.

##### Why / how used

Sole extracted use — map_162 director, after a long villain monologue, queues map `$0163` then halts:

```asm
COP [1D] ( &string_0CE925 )
COP [D0] ( #$0050 )
COP [00] ( &code_0CED81 )
COP [19] ( #$0163, #09, #01, #10, #06 )
COP [CB]
RTL
```

| Item | Value |
|------|-------|
| Suggested alias | `queue_map_alt #id, #b0, #b1, #b2, #b3` |
| vs `[18]` | Deferred alt block vs primary `$05A6`/`$05BA` request |

- **Source examples:**
  - `unorganized/map_162/actor_0CE880.asm:29` — only site

#### COP [1A] — `branch_if_map` (current map id `$05A8`)

- **Confidence:** high
- **Preferred name:** `branch_if_map`
- **Aliases:** `branch_if_map_id`, `branch_if_state_05A8`, `if_scene`
- **Handler:** `code_00A55A` @ `extracted/system/chunk_008000.asm:5069-5093`
- **Parameters:** `Word` (map id + optional `$8000` invert), `&Code`
- **Usage count:** 107

##### What it does

Compares the operand to **`$05A8`** (current map / scene id, set when a `[18]`/`request_map` pending id is consumed):

| Operand | Branch to `&Code` when… |
|---------|-------------------------|
| `#$00xx` (bit15 clear) | `$05A8 == xx` |
| `#$80xx` (bit15 set) | `$05A8 != xx` |

Miss → `code_009F00` (skip `&Code`). Match → `STA $02,S` with `&Code`.

```asm
; Handler (complete)
code_00A55A {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    BIT #$8000
    BNE invert              ; #$80xx → branch if NOT equal

    AND #$7FFF
    CMP $05A8
    BEQ take
  skip:
    JMP $&code_009F00

  take:
    LDA [$2C]
    STA $02, S
    RTI

  invert:
    AND #$7FFF
    CMP $05A8
    BNE take                ; not this map → jump
    BRA skip                ; is this map → fall through
}
```

##### Why / how used

**Shared actors / multi-map props:** one script body, different lines or behavior per room. Classic ladder of `[1A]` checks (first match wins), then a default.

Also used as a one-shot gate: only run this NPC’s setup on map `$0071`, etc.

Invert (`#$80xx`) is rare (**3** sites): branch when *not* on that map.

```asm
; Prinky diary shelf — different volume text per mansion room
COP [1A] ( #$0053, &vol4 )
COP [1A] ( #$0058, &vol3 )
COP [1A] ( #$004E, &vol2 )
COP [1D] ( &string_vol1 )          ; default
...

; only active on map $0071
COP [1A] ( #$0071, &code_active )
; else fall into other setup

; invert: if NOT map $0019 → special path
COP [1A] ( #$8019, &code_elsewhere )
```

Volcano / late-game directors often chain many map ids (`#$0088`, `#$009D`, …) for per-room hooks.

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_map #id, &label` / `branch_if_not_map #$80id, &label` |
| Related | `[18]` sets pending `$05A6` → becomes `$05A8` on load |

- **Source examples:**
  - `prinkys_mansion/actor_06D47A.asm:22-24` — map ladder for diary volumes
  - `fathers_house/actor_07A684.asm:12` — `#$0071`
  - `volcano_base/actor_09BC9D.asm` — multi-map ladder
  - `system/actor_05FBEB.asm:27` — invert `#$8019`
  - `system/actor_04BD1D.asm:79` — invert `#$817A`
