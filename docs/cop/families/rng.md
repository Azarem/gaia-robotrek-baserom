# COP family: RNG

_Deep-audited ops: `[31]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Advance the LFSR over `$0529`–`$0538`. Scripts read `$052A` afterward. Also called internally by wander `[28]`.

## Shared state

- `$0529`–`$0538` — PRNG state; `$052A` = latest byte
- `code_04812A` — shared LFSR step

## Family notes

- Neighbors `[30]`/`[32]` are unrelated (chase anim / UI focus).

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `31` | `rng_tick` | 89 | high | (none) | `code_00ACB0` |

**Family call-site total:** 89

## Opcodes

#### COP [31] — `rng_tick` (advance PRNG; read `$052A` after)

- **Confidence:** high (handler + 89/89 call-site audit)
- **Preferred name:** `rng_tick`
- **Aliases:** `rand`, `randomize`, `no_operand` (old stub)
- **Handler:** `code_00ACB0` @ `extracted/system/chunk_008000.asm:6206-6212`
- **Parameters:** (none)
- **Usage count:** 89

##### What it does

```asm
code_00ACB0 {
    TYX
    JSL $@code_04812A       ; LFSR step over $0529..$0538
    LDA $2C
    STA $02, S
    RTI                     ; A discarded — side effect is the point
}
```

`code_04812A` (same PRNG `[28]` uses internally):

```asm
; 8-bit: for X=F..1: $0529,X += $052A,X
; then INC $0529.. until non-zero carry chain
; returns A = $052A (latest random byte)
```

Scripts **never** use the COP’s return value. **All 89** sites do `LDA $052A` within the next two instructions and mask it:

```asm
COP [31]
LDA $052A
AND #$0003          ; or #$001F / #$003F / #$007F / #$01FF …
; → delay $0E, anim id, spawn offset, etc.
```

##### Typical uses

| Pattern | Example |
|---------|---------|
| Random delay | `AND #$001F / #$003F` → `STA $0E` then wait |
| Random anim | credits: `AND #$0003` + `#04` → `$7F000C` |
| Random position | fortress escape: jitter spawned actor `$00`/`$02` by `AND #$001F` |
| Random facing seed | world/space actors |

```asm
; seaside_cave/cave_entrance/actor_068000.asm
COP [31]
LDA $052A
AND #$001F
CLC
ADC #$0008
STA $0E                 ; delay 8..39 frames
```

| Item | Value |
|------|-------|
| Suggested alias | `rng_tick` |
| Output | `$052A` (and full `$0529`–`$0538` state) |
| Related | `[28]` (`wander_rect`) also calls `code_04812A` internally |

- **Source examples:**
  - `credits/actor_04DAC5.asm:12` — random facing anim
  - `seaside_cave/cave_entrance/actor_068000.asm:27` — random delay
  - `hacker_fortress/fortress_escape/actor_04E438.asm:25,31` — random spawn jitter
  - `world/space/actor_04B506.asm:15,20` — delay + position
