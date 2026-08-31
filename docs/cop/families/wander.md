# COP family: Wander / step profile

_Deep-audited ops: `[28]`, `[29]`, `[2A]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Random walk inside a cell rectangle, optional custom walk/bounce anim bases, and the move-profile byte consumed by the shared step helpers.

## Shared state

- Absolute `$0004`/`$0006` — anim bias scratch (**not** DP `$04`/`$06`)
- `$7F101A,X` — move / step profile (`[2A]`)
- PRNG via `code_04812A` (`$0529`–`$0538`)

## Family notes

- `[27]` is **not** wander — see control flow.
- Same `$0004`/`$0006` trick is reused by follower/chase anim variants.
- After `[28]`/`[29]`, scripts almost always run the shared step bracket documented in [movement.md](movement.md): `COP [51]` / `[98]` / `[52]`.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `28` | `wander_rect` | 77 | high | Byte×4 | `code_00A7D0` |
| `29` | `wander_rect_anim` | 8 | high | Byte×6 | `code_00A7B5` |
| `2A` | `set_move_profile` | 14 | high | Byte | `code_00A876` |

**Family call-site total:** 99

## Opcodes

#### COP [28] — `wander_rect` (random walk inside a cell rectangle)

- **Confidence:** high
- **Preferred name:** `wander_rect`
- **Aliases:** `move_packet`, `random_walk_bounds`, `wander_xy`
- **Handler:** `code_00A7D0` @ `extracted/system/chunk_008000.asm:5456-5558`
- **Parameters:** `#xmin, #xmax, #ymin, #ymax` — **map cell** bounds (not pixels)
- **Usage count:** 77

##### What it does

`[28]` clears absolute scratch `$0004`/`$0006`, then shares the core with `[29]` at `loc_00A7D7`:

```asm
code_00A7D0 {
    TYX
    STZ $0004                 ; anim bias = 0  →  walk anim = facing+4
    STZ $0006                 ; bounce anim add = 0

  loc_00A7D7:                 ; ← [29] joins here
    ; cellX = (spriteX - 8) >> 4 ; cellY = (spriteY - 16) >> 4
    JSL $@code_04812A         ; PRNG (LFSR over $0529..)
    BIT #$0004
    BNE bounce                ; ~25%: skip move, play bounce anim

    AND #$0003
    STA $0C                   ; facing = random 0..3
    ; pick bound byte by facing:
    ;   0 down  → ymax (op[3]), try code_00E045
    ;   1 up    → ymin (op[2]), try code_00DF84
    ;   2 left  → xmin (op[0]), try code_00DDF4
    ;   3 right → xmax (op[1]), try code_00DEB5
    ; on success: code_00E3BA → velocity in $1C (X) or $1E (Y)
    ; on fail / out of bounds: bounce

  bounce:
    JSR $&code_00E420         ; idle/bounce anim via $0006
    STZ $1C
    STZ $1E

  done:
    STZ $10
    LDA $2C
    CLC
    ADC #$0004                ; skip the four bound bytes
    STA $28
    STA $02, S
    RTI                       ; resume after packet
}
```

Facing ↔ bound ↔ collision helper:

| `$0C` | Dir | Bound operand | Compare | Helper |
|------:|-----|---------------|---------|--------|
| 0 | down | `#ymax` | stop if `ymax < cellY` | `code_00E045` |
| 1 | up | `#ymin` | stop if `ymin >= cellY` | `code_00DF84` |
| 2 | left | `#xmin` | stop if `xmin >= cellX` | `code_00DDF4` |
| 3 | right | `#xmax` | stop if `xmax < cellX` | `code_00DEB5` |

`code_00E3BA` (success path) writes walk anim:

```
$7F000C = $0C + 4 + $0004     ; with [28], $0004=0 → facing+4
```

and looks up step velocity in `word_01C745` (modulated by `$7F101A` / `$7F101C`).

##### Why / how used

NPC idle roam. Almost always followed by the step trio:

```asm
loc_wander:
    COP [28] ( #14, #1C, #05, #07 )   ; chickens: roam in this rect
    COP [51]                           ; apply / start step
    COP [98]                           ; wait step
    COP [52]                           ; finish step
    BRA loc_wander
```

Wide rects (`#00,#3E,#00,#3E`) = nearly free roam; tight rects pin NPCs to a hallway or pen.

| Item | Value |
|------|-------|
| Suggested alias | `wander_rect #xmin,#xmax,#ymin,#ymax` |
| PRNG | `code_04812A` — bit2 ≈ idle tick; bits0–1 = facing |
| Anim (default) | walk = `facing+4`; bounce via `word_01C78D` |

- **WRAM:** `$00`/`$02`/`$0C`/`$1C`/`$1E`/`$10`/`$28`, temps `$30`–`$36`, abs `$0004`/`$0006`
- **Source examples:**
  - `credits/credits_chickens/actor_04D841.asm:14` — `#14,#1C,#05,#07`
  - `fathers_house/chicken_farm/actor_07A575.asm:16` — `#14,#1C,#05,#08`
  - `system/actor_0BF948.asm` — `#00,#3E,#00,#3E` (wide)

#### COP [29] — `wander_rect_anim` (wander with custom walk / bounce anim)

