# COP family: Interact Wait (adjacency + facing yield)

_Deep-audited ops: `[63]`, `[64]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

**Yield until the player is adjacent and facing this actor**, then turn to face the player, start the interaction animation, and resume at `&Code`. These are the primary "NPC idle → ready to talk" primitives. `[64]` extends `[63]` with a configurable animation base offset.

## Shared state

### WRAM (read during check)

| Address | Width | Role |
|---------|------:|------|
| `$00` | 2 bytes | Actor sprite X |
| `$02` | 2 bytes | Actor sprite Y |
| `$0BB2` | 2 bytes | Player coarse cell X |
| `$0BB4` | 2 bytes | Player coarse cell Y |
| `$0BAA` | 2 bytes | Player facing direction (0–3) |

### WRAM (written)

| Address | Width | Role |
|---------|------:|------|
| `$08` | 2 bytes | Bit `$0100`: set = interaction ready, cleared = not ready |
| `$0C` | 2 bytes | Actor facing direction |
| `$10` | 2 bytes | Animation frame counter (zeroed on success) |
| `$28` | 2 bytes | Yield resume pointer (= `&Code`) |
| `$30` | 2 bytes | Animation base offset (`0` for `[63]`, operand for `[64]`) |
| `$34` / `$36` | 2 bytes each | Scratch: actor cell X / Y |

### Actor RAM

| Offset | Role |
|--------|------|
| `$7F000C,X` | Animation id — set to `facing + $30` on success |

### Helpers

| Routine | Purpose |
|---------|---------|
| `code_04FC71` | Animation frame lookup and setup |

## Adjacency + facing algorithm

1. Compute actor cell: `$34 = ($00 - 8) >> 4`, `$36 = ($02 - 16) >> 4`
2. Compare against player coarse position (`$0BB2`, `$0BB4`)
3. If exactly 1 cell apart on one axis (and same on the other), determine direction:
   - Y=3: player is left
   - Y=1: player is right
   - Y=0: player is above
   - Y=2: player is below
4. Compare computed direction against `$0BAA` (player facing) — must match
5. **Fail**: clear `$0100` in `$08`, restore facing from anim (`($7F000C,X - $30) & 3`), skip `&Code`
6. **Success**: set facing to face player (`dir ^ 1`), set anim (`dir ^ 1 + $30`), set `$0100` in `$08`, store `&Code` in `$28`, **yield** (`PLA PLA RTL`)

## Family notes

- Both ops share the same handler body at `loc_00B673`. `[63]` enters with `STZ $30`; `[64]` enters with `LDA [$2C]... STA $30`.
- Nearly all call sites use `&Code` pointing to **the same instruction** (self-loop), creating a yield-until-met spin loop.
- The `$08` flag `$0100` is an "interaction ready" signal to other engine systems.
- On success the actor **halts** (yields). On the next tick, execution resumes at `&Code`.
- On fail the script continues past `&Code`, typically entering a wander or idle loop.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `63` | `wait_facing` | 311 | high | &Code | `code_00B670` |
| `64` | `wait_facing_anim` | 23 | high | Byte, &Code | `code_00B664` |

**Family call-site total:** 334

## Opcodes

#### COP [63] — `wait_facing` (default anim base = 0)

- **Preferred name:** `wait_facing`
- **Handler:** `code_00B670`
- **Parameters:** `&Code` on_adjacent
- **Usage count:** 311

##### Typical usage

```asm
    COP [44]                          ; solid_on
    COP [22] ( &on_talk )             ; set interact handler
  idle:
    COP [63] ( &idle )                ; ← self-loop: yield until player adjacent+facing
    COP [28] ( ... )                  ; wander (runs after interaction completes)
    COP [51]
    ...
    BRA idle
```

- **Source examples:**
  - `fathers_house/actor_07A684.asm:25` — `COP [63] ( &code_07A6AD )`
  - `rococo/tunnel_entrance/actor_05F686.asm:20` — `COP [63] ( &code_05F6A2 )`
  - `native_village/volcano/actor_07DE2B.asm:22` — `COP [63] ( &code_07DE49 )`

#### COP [64] — `wait_facing_anim` (custom anim base offset)

- **Preferred name:** `wait_facing_anim`
- **Handler:** `code_00B664` → falls through to `code_00B670` body
- **Parameters:** `Byte` anim_base, `&Code` on_adjacent
- **Usage count:** 23

##### Observed animation base values

| Base | Count | Context |
|-----:|------:|---------|
| `#00` | 4 | Default sprites |
| `#08` | 5 | Cave transport NPCs |
| `#0C` | 3 | Alternate sprite sheets |
| `#0D` | 6 | Native village NPCs |
| `#10` | 4 | Special sprites |
| `#14` | 1 | Unique NPC |

##### Typical usage

```asm
  idle:
    COP [64] ( #0D, &idle )           ; wait facing with anim base 0x0D
    COP [80] ( #0D )                  ; set interaction anim
    COP [97]
    BRA idle
```

- **Source examples:**
  - `native_village/elders_hut/actor_07D0D7.asm:83` — `#0C`
  - `native_village/native_inn/actor_07BAB4.asm:43` — `#0D`
  - `seaside_cave/cave_transport/actor_0691F9.asm:15` — `#08`

## Relationship diagram

```
  ┌─────────────────────────────────────────────────┐
  │            Interact Wait System                  │
  │                                                  │
  │  Player pos ($0BB2/$0BB4) ──┐                    │
  │  Player facing ($0BAA) ─────┤                    │
  │  Actor pos ($00/$02) ───────┼──► adjacency test  │
  │                             │                    │
  │  [63] wait_facing ──────────┤ ($30 = 0)          │
  │  [64] wait_facing_anim ─────┘ ($30 = operand)    │
  │                                                  │
  │  Success: $0C = face player                      │
  │           $7F000C = anim + $30                   │
  │           $08 |= $0100                           │
  │           yield → resume at &Code                │
  │                                                  │
  │  Fail:   $08 &= ~$0100                           │
  │          $0C = anim-derived facing               │
  │          skip &Code                              │
  └─────────────────────────────────────────────────┘
```
