# Animation Setup — COP `[80]`–`[8C]`

> Deep-audited ops: `[80]` `[81]` `[82]` `[83]` `[84]` `[85]` `[86]` `[87]` `[88]` `[89]` `[8A]` `[8B]` `[8C]`

## Overview

Thirteen opcodes that configure an actor's **animation state**. The core eight (`[80]`–`[87]`) form a combinatorial set with three optional parameters. Five extended variants (`[88]`–`[8C]`) add specialized features: step counter, facing-conditional id, speed+facing, spritemap reload, and velocity+acceleration.

All share a common base action (set anim id, clear frame timer, save script pointer) with three optional parameters enabled in a binary pattern:

| Feature | Field | Set by | Description |
|---------|-------|--------|-------------|
| **anim_id** (always) | `$7F000C,X` | Byte 1 | Animation id / sprite sheet index |
| **speed** | `$12` | optional Byte | Animation speed / frame duration timer |
| **vel_x** | `$1C` | optional Byte → `code_00E398` lookup | X-axis velocity pointer (from `unk29_list_01C3B9`) |
| **vel_y** | `$1E` | optional Byte → `code_00E398` lookup | Y-axis velocity pointer (from `unk29_list_01C3B9`) |

### Combinatorial encoding

The opcode number encodes which optional fields are present as a 3-bit pattern `(speed)(vel_x)(vel_y)`:

| Op | Binary | speed | vel_x | vel_y | Operands | Uses |
|----|--------|:-----:|:-----:|:-----:|----------|-----:|
| `[80]` | `000` | — | — | — | `Byte` | 1247 |
| `[81]` | `010` | — | yes | — | `Byte, Byte` | 78 |
| `[82]` | `001` | — | — | yes | `Byte, Byte` | 57 |
| `[83]` | `011` | — | yes | yes | `Byte, Byte, Byte` | 8 |
| `[84]` | `100` | yes | — | — | `Byte, Byte` | 354 |
| `[85]` | `110` | yes | yes | — | `Byte, Byte, Byte` | 149 |
| `[86]` | `101` | yes | — | yes | `Byte, Byte, Byte` | 220 |
| `[87]` | `111` | yes | yes | yes | `Byte, Byte, Byte, Byte` | 2 |

## Shared state

### Actor fields written

| Field | Role | Default |
|-------|------|---------|
| `$7F000C,X` | Current animation id / sprite index | Set from byte 1 |
| `$10` | Animation frame timer | Cleared to 0 |
| `$12` | Animation speed / duration counter | Set from speed byte (if present) |
| `$1C` | X velocity pointer (from lookup table) | Set from `code_00E398(vel_x_byte)` (if present) |
| `$1E` | Y velocity pointer (from lookup table) | Set from `code_00E398(vel_y_byte)` (if present) |
| `$28` | Saved script pointer (resume address) | Set to `$2C` (current script position) |

### Helpers

| Label | Role |
|-------|------|
| `code_00E398` | Velocity lookup: `byte × 2` → index into `unk29_list_01C3B9` → returns word pointer |
| `unk29_list_01C3B9` | Animation velocity table — maps velocity index to a pointer/speed value |

## Opcodes

All handlers follow the same skeleton. The **base** action (present in all 8):

```asm
    TYX
    LDA [$2C]              ; read byte 1: anim_id
    INC $2C
    AND #$00FF
    STA $7F000C, X         ; set actor's animation id
    STZ $10                ; clear frame timer
    ; ... optional fields ...
    LDA $2C
    STA $28                ; save script pointer as resume point
    STA $02, S
    RTI                    ; return to script
```

The optional fields are read and stored between the base setup and the epilogue:

- **speed:** `LDA [$2C]; INC $2C; AND #$00FF; STA $12`
- **vel_x:** `LDA [$2C]; INC $2C; AND #$00FF; JSR code_00E398; STA $1C`
- **vel_y:** `LDA [$2C]; INC $2C; AND #$00FF; JSR code_00E398; STA $1E`

---

#### COP [80] — `set_anim` (anim id only)

