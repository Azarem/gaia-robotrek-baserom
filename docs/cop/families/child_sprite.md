# Child Sprite Spawn — COP `[8D]`–`[90]`

> Deep-audited ops: `[8D]` `[8E]` `[8F]` `[90]`

## Overview

Four opcodes that **spawn a child rendering actor** for visual effects — projectiles, explosions, companion sprites, etc. The child gets its own slot in the engine's sprite pool, loads a spritemap/animation frame, and renders independently until dismissed.

Two axes of variation:

| Axis | Variants |
|------|----------|
| **Guard check** | `[8D]`/`[8E]` call `code_00E616` — skip spawn if child already alive. `[8F]`/`[90]` always spawn. |
| **Tile address** | `[8D]`/`[8F]` read a byte into `$7F0D30,X`. `[8E]`/`[90]` read a word into `$7F0D30,X` + extra byte into `$7F0D60,X`. |
| **Exit mode** | `[8D]`/`[8E]` end with `RTI` (continue script). `[8F]`/`[90]` end with `PLA PLA RTL` (yield/halt). |

| Op | Guard | Tile mode | Exit | Operands | Uses |
|----|:-----:|-----------|------|----------|-----:|
| `[8D]` | yes | byte | continue | `Byte, Byte` | 5 |
| `[8E]` | yes | word+extra | continue | `Byte, Byte, Byte` | 10 |
| `[8F]` | no | byte | yield | `Byte, Byte` | 40 |
| `[90]` | no | word+extra | yield | `Byte, Byte, Byte` | 5 |

## Shared mechanism

### Allocation pipeline

All four handlers share the same core allocation sequence:

