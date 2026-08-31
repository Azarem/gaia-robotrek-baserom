# COP family: UI focus

_Deep-audited ops: `[32]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Claim UI / script focus by writing `#$01xx` into actor `$04` and global `$0B70`. Gated for actors with `$06` bit `$8000`.

## Shared state

- `$04` / `$0B70` — focus id pair
- Mismatch → typically `[B2]` despawn path in menu actors

## Family notes

- Almost exclusively menu / system UI under `chunk_0B8000`.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `32` | `set_focus_id` | 146 | high | Byte | `code_00ACBA` |

**Family call-site total:** 146

## Opcodes

#### COP [32] — `set_focus_id` (claim UI / script focus)

- **Confidence:** high
- **Preferred name:** `set_focus_id`
- **Aliases:** `claim_focus`, `set_ui_id`, `byte_op` (old stub)
- **Handler:** `code_00ACBA` @ `extracted/system/chunk_008000.asm:6214-6225`
- **Parameters:** `Byte` id (stored as `#$01xx`)
- **Usage count:** 146 (~89 distinct id bytes)

##### What it does

```asm
code_00ACBA {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    ORA #$0100              ; force high byte = $01
    STA $04                 ; this actor's focus/tag id
    STA $0B70               ; global "who has focus"
    LDA $2C
    STA $02, S
    RTI
}
```

##### Why it matters

Actor tick `code_00E7F2` (for actors with `$06` bit `$8000` set):

```asm
LDY $0B70
CPY $04
BNE not_focused
; … run script / delay …
not_focused:
    COP [B2]                ; suspend / tear down non-focused actor
```

So `[32]` both **tags** this actor and **claims** global focus. Other focus-gated actors whose `$04` no longer matches `$0B70` get `[B2]`’d. Menu/boot code also seeds `#$0100` into `$04`/`$0B70` on entry (`chunk_048000.asm`).

##### Id values in source

| Byte | Word stored | Typical context |
|------|-------------|-----------------|
| `#FA` | `$01FA` | Diary / lab / factory menu roots (5 sites) |
| `#64`–`#69` | `$0164`–`$0169` | Pause / status submenu states |
| `#10`/`#12`/`#36`/`#42` | `$0110`… | System UI panels |
| many `$C8`–`$D4`, etc. | | Robot factory / equipment screens |

Almost all uses live under `chunk_0B8000` / menu actors; overworld NPCs rarely touch `[32]`.

```asm
; chunk_0B8000 — enter a submenu
code_0B83A9 {
    COP [32] ( #65 )                    ; claim focus $0165
    COP [AC] ( @code_0B860E, #$A000 )   ; spawn UI helpers
    …
}
```

| Item | Value |
|------|-------|
| Suggested alias | `set_focus_id #id` |
| Stored value | `#$0100 \| id` in `$04` and `$0B70` |
| Gate | Actors with `$06 & #$8000`; mismatch → `[B2]` |

- **Source examples:**
  - `boot/diary_menu/actor_04B29E.asm:35` — `#FA`
  - `system/actor_0B80B9.asm:20` — `#FA`
  - `system/chunk_0B8000.asm:32` — `#65`
  - `system/chunk_0B8000.asm:52` — `#64`

> **Note:** `[30]` / `[31]` / `[32]` are **neighbors by opcode only** — chase anim, RNG tick, and UI focus are unrelated. See the [family index](#cop-0040-family-index).