- **Confidence:** high
- **Preferred name:** `set_anim`
- **Handler:** `code_00BE3E` @ chunk_008000.asm:8818–8829
- **Parameters:** `Byte` (anim_id)
- **Usage count:** 1247

The most common animation op — sets the sprite animation and yields. Used for idle poses, facing directions, and simple state changes.

```asm
    COP [80] ( #00 )      ; set anim 0 (default/idle)
    COP [97]               ; yield frame
```

---

#### COP [81] — `set_anim_vx` (anim id + X velocity)

- **Confidence:** high
- **Preferred name:** `set_anim_vx`
- **Aliases:** `set_anim_xy`
- **Handler:** `code_00BE53` @ chunk_008000.asm:8831–8848
- **Parameters:** `Byte` (anim_id), `Byte` (vel_x index)
- **Usage count:** 78

Sets animation with horizontal velocity. Used for horizontal scrolling/panning effects.

---

#### COP [82] — `set_anim_vy` (anim id + Y velocity)

- **Confidence:** high
- **Preferred name:** `set_anim_vy`
- **Aliases:** `set_anim_id_count`
- **Handler:** `code_00BE74` @ chunk_008000.asm:8849–8866
- **Parameters:** `Byte` (anim_id), `Byte` (vel_y index)
- **Usage count:** 57

Sets animation with vertical velocity. Used for vertical scrolling/falling effects.

---

#### COP [83] — `set_anim_vxy` (anim id + X & Y velocity)

- **Confidence:** high
- **Preferred name:** `set_anim_vxy`
- **Aliases:** `set_anim_id_count_dir`
- **Handler:** `code_00BE95` @ chunk_008000.asm:8867–8889
- **Parameters:** `Byte` (anim_id), `Byte` (vel_x index), `Byte` (vel_y index)
- **Usage count:** 8

Sets animation with both axis velocities. Used for diagonal movement in credits/cutscenes.

---

#### COP [84] — `set_anim_spd` (anim id + speed)

- **Confidence:** high
- **Preferred name:** `set_anim_spd`
- **Aliases:** `set_anim_id_count2`
- **Handler:** `code_00BEC2` @ chunk_008000.asm:8890–8906
- **Parameters:** `Byte` (anim_id), `Byte` (speed)
- **Usage count:** 354

Sets animation with a frame duration/speed counter. The second most common variant — used when the animation needs to play at a specific speed rather than the default.

```asm
    COP [84] ( #0C, #1E )   ; anim 12, speed 30 frames
    COP [98]                  ; wait for anim complete
```

---

#### COP [85] — `set_anim_spd_vx` (anim id + speed + X velocity)

- **Confidence:** high
- **Preferred name:** `set_anim_spd_vx`
- **Handler:** `code_00BEE0` @ chunk_008000.asm:8907–8928
- **Parameters:** `Byte` (anim_id), `Byte` (speed), `Byte` (vel_x index)
- **Usage count:** 149

Animation with speed and horizontal velocity. Common for walk/run cycles in cutscenes.

```asm
    COP [85] ( #0B, #03, #01 )   ; anim 11, speed 3, vel_x index 1
    COP [98]                       ; wait
```

---

#### COP [86] — `set_anim_spd_vy` (anim id + speed + Y velocity)

- **Confidence:** high
- **Preferred name:** `set_anim_spd_vy`
- **Handler:** `code_00BF0A` @ chunk_008000.asm:8929–8950
- **Parameters:** `Byte` (anim_id), `Byte` (speed), `Byte` (vel_y index)
- **Usage count:** 220

Animation with speed and vertical velocity. Common for vertical walk/climb cycles.

```asm
    COP [86] ( #09, #01, #02 )   ; anim 9, speed 1, vel_y index 2
    COP [98]                       ; wait
```

---

#### COP [87] — `set_anim_spd_vxy` (anim id + speed + X & Y velocity)

- **Confidence:** high
- **Preferred name:** `set_anim_spd_vxy`
- **Handler:** `code_00BF34` @ chunk_008000.asm:8951–8977
- **Parameters:** `Byte` (anim_id), `Byte` (speed), `Byte` (vel_x index), `Byte` (vel_y index)
- **Usage count:** 2

