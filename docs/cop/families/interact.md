# COP family: Interact hooks

_Deep-audited ops: `[22]`, `[23]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Install the script the player invokes when talking to / activating this actor. Dispatch lives in `code_0BE478` (player host).

## Shared state

- `$7F0028,X` — primary interact (`[22]`)
- `$7F2032,X` — alternate interact (`[23]`, `$4C` companion mode)
- Interact bodies typically `RTL` back into the dispatcher → often `[01]`

## Family notes

- Usually preceded by `[44]` solid_on so the actor is tangible.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `22` | `set_interact` | 560 | high | &Code | `code_00A6D3` |
| `23` | `set_interact_alt` | 3 | high | &Code | `code_00A6E3` |

**Family call-site total:** 563

## Shared reference

#### Interact script slots (`$7F0028` / `$7F2032`)

When the player presses talk/interact on a solid actor, `code_0BE478` (`extracted/system/actor_0BD8F4.asm`) runs:

1. Load **`$7F0028,X`** — if 0, no interact.
2. Gate on actor `$08`: bit `$0100` = allow without facing check; bit `$0080` = require facing (`NPC.$0C XOR 1 == player $0BAA`).
3. Call the chosen `&Code` as a far subroutine (`PHK` / `PEA return-1` / `PLB=$2A` / `RTL` into pointer).
4. On return → `COP [01]` cleanup path.

**Which pointer is used:**

| Condition | Script used |
|-----------|-------------|
| Normal / `$06` bit `$2000` / `$0678==#$004D` | **`$7F0028`** (primary — `[22]`) |
| `$0676 == #$004C` (companion id `$4C` active) | **`$7F2032`** if nonzero (alt — `[23]`); else `string_01DA73` (“·····???”) |

`$004C` / `$004D` are the same companion ids counted by `COP [62]` (`branch_if_party_size`). Both slots are cleared on actor init (`code_00E5xx`).

## Opcodes

#### COP [22] — `set_interact` (install primary talk/action script)

- **Confidence:** high
- **Preferred name:** `set_interact`
- **Aliases:** `set_action_script`, `set_talk_script`, `on_interact`
- **Handler:** `code_00A6D3` @ `extracted/system/chunk_008000.asm:5296-5305`
- **Parameters:** `&Code` (same-bank interact handler)
- **Usage count:** 560

##### What it does

Stores the operand into **`$7F0028,X`** and continues. Does not call the script — only arms it for later interact dispatch.

```asm
; Handler (complete)
code_00A6D3 {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    STA $7F0028, X         ; primary interact PC
    LDA $2C
    STA $02, S
    RTI
}
```

`COP [22] ( #$0000 )` **clears** the slot (5 sites) — actor stops being talkable.

##### Why / how used

Standard NPC / object setup: make solid, register what happens on talk, then idle.

```asm
COP [44]                            ; solid_on
COP [22] ( &code_on_talk )          ; set_interact
idle:
    COP [63] ( &idle )
    COP [80] ( #01 )
    COP [97]
    BRA idle

code_on_talk {
    COP [1D] ( &string_hello )
    RTL                             ; return to interact dispatcher
}
```

**Rewrite mid-scene** is common (~98 files have multiple `[22]`): after a quest beat, swap the talk handler so the next press says something else.

```asm
; first talk opens door dialog, then swap to “are you pushing?”
COP [22] ( &code_05F73F )
...
code_05F73F {
    COP [1D] ( &string_shut_door )
    COP [0A] ( #$8001 )
    COP [22] ( &code_05F757 )       ; replace interact
    COP [CF] ( @code_05F6AF )
    RTL
}
```

Interact handlers typically end with **`RTL`** (return to `code_0BE4BF` → `[01]`), sometimes `COP [CF]` far goto, or more dialog/flags. They are **not** the actor’s main/idle loop — that stays running via `[63]`/`[CB]`/`[80]`/`[97]`.

| Item | Value |
|------|-------|
| Suggested alias | `set_interact &label` |
| Clears with | `COP [22] ( #$0000 )` |
| Pairs with | `[44]` solid_on; `$08` bits `$80`/`$100` for talk gating |

**Caveat:** some movement helpers (e.g. `code_00D538`) temporarily reuse `$7F0028` as a step counter — those actors are not using it as an interact pointer at the same time.

- **Source examples:**
  - `rococo/tunnel_entrance/actor_05F686.asm:16,80,94` — install / swap interact
  - `fathers_house/actor_07A684.asm:22,50` — solid + interact + idle
  - `fathers_house/fathers_house/actor_078ACB.asm:15` — Dad talk tree
  - `prinkys_mansion/actor_06C227.asm:11` — object interact

#### COP [23] — `set_interact_alt` (install companion-mode talk script)

- **Confidence:** high
- **Preferred name:** `set_interact_alt`
- **Aliases:** `set_secondary_script`, `set_interact_4C`, `on_interact_alt`
- **Handler:** `code_00A6E3` @ `extracted/system/chunk_008000.asm:5307-5316`
- **Parameters:** `&Code` (or `#$0000` to clear)
- **Usage count:** 3

##### What it does

Same write pattern as `[22]`, but into **`$7F2032,X`**.

```asm
; Handler (complete)
code_00A6E3 {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    STA $7F2032, X         ; alternate interact PC
    LDA $2C
    STA $02, S
    RTI
}
```

Dispatched only when interact runs while **`$0676 == #$004C`** (see `code_0BE478`). If the alt pointer is 0 in that mode → `COP [1F] ( &string_01DA73 )` (“·····???”).

##### Why / how used

Rare: give an actor a **different** talk line / behavior when companion `$4C` is the active party member in `$0676`, vs normal/`$4D` mode.

```asm
; NPC: normal talk + special companion talk
COP [44]
COP [22] ( &code_058A98 )          ; primary
COP [23] ( &code_058ADE )          ; alt for $004C mode
; idle…

; combat/object helper: same handler for both, then clear
COP [22] ( &code_03FC7B )
COP [23] ( &code_03FC7B )
...
COP [22] ( #$0000 )
COP [23] ( #$0000 )
```

| Site | Role |
|------|------|
| `system/actor_0589D9.asm:18` | Primary + alt with flag/item check in alt path |
| `system/chunk_038000.asm:14828` | Install same `&code_03FC7B` on both slots |
| `system/chunk_038000.asm:14862` | Clear both with `#$0000` |

| Item | Value |
|------|-------|
| Suggested alias | `set_interact_alt &label` |
| vs `[22]` | Only used when `$0676==#$004C` |

- **Source examples:**
  - `system/actor_0589D9.asm:17-18` — dual install
  - `system/chunk_038000.asm:14827-14828,14861-14862` — set / clear pair
