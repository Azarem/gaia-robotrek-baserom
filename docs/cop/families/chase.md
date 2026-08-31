# COP family: Chase / herd

_Deep-audited ops: `[2F]`, `[30]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Independent chase AI toward the player using a separate slot pool (max **8**), not the party-follower tables.

## Shared state

- `$09E2` — chase-slot count
- `$09E4+` — per-slot path state
- Actor `$20` — this chaser’s word index (`ASL` of `$09E2` at claim)

## Family notes

- Only a handful of call sites; pool-full paths fall back to wander `[28]`.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `2F` | `chase_step` | 2 | high | (none) | `code_00AAD6` |
| `30` | `chase_step_anim` | 1 | high | Byte, Byte | `code_00AABA` |

**Family call-site total:** 3

## Opcodes

#### COP [2F] — `chase_step` (herd / chase toward player)

- **Confidence:** high
- **Preferred name:** `chase_step`
- **Aliases:** `flock_step`, `herd_step`, `no_operand` (old stub)
- **Handler:** `code_00AAD6` → fall into `code_00AADD` @ `extracted/system/chunk_008000.asm:5902-6204`
- **Parameters:** (none) — forces `$0004`/`$0006` = 0
- **Usage count:** 2
- **Related:** `COP [30]` (`code_00AABA`) is the same AI with custom `$0004`/`$0006` (1 use)

##### What it does

```asm
code_00AAD6 {
    TYX
    STZ $0004
    STZ $0006
    ; fall through — no RTS
}

code_00AADD {
    LDY $20                      ; chase slot index (word)
    ; cell deltas vs player coarse pos $0BB2/$0BB4 → $0014/$0018
    LDA $09E4, Y                 ; per-slot pathfinding state
    ; large state machine:
    ;   pick facing from Δx/Δy
    ;   try step (code_00DDF4/DEB5/DF84/E045 + E3BA)
    ;   on block: set bits in $09E4 (dir blocked flags #$10/#$20/#$40/#$80)
    ;   on success: STA $1C or $1E, update $09E4 facing nibble, RTI
    ;   on fail: code_00E420 bounce, zero velocity, RTI
}
```

Unlike `[2D]`/`[2E]`, this does **not** use `$09C8` follower bits. It uses a separate **chase pool**:

| Reg | Role |
|-----|------|
| `$09E2` | Number of active chase slots (cap **8**) |
| `$20` | This actor’s slot index (`ASL` of `$09E2` at claim time) |
| `$09E4,Y` | Path state: low 2 bits = facing; upper bits = blocked directions / mode |

##### How it is used (only 2 sites)

Both allocate a slot then loop `[2F]` like wander:

```asm
; system/actor_0BF904.asm  /  mansion_underground_storage/actor_06CEA3.asm
LDA $09E2
CMP #$0008
BCS fallback_wander          ; pool full → [28] instead
ASL
STA $20
INC $09E2

chase:
    COP [72] ( #08 )
    COP [2F]                   ; one chase step
    COP [51]
    COP [98]
    COP [52]
    BRA chase
```

`$09E2` / `$09E4` are cleared on scene reset by `code_009C49` (alongside the follower tables’ `code_009C30`).

| Item | Value |
|------|-------|
| Suggested alias | `chase_step` |
| Anim | Default (`$0004`/`$0006` = 0); use `[30]` for custom |
| Max chasers | 8 |

- **Source examples:**
  - `system/actor_0BF904.asm:27`
  - `prinkys_mansion/mansion_underground_storage/actor_06CEA3.asm:86`

##### Related (`[2F]`–`[30]` chase / herd)

| Op | Name | Role |
|----|------|------|
| `[2F]` | `chase_step` | Independent chase AI via `$09E2`/`$09E4` (max 8) |
| `[30]` | `chase_step_anim` | Same chase AI + custom walk/bounce anim |

#### COP [30] — `chase_step_anim` (chase step with custom anim)

- **Confidence:** high
- **Preferred name:** `chase_step_anim`
- **Aliases:** `chase_step_ex`, `cop_30`
- **Handler:** `code_00AABA` @ `extracted/system/chunk_008000.asm:5887-5900` → `code_00AADD`
- **Parameters:** `#anim_base, #bounce_add` (same encoding as `[29]` / `[2E]`)
- **Usage count:** 1

##### What it does

```asm
code_00AABA {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    SEC
    SBC #$0004
    STA $0004              ; walk anim = facing + base
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $0006              ; bounce anim add
    JMP $&code_00AADD      ; shared chase AI with [2F]
}
```

Identical pathfinding to `[2F]` (`$20` → `$09E4`, step toward player `$0BB2/$0BB4`), but with non-zero anim scratch so walk frames use `facing+base` instead of `facing+4`.

##### Sole call site

```asm
; system/actor_0BF86C.asm — after claiming a chase slot
loc_0BF8F5:
    COP [72] ( #08 )
    COP [30] ( #08, #00 )    ; chase with anim base #08
    COP [51]
    COP [98]
    COP [52]
    BRA loc_0BF8F5
```

Compare sibling `actor_0BF904` / storage bots which use plain `[2F]` (default anim) in the same loop shape.

| Item | Value |
|------|-------|
| Suggested alias | `chase_step_anim #base, #bounce` |
| Relation | Prefixed `[2F]`; requires `$20` / `$09E2` slot |

- **Source examples:**
  - `system/actor_0BF86C.asm:68` — `#08, #00`