The full-featured variant — animation with speed and both axis velocities. Extremely rare; only used in hacker_fortress for diagonal movement.

---

## Extended variants

The following two opcodes share the same base action (set `$7F000C,X`, clear `$10`, save `$28`) but add conditional logic or extra side-effects beyond the simple combinatorial pattern.

---

#### COP [88] — `set_anim_step` (anim id + set step counter)

- **Confidence:** high
- **Preferred name:** `set_anim_step`
- **Handler:** `code_00BF6A` @ chunk_008000.asm:8978–8991
- **Parameters:** `Byte` (anim_id)
- **Usage count:** 2

Sets animation id and writes `#$0001` to `$0E24` (animation step counter). This primes the counter for COP `[9B]` (`DEC $0E24` tick), creating a single-step animation cycle. Always used paired with `COP [9B]` immediately after.

Both call sites are in `chunk_0B8000.asm` — a tile-cursor positioning routine that computes X/Y from tilemap coordinates (`$0B7A`/`$0B7C` → `$00`/`$02`), sets anim `#12`, then yields via `[9B]`.

<details><summary>Handler</summary>

```asm
code_00BF6A {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $7F000C, X         ; set anim id
    STZ $10                ; clear frame timer
    LDA #$0001
    STA $0E24              ; step counter = 1
    LDA $2C
    STA $28
    STA $02, S
    RTI
}
```

</details>

<details><summary>Call-site pattern</summary>

```asm
    ; compute $00 (X pos) and $02 (Y pos) from tilemap coords
    STA $02
    COP [88] ( #12 )       ; set anim 18, step counter = 1
    COP [9B]               ; tick: DEC $0E24, yield until done
    BRA loc_0BC247          ; loop
```

</details>

**WRAM side-effect:** `$0E24` — animation step counter. Used by the engine (`chunk_048000.asm`) as a general animation frame counter (INC to 24/32, then reset). COP [88] sets it to 1 for a single-tick animation step.

---

#### COP [89] — `set_anim_facing` (anim id, conditional on facing)

- **Confidence:** high
- **Preferred name:** `set_anim_facing`
- **Handler:** `code_00BF8E` @ chunk_008000.asm:9000–9019
- **Parameters:** `Byte` (base_anim_id)
- **Usage count:** 60

Sets animation id conditionally based on actor facing direction `$0A bit #$4000`:
- If `$0A bit #$4000` **is set** → use `base_anim_id` as-is
- If `$0A bit #$4000` **is clear** → use `base_anim_id + 1`

This allows a single opcode to select between a left-facing and right-facing animation frame using adjacent animation ids. All 60 call sites are in `chunk_038000.asm` (battle system), where `$0A` encodes the battle sprite's horizontal orientation.

Typical anim id pairs observed:
- `#02` / `#03` — idle left / idle right
- `#07` / `#08` — attack left / attack right (when `$05F8 ≠ 0`)
- `#0D` / `#0E` — attack left / attack right (when `$05F8 == 0`)
- `#13` / `#14` — special left / special right
- `#17` / `#18` — special left / special right (alt)

<details><summary>Handler</summary>

```asm
code_00BF8E {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    TAY                    ; Y = base anim id
    LDA $0A
    BIT #$4000             ; test facing flag
    BNE loc_00BF9F         ; if set → keep base id
    INY                    ; if clear → id + 1

  loc_00BF9F:
    TYA
    STA $7F000C, X         ; store chosen anim id
    STZ $10
    LDA $2C
    STA $28
    STA $02, S
    RTI
}
```

</details>

<details><summary>Call-site pattern</summary>

```asm
    LDA $05F8              ; which character/robot type?
    BEQ loc_03A3DE         ; 0 = default sprite set
    COP [89] ( #07 )       ; base anim 7 (facing-conditional → 7 or 8)
    COP [97]               ; yield
    COP [01]               ; return

  loc_03A3DE:
    COP [89] ( #0D )       ; base anim 13 (facing-conditional → 13 or 14)
    COP [97]
    COP [01]
```

</details>

**Actor field read:** `$0A` — actor flags word. Bit `#$4000` encodes horizontal orientation (set = one direction, clear = mirrored). Used throughout the battle system for position offsets and sprite flipping.