1. **Spritemap bank lookup:** Read `$7F2002,X` (parent actor's spritemap bank override). Call `code_04FDDD` to allocate a free child sprite slot from the pool. If the override is zero, default to `unk36_list_108000`.
2. **Store spritemap pointers:** Write the bank address to `$7F0DF0,X` (lo) and bank byte `#$*unk36_list_108000` to `$7F0E08,X` (hi).
3. **Read tile/frame operands:** Store animation frame id into `$7F0D30,X`. For word variants, also store extra tile data into `$7F0D60,X`.
4. **Store parent reference:** Save the parent actor's stack pointer (return address) into `$7F0E20,X`.
5. **Palette offset:** Read byte 2 — if nonzero, compute `$04 << 4` and store to `$7F0DD8,X` (palette offset). If zero, clear `$7F0DD8,X`.
6. **Render setup:** Call `code_08E757` (load animation frame data — tiles, palette, size) and `code_08E805` (queue VRAM DMA transfer).
7. **Link parent → child:** Store `child_slot + 1` into parent's `$7F0020,X`.
8. **Exit:** `RTI` (continue) for guarded variants, `PLA PLA RTL` (yield) for unguarded variants.

### Guard check (`[8D]`/`[8E]` only)

```asm
    JSR $&code_00E616      ; check if child actor is alive
    BCC loc_spawn          ; carry clear → no child, proceed
    JMP $&code_009F00      ; carry set → child exists, skip operands
```

`code_00E616` reads `$7F0020,X` (parent's child link), decrements it, then checks if the child's `$7F0E20,X` matches the parent. If the child is still alive and linked, spawn is skipped and operands are consumed without effect.

### Helpers

| Label | Role |
|-------|------|
| `code_00E616` | Child-alive guard — returns C=1 if child still active |
| `code_04FDDD` | Allocate a free slot from the child sprite pool (`$7F0E20`–`$7F0E36`, max 12 slots) |
| `code_08E757` | Load animation frame data from spritemap table into `$7F0D78`/`$7F0D90`/`$7F0DA8` |
| `code_08E805` | Queue VRAM DMA for the loaded sprite tiles |
| `code_08F322` | Spritemap setup (used by `[8B]`, not by this family) |
| `code_009F00` | Skip 2 operand bytes and continue (used by guard skip path) |

### Actor fields written (child slot)

| Field | Role |
|-------|------|
| `$7F0DF0,X` | Spritemap table pointer (lo word) |
| `$7F0E08,X` | Spritemap table bank byte |
| `$7F0D30,X` | Animation frame / tile index |
| `$7F0D60,X` | Extra tile data (word variants only) |
| `$7F0E20,X` | Parent actor reference (stack pointer) |
| `$7F0D48,X` | Frame progress counter (cleared to 0) |
| `$7F0DD8,X` | Palette offset (`$04 << 4` if nonzero operand, else 0) |
| `$7F0020,X` | Parent's child link (= child slot + 1) |

## Opcodes

---

#### COP [8D] — `spawn_child_guarded` (guarded, byte tile, continue)

- **Confidence:** high
- **Preferred name:** `spawn_child_guarded`
- **Handler:** `code_00BFFB` @ chunk_008000.asm:9061–9112
- **Parameters:** `Byte` (tile_frame), `Byte` (palette_flag)
- **Usage count:** 5

Spawns a child sprite if no existing child is alive. Reads a byte tile frame index, optionally applies palette offset, renders, then continues the script. Used in battle sequences where a projectile/effect should only exist once at a time.

Call sites: `chunk_038000.asm` (battle), `actor_04BADE` (system), `chunk_048000.asm`, `chunk_0B8000.asm`.

```asm
  loc_03E091:
    COP [CC]               ; (tick/yield)
    COP [8D] ( #08, #01 )  ; spawn child: tile 8, use palette
    LDA $7F0022, X         ; check parent link
    TAY
    LDA $0006, Y           ; poll child status
    BIT #$0080
    BEQ loc_03E091          ; loop until child done
```

---

#### COP [8E] — `spawn_child_guarded_w` (guarded, word tile + extra, continue)

- **Confidence:** high
- **Preferred name:** `spawn_child_guarded_w`
- **Handler:** `code_00C062` @ chunk_008000.asm:9114–9141
- **Parameters:** `Byte` (tile_frame), `Byte` (extra_tile), `Byte` (palette_flag)
- **Usage count:** 10

Like `[8D]` but reads an additional byte into `$7F0D60,X` (extra tile data). The tile frame is read as a word (16-bit) into `$7F0D30,X`. Falls through to `[8D]`'s allocation+render path at `code_00C02A`.

Call sites: `chunk_0B8000.asm` (1 site), `chunk_038000.asm` (9 sites — battle effects).

---

#### COP [8F] — `spawn_child` (unguarded, byte tile, yield)

- **Confidence:** high
- **Preferred name:** `spawn_child`
- **Handler:** `code_00C09C` @ chunk_008000.asm:9143–9191
- **Parameters:** `Byte` (tile_frame), `Byte` (palette_flag)
- **Usage count:** 40

Spawns a child sprite unconditionally (no alive-guard check). After spawning, saves `$28` and yields (`PLA PLA RTL`). The most common child spawn variant.

Used across the game: robot factory (companion creation), seaside cave HQ (character spawn), volcano base, hacker fortress, and various system actors.

Most call sites use `palette_flag = #00` (no palette offset). Always followed by `COP [9C]` (child wait/tick).

```asm
    COP [8F] ( #01, #00 )  ; spawn child: tile 1, default palette
    COP [9C]               ; wait for child to complete
```

---

#### COP [90] — `spawn_child_w` (unguarded, word tile + extra, yield)

- **Confidence:** high
- **Preferred name:** `spawn_child_w`
- **Handler:** `code_00C0FD` @ chunk_008000.asm:9192–9217
- **Parameters:** `Byte` (tile_frame), `Byte` (extra_tile), `Byte` (palette_flag)
- **Usage count:** 5

Like `[8F]` but reads an additional byte into `$7F0D60,X` (extra tile data). Falls through to `[8F]`'s allocation+render path at `code_00C0C3`.

Call sites: `hacker_fortress/return_to_quintenix`, `boot/prologue_androids` (2 sites), `volcano_base`, `chunk_0B8000.asm`.

## Usage statistics

| Op | Name | Sites | Files |
|----|------|------:|------:|
| `[8D]` | `spawn_child_guarded` | 5 | 4 |
| `[8E]` | `spawn_child_guarded_w` | 10 | 2 |
| `[8F]` | `spawn_child` | 40 | 19 |
| `[90]` | `spawn_child_w` | 5 | 4 |
| | **Total** | **60** | |

## Family notes

- The guarded variants (`[8D]`/`[8E]`) are used in battle loops where the script repeatedly checks if a projectile/effect child is alive before spawning a new one. The non-guarded variants (`[8F]`/`[90]`) unconditionally spawn and are used in scripted sequences.
- The exit mode difference (continue vs yield) maps to usage: guarded spawns happen mid-script (the script immediately starts polling the child), while unguarded spawns yield control to the engine.
- `[8F]` is by far the most common (40 sites), used for general-purpose visual effects.
- All four ops share `code_04FDDD` for slot allocation (max 12 child slots at `$7F0E20`–`$7F0E36`).
- The `$7F0020,X` parent link allows the parent to track and poll its child. Many call sites read `$7F0022,X` → `$0006,Y` to check if the child has finished.
- `$7F2002,X` provides a spritemap bank override — if the parent has set it (e.g., to `unk36_list_10D000`), the child uses that bank; otherwise defaults to `unk36_list_108000`.

## Relationship to other families

```
[8D]–[90] child_sprite family
  ├── [8D]/[8E] guarded spawn — checks code_00E616 before allocating
  ├── [8F]/[90] unguarded spawn — always allocates
  ├── [9B] anim_tick          — COP [88]'s companion (unrelated but similar tick pattern)
  ├── [9C] child_wait         — yield/tick until child completes (follows [8F]/[90])
  ├── [CC] (yield tick)       — used in [8D]/[8E] polling loops
  └── [79] spawn_effect       — related but simpler effect spawn (uses different allocation)
```