- **Confidence:** high
- **Preferred name:** `wander_rect_anim`
- **Aliases:** `move_packet6`, `wander_rect_ex`, `random_walk_anim`
- **Handler:** `code_00A7B5` @ `extracted/system/chunk_008000.asm:5441-5454` → falls into `[28]` core
- **Parameters:** `#anim_base, #bounce_add, #xmin, #xmax, #ymin, #ymax`
- **Usage count:** 8

##### What it does

```asm
code_00A7B5 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    SEC
    SBC #$0004
    STA $0004              ; so E3BA: facing + 4 + (base-4) = facing + base
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $0006              ; added to bounce anim id in code_00E420
    BRA loc_00A7D7         ; same wander core as [28]
}
```

So `[29]` is exactly `[28]` plus anim overrides:

| Operand | Effect |
|---------|--------|
| `#anim_base` | Walk cycle base: `$7F000C = facing + anim_base` |
| `#bounce_add` | Added to bounce/idle frame from `word_01C78D` |
| remaining 4 | Same cell rect as `[28]` |

##### Why / how used

Same actor, different sprite set — e.g. cafeteria NPC uses `#14` walk while a flag is clear, then drops to plain `[28]` (default `facing+4`) after:

```asm
; volcano_base/.../actor_09B69F.asm
code_09B6AE:
    COP [0B] ( #$80AE, &flag_set )
    COP [29] ( #14, #10, #04, #1A, #22, #2B )  ; custom anim
    COP [51]
    COP [98]
    COP [52]
    BRA code_09B6AE

flag_set:
    COP [28] ( #04, #1A, #22, #2B )            ; same rect, default anim
    …
```

All 8 sites:

| File | Packet |
|------|--------|
| `native_village/elders_hut/actor_07D0D7.asm` | `#10,#0C,#01,#0A,#01,#0A` |
| `seaside_cave/cave_transport/actor_0691F9.asm` | `#0C,#08,#0E,#0F,#24,#23` |
| `system/actor_05905C.asm` | `#09,#00,#18,#21,#0C,#16` |
| `unorganized/map_D9/actor_05DF59.asm` | `#0E,#00,#16,#17,#15,#14` |
| `volcano_base/base_cafeteria_kitchen/actor_099B7F.asm` | `#0C,#08,#13,#1A,#05,#04` |
| `volcano_base/.../actor_09B795.asm` | `#1C,#18,#04,#1A,#22,#2B` |
| `volcano_base/.../actor_09B69F.asm` | `#14,#10,#04,#1A,#22,#2B` |
| `volcano_base/.../actor_099867.asm` | `#08,#00,#0A,#0A,#25,#29` |

| Item | Value |
|------|-------|
| Suggested alias | `wander_rect_anim #base,#bounce, #xmin,#xmax,#ymin,#ymax` |
| Relation | Prefixed `[28]`; absolute `$0004`/`$0006` only differ |

##### Related (`[28]`–`[2A]` wander / step profile)

| Op | Name | Role |
|----|------|------|
| `[28]` | `wander_rect` | One random step (or bounce) inside cell rect |
| `[29]` | `wander_rect_anim` | Same + custom walk/bounce anim bases |
| `[2A]` | `set_move_profile` | Select `$7F101A` velocity band used by wander/follow step |

`[27]` (`queue_player_script`) is **not** part of this family — see control-flow / player-hijack with `[00]`–`[02]`.

#### COP [2A] — `set_move_profile` (step / velocity table band)

- **Confidence:** high
- **Preferred name:** `set_move_profile`
- **Aliases:** `set_actor_byte_101A`, `set_step_profile`, `set_walk_style`
- **Handler:** `code_00A876` @ `extracted/system/chunk_008000.asm:5560-5569`
- **Parameters:** `Byte` profile
- **Usage count:** 14

##### What it does

```asm
code_00A876 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $7F101A, X          ; persist on this actor
    LDA $2C
    STA $02, S
    RTI
}
```

`$7F101A` is read by the shared step helper `code_00E3BA` (and bounce path `code_00E420`):

```asm
; code_00E3BA excerpt
LDA $7F101A, X
STA $0000
; … load base from byte_01C645[tile + $7F101C] …
DEC
LSR $0000                   ; bit 0 set → +$18 to velocity index
BCC skip
ADC #$0018
LSR $0000                   ; bit 1 set → another +$18
BCC skip
ADC #$0018
```

So low bits of the profile select which **band** of `word_01C745` velocities to use (0 / +24 / +48). Bounce anim selection in `code_00E420` also masks `$7F101A` with `#$FFFC`.

##### Values in source

| Value | Count | Notes |
|------:|------:|-------|
| `#01` | 10 | Default — bit0 → +$18 band (NPCs after recruit / wander) |
| `#09` | 2 | System / combat banks |
| `#03` | 1 | Both low bits → +$48 (`actor_05905C`) |
| `#08` | 1 | High nibble only (`chunk_038000`) |
| `#0D` | 1 | `map_139/actor_0A88AA` |

Typically issued once before a `[28]`/`[29]` wander loop or after leaving follower mode.

| Item | Value |
|------|-------|
| Suggested alias | `set_move_profile #n` |
| Actor RAM | `$7F101A` |
| Consumers | `[28]`/`[29]` via `code_00E3BA`; `[2D]` follow |

- **Source examples:**
  - `credits/credits_puppets/actor_04D292.asm:9` — `#01`
  - `fathers_house/actor_07A684.asm:51` — `#01` before wander
  - `system/actor_05905C.asm:43` — `#03`
  - `unorganized/map_139/actor_0A88AA.asm:18` — `#0D`