---

#### COP [8A] — `set_anim_spd_facing` (speed + facing-conditional anim id)

- **Confidence:** high
- **Preferred name:** `set_anim_spd_facing`
- **Handler:** `code_00BF85` @ chunk_008000.asm:8992–8999 (falls through to `code_00BF8E`)
- **Parameters:** `Byte` (speed), `Byte` (base_anim_id)
- **Usage count:** 2

Reads a speed byte into `$12`, then falls through to `[89]`'s facing-conditional anim selection. Both call sites are in `chunk_038000.asm` (battle system).

<details><summary>Handler</summary>

```asm
code_00BF85 {
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $12                ; read speed
}
; falls through to code_00BF8E ([89] handler)
```

</details>

---

#### COP [8B] — `set_anim_sprmap` (load spritemap + set anim id)

- **Confidence:** high
- **Preferred name:** `set_anim_sprmap`
- **Handler:** `code_00BFAD` @ chunk_008000.asm:9020–9038
- **Parameters:** `Byte` (spritemap_index), `Byte` (anim_id)
- **Usage count:** 33

Loads a new spritemap via `code_08F322` (sets up actor tile data, collision box, and visual properties from the spritemap table), then sets the animation id. Also sets `$08 |= #$0800` (render mode flag that tells the engine to use the loaded spritemap).

All call sites are in battle/system code (`chunk_038000.asm` and system actors). Most use spritemap index `#00` with anim ids `#05`–`#07` — switching between normal and special battle sprites.

<details><summary>Handler</summary>

```asm
code_00BFAD {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    JSL $@code_08F322      ; load spritemap by index
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $7F000C, X         ; set anim id
    STZ $10                ; clear frame timer
    LDA #$0800
    TSB $08                ; set render mode flag
    LDA $2C
    STA $28
    STA $02, S
    RTI
}
```

</details>

**Helpers:**

| Label | Role |
|-------|------|
| `code_08F322` | Spritemap setup — reads `$7F100E,X` / `$7F1014,X` / `$7F1020,X` by index, configures tile data and properties |

---

#### COP [8C] — `set_anim_accel` (anim id + X/Y velocity with acceleration)

- **Confidence:** high
- **Preferred name:** `set_anim_accel`
- **Handler:** `code_00BFD2` @ chunk_008000.asm:9040–9059
- **Parameters:** `Byte` (anim_id), `Byte` (vel_x index), `Byte` (vel_y index)
- **Usage count:** 8

Sets animation id and configures **both velocity and acceleration** on X and Y axes. Unlike `[83]` (which only sets `$1C`/`$1E`), this variant uses `code_00E39E` and `code_00E3AC` which also populate the acceleration fields `$34` and `$36`.

Used for smooth movement effects (attack lunges, transitions) that need deceleration curves rather than constant velocity.

<details><summary>Handler</summary>

```asm
code_00BFD2 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $7F000C, X         ; set anim id
    STZ $10                ; clear frame timer
    LDA [$2C]
    INC $2C
    AND #$00FF
    JSR $&code_00E39E      ; vel_x → $1C, accel_x → $34
    LDA [$2C]
    INC $2C
    AND #$00FF
    JSR $&code_00E3AC      ; vel_y → $1E, accel_y → $36
    LDA $2C
    STA $28
    STA $02, S
    RTI
}
```

</details>

**Helpers:**

| Label | Role |
|-------|------|
| `code_00E39E` | Velocity+accel lookup (X axis): `byte×2` → `unk29_list_01C3B9` → `$1C` (velocity), reads `+2` → `$34` (acceleration) |
| `code_00E3AC` | Velocity+accel lookup (Y axis): `byte×2` → `unk29_list_01C3B9` → `$1E` (velocity), reads `+2` → `$36` (acceleration) |

## Usage statistics

