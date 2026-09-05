# COP family: NPC Lifecycle (spawn gate / idle guard)

_Deep-audited ops: `[6E]`, `[6F]`, `[70]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

**NPC lifecycle management** — conditional spawn, idle-loop gating, and graceful walk-off removal. `[6E]` is checked once during NPC initialization to prevent spawning when the scene-reset flag is active. `[6F]` is checked every idle-loop iteration to handle mid-scene NPC removal with walk-off animation. `[70]` is an unused simplified variant that only gates on the interaction-busy bit.

## Shared state

| Address | Width | Role |
|---------|------:|------|
| `$06` | 2 bytes | Actor flags — bit `#$4000` = interaction in progress, bit `#$0100` = cleared by `[6F]` on walk-off |
| `$0E` | 2 bytes | Delay/state value — set by `[6F]`/`[70]` when yielding |
| `$28` / `$2A` | 2+2 bytes | Script resume PC — `[6F]` redirects to `code_04BE0E` on scene reset |
| `$0BA6` / `$0BA8` | 2+2 bytes | Player X / Y position (used by walk-off routine to choose exit direction) |

### Flag `#$000F`

Tested via `code_00DBEF` against the `$0730` bitfield. When set, signals that the scene has been "reset" — NPCs gated by `[6E]`/`[6F]` should not exist. Typically set by story-progression events that change the map's NPC population.

### Helpers

| Routine | Purpose |
|---------|---------|
| `code_00DBEF` | Test flag in `$0730` bitfield (carry set if bit is set) |
| `code_04FD4E` | Actor self-destruct: unlink from actor chain, push slot to free pool |
| `code_04BE0E` | Walk-off-and-destroy: turns off collision, walks toward nearest screen edge, self-destructs |

## Family notes

- `[6E]` and `[6F]` always appear in the same actors — `[6E]` at the top of the init block, `[6F]` at the top of the idle loop.
- The typical NPC script structure is: `COP [0C]` flag branches → `COP [6E]` spawn gate → `COP [44]` solid_on → `COP [22]` set_interact → idle loop: `COP [6F]` → `COP [63]` wait_facing → `COP [28]` wander.
- `code_04BE0E` uses `COP [81]`/`[82]` directional walks and `COP [84]` turning animations before the final `COP [B2]` self-destruct. It compares actor position to player position to choose the walk direction (away from player).
- `[70]` is functionally a subset of `[6F]` — it checks `$06 bit #$4000` and sets `$0E` from a Byte operand, but lacks the flag `#$000F` scene-reset test. Zero call sites.
- All `[6E]`/`[6F]` call sites are in NPC actors: Rococo town NPCs (`system/actor_058xxx`–`05Axxx`) and map 139 NPCs (`unorganized/map_139/actor_0A8xxx`–`0A9xxx`).

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `6E` | `npc_spawn_gate` | 15 | high | (none) | `code_00BA36` |
| `6F` | `npc_idle_guard` | 14 | high | (none) | `code_00BA4B` |
| `70` | `npc_busy_wait` | 0 | high | Byte | `code_00BA82` |

**Family call-site total:** 29

## Opcodes

#### COP [6E] — `npc_spawn_gate` (destroy self if scene-reset flag set)

- **Preferred name:** `npc_spawn_gate`
- **Handler:** `code_00BA36`
- **Parameters:** none
- **Usage count:** 15

##### What it does

1. Test flag `#$000F` via `code_00DBEF`
2. If flag **clear** → continue script (NPC spawns normally)
3. If flag **set** → `JSL code_04FD4E` (self-destruct: unlink actor, free slot) → halt

##### Typical usage

```asm
    COP [0C] ( #$..., #$..., &... )   ; flag branches
    COP [74] ( #$..., #$... )         ; set tracked-id pair
    COP [6E]                           ; spawn gate
    COP [44]                           ; solid_on (survived)
    COP [22] ( &interact_handler )     ; set interact hook
```

- **WRAM:** `$2C`
- **JSR:** `code_00DBEF`
- **JSL:** `code_04FD4E`

#### COP [6F] — `npc_idle_guard` (scene-reset + interaction-busy gate)

- **Preferred name:** `npc_idle_guard`
- **Handler:** `code_00BA4B`
- **Parameters:** none
- **Usage count:** 14

##### What it does

1. Test flag `#$000F` → if set, redirect to `code_04BE0E` (walk-off-and-destroy)
2. Test `$06 bit #$4000` (interaction-busy) → if set, yield with `$0E = #$0008`
3. Neither condition → continue script (enter idle loop body)

##### `code_04BE0E` walk-off routine

- `COP [45]` solid_off → `COP [D0]` delay → 4× `COP [84]` turning anims
- Compare actor `$00`/`$02` vs player `$0BA6`/`$0BA8` → walk toward nearest edge
- Loop on `$06 bit #$4000` → `COP [B2]` self-destruct

##### Typical usage

```asm
  idle_loop:
    COP [6F]                         ; scene check + busy gate
    COP [63] ( &idle_loop )          ; wait_facing
    COP [28] ( #xx, #yy, #ww, #hh ) ; wander_rect
    COP [51] ... COP [52]            ; walk steps
    BRA idle_loop
```

- **WRAM:** `$06`, `$0E`, `$28`, `$2A`, `$2C`
- **JSR:** `code_00DBEF`

#### COP [70] — `npc_busy_wait` (yield while interaction-busy; unused)

- **Preferred name:** `npc_busy_wait`
- **Handler:** `code_00BA82`
- **Parameters:** Byte (delay value → `$0E`)
- **Usage count:** 0

##### What it does

1. Test `$06 bit #$4000`
2. If clear → skip Byte operand, continue
3. If set → read Byte → `$0E`, yield and retry

Simplified version of `[6F]` without the flag `#$000F` scene-reset test. Never used in the shipped game.

- **WRAM:** `$06`, `$0E`, `$28`, `$2C`

## Relationship diagram

```
  ┌─────────────────────────────────────────────────┐
  │              NPC Lifecycle                       │
  │                                                 │
  │  [6E] npc_spawn_gate                            │
  │    flag #$000F set? ──YES──► code_04FD4E        │
  │                               (instant kill)    │
  │    flag clear? ──► continue init                │
  │         ↓                                       │
  │  [44] solid_on → [22] set_interact              │
  │         ↓                                       │
  │  [6F] npc_idle_guard (every loop iteration)     │
  │    flag #$000F set? ──YES──► code_04BE0E        │
  │                               (walk off + kill) │
  │    $06 bit $4000? ──YES──► yield (busy)         │
  │    neither? ──► continue idle loop              │
  │         ↓                                       │
  │  [63] wait_facing → [28] wander_rect            │
  │                                                 │
  │  [70] npc_busy_wait (unused)                    │
  │    $06 bit $4000? ──YES──► yield (Byte → $0E)   │
  │    clear? ──► continue                          │
  └─────────────────────────────────────────────────┘
```