| Op | Name | Sites | Files |
|----|------|------:|------:|
| `[80]` | `set_anim` | 1247 | 422 |
| `[81]` | `set_anim_vx` | 78 | 33 |
| `[82]` | `set_anim_vy` | 57 | 15 |
| `[83]` | `set_anim_vxy` | 8 | 3 |
| `[84]` | `set_anim_spd` | 354 | 120 |
| `[85]` | `set_anim_spd_vx` | 149 | 65 |
| `[86]` | `set_anim_spd_vy` | 220 | 93 |
| `[87]` | `set_anim_spd_vxy` | 2 | 2 |
| `[88]` | `set_anim_step` | 2 | 1 |
| `[89]` | `set_anim_facing` | 60 | 1 |
| `[8A]` | `set_anim_spd_facing` | 2 | 1 |
| `[8B]` | `set_anim_sprmap` | 33 | 3 |
| `[8C]` | `set_anim_accel` | 8 | 4 |
| | **Total** | **2220** | |

## Family notes

- **`[80]` is the #1 most-used COP opcode in the entire ROM** (1247 sites). It appears in virtually every actor script as the primary way to set an idle/facing animation.
- The `$28` field (saved script pointer) is written by every variant. This allows the animation system to resume the actor's script after the animation completes — the actor yields back to the engine and the engine re-enters at `$28`.
- The `$10` timer is always cleared. This resets the animation to frame 0 when a new animation is set.
- The velocity values go through `code_00E398` (lookup in `unk29_list_01C3B9`) rather than being used directly. This maps an index (0–N) to a pre-computed velocity/speed word, providing a palette of standard movement speeds.
- `[84]`+`[85]`+`[86]` account for 723 sites — the "speed" variants are heavily used for timed/paced animations.
- `[83]` and `[87]` (both-velocity variants) are rare (8 and 2 sites respectively), mostly appearing in credits sequences and the hacker fortress final area for diagonal sprite movement.
- These ops are typically followed by `COP [97]` (yield) for one-shot pose changes, or `COP [98]` (wait_anim_complete) for timed sequences. The `[84]`/`[85]`/`[86]` variants are especially common before `[98]`.
- **`[88]`** is a system-level variant that primes the step counter `$0E24` for use with `COP [9B]` (tick/decrement). Only 2 call sites, both tile-cursor sprites.
- **`[89]`** is a battle-system variant that auto-selects between adjacent animation ids based on the actor's horizontal facing flag (`$0A bit #$4000`). All 60 call sites are in `chunk_038000.asm` (battle/combat code).
- **`[8A]`** combines `[89]`'s facing-conditional selection with a speed byte — the speed+facing variant. 2 call sites, both battle system.
- **`[8B]`** reloads the actor's spritemap via `code_08F322` before setting the anim id, and sets render flag `$08 |= #$0800`. Used when the actor needs to switch to a different sprite sheet mid-script (33 sites, mostly battle).
- **`[8C]`** sets both velocity and **acceleration** via `code_00E39E`/`code_00E3AC` (which populate `$34`/`$36` in addition to `$1C`/`$1E`). Used for smooth movement curves — attack lunges, screen transitions — where constant velocity isn't sufficient (8 sites).

## Relationship to other families

```
[80]–[8C] set_anim family
  ├── [80]–[87] combinatorial core (3-bit: speed / vel_x / vel_y)
  ├── [88] set_anim_step       — primes $0E24 for [9B] tick
  │     └── [9B] anim_tick     — DEC $0E24, yield until 0
  ├── [89] set_anim_facing     — facing-conditional id select ($0A bit #$4000)
  ├── [8A] set_anim_spd_facing — speed + facing (falls through to [89])
  ├── [8B] set_anim_sprmap     — reload spritemap + set anim id + render flag
  │     └── code_08F322        — spritemap setup from $7F100E/$7F1014/$7F1020
  ├── [8C] set_anim_accel      — anim id + velocity + acceleration ($34/$36)
  │     └── code_00E39E/E3AC   — extended velocity lookup (vel + accel)
  ├── [97] yield               — single-frame pause after anim set
  ├── [98] wait_anim_complete  — block until anim timer expires
  ├── [99] (battle wait)       — used after [8B] in battle code
  ├── [51]/[52] step_begin/end — walk packets that also write $7F000C
  └── [D5] set_spritemap       — changes the spritemap source (visual bank)
```
