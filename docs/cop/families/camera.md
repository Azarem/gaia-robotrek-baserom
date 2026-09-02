# COP family: Camera (scroll / shake)

_Deep-audited ops: `[68]`, `[69]`, `[6A]`, `[6B]`, `[6C]`, `[6D]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

**Camera scroll, screen effects, and visual overlays** for cinematics, cutscenes, and special events. `[68]` initiates or chains camera pans by spawning a child scroll actor. `[69]` returns the camera to its saved position. `[6A]` configures screen scroll bounds (used for shake effects and cinematic viewports). `[6B]` is a conditional "phase-2" scroll that waits for a flag then interpolates bounds to their final position. `[6C]` spawns a child actor that applies a screen flash/color-math effect via SNES windowing registers. `[6D]` applies a vertical camera jitter for a specified number of frames.

## Shared state

### WRAM

| Address | Width | Role |
|---------|------:|------|
| `$080A` | 2 bytes | Current camera X |
| `$080E` | 2 bytes | Current camera Y |
| `$0890` | 2 bytes | Screen shake frame counter |
| `$0892` | 1 byte | Scroll bound: left |
| `$0894` | 1 byte | Scroll bound: top |
| `$0896` | 1 byte | Scroll bound: right |
| `$0898` | 1 byte | Scroll bound: bottom |
| `$0EF4` | 2 bytes | Actor spawn pool index |
| `$0884` | 2 bytes | Screen effect duration (`[6C]` child) |
| `$0886` | 2 bytes | Parent actor link (`[6C]` child) |

### Per-actor (child scroll actor)

| Address | Role |
|---------|------|
| `$7F1030,X` / `$7F1032,X` | Saved camera X/Y (original position) |
| `$7F200E,X` | Child scroll actor link (parent → child) |
| `$0022,X` | Done flag (nonzero when scroll complete) |
| `$0028,X` / `$002A,X` | Child resume routine |
| `$0030,X` | Direction/speed |
| `$0032,X` | State flag (returning?) |
| `$0034,X` / `$0036,X` | Target camera X/Y |

### Helpers

| Routine | Purpose |
|---------|---------|
| `code_00E55E` | Spawn child scroll actor (`[68]`) |
| `code_00E535` | Spawn child scroll actor (`[6A]`) |
| `code_00E510` | Compute delta position from operand |
| `code_00E398` | Set scroll direction/speed |
| `code_04BC6C` | Scroll animation routine (for `[68]`) |
| `code_04BC40` | Scroll animation routine (for `[6A]`) |
| `code_00DBEF` | Test flag in `$0730` bitfield (carry = set) |
| `code_00DBBD` | Set/clear flag in `$0730` bitfield |
| `code_04BB8D` | Screen effect child body (`[6C]` — color math / windowing) |
| `code_04BBC5` | Screen effect cleanup (reset `WOBJSEL`/`WH2`/`WH3`, self-destruct) |

## Family notes

- `[68]` mode byte `#00` = new scroll (spawns child actor, saves camera). Mode `#01` = continue/chain (reuses existing child).
- `[69]` always follows `[68]`. It reads the child actor link and scrolls back to the saved camera position.
- `[6A]` must be preceded by `STZ $30` — every call site does this. The `$30` variable is the repeat/frame counter.
- `[6A]` is primarily for cinematic setups (defining the scroll viewport) rather than directional scrolling. Often followed by `[68]` chains.
- All call sites are in cinematic/cutscene contexts: boot prologue, credits, rocket launch, flashbacks, mansion scenes, earthquake effects.
- Flag `#$8322` is set by `[6A]` to signal scroll bounds are active.
- `[6B]` is the "phase 2" companion to `[6A]`: it waits for a flag (or `#$FFFF` for unconditional), runs the same 4-bound interpolation, then **clears** flag `#$0322`.
- `[6C]` spawns a child actor running `code_04BB8D` which uses SNES color math and windowing registers (`WOBJSEL`, `COLDATA`, `WH2`, `WH3`) for a timed screen flash. The parent terminates the effect by setting flag `#$0323` (via `COP [0A]`).
- Operand values for `[6C]`: `#08` = ~130ms quick flash, `#0C` = ~200ms, `#32` = ~800ms long effect.
- `[6D]` uses `$30` (pre-loaded by the caller) as frame counter. Each frame, it adds a Y offset from a 4-entry lookup table (`+1, 0, +2, 0`) to `$080E`, creating a non-uniform vertical jitter. Net drift is +3 per 4 frames (intentionally downward). Most heavily used camera op with 45 call sites across earthquake, tremor, explosion, and cinematic shake sequences.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `68` | `camera_scroll` | 44 | high | Byte, Byte, Byte, Byte | `code_00B744` |
| `69` | `camera_return` | 10 | high | Byte | `code_00B7C2` |
| `6A` | `screen_shake` | 15 | high | Byte×10 | `code_00B807` |
| `6B` | `camera_scroll_await` | 2 | high | Word, Byte×6 | `code_00B906` |
| `6C` | `spawn_screen_effect` | 6 | high | Byte | `code_00B9D2` |
| `6D` | `camera_y_shake` | 45 | high | (none; uses `$30`) | `code_00BA04` |

**Family call-site total:** 122

## Opcodes

#### COP [68] — `camera_scroll` (start/continue camera pan)

- **Preferred name:** `camera_scroll`
- **Handler:** `code_00B744`
- **Parameters:** `Byte` mode, `Byte` delta_x, `Byte` delta_y, `Byte` speed
- **Usage count:** 44

##### Operand layout

| Byte | Role |
|------|------|
| 0 | Mode: `#00` = init, `#01` = chain |
| 1 | Delta X (signed byte) |
| 2 | Delta Y (signed byte) |
| 3 | Speed/direction flags |

##### Typical usage

```asm
    ; Cinematic camera pan sequence
    COP [68] ( #00, #00, #FB, #01 )   ; init: scroll up
    COP [68] ( #01, #0F, #00, #01 )   ; chain: scroll right
    COP [1D] ( &dialog )              ; show dialog during pan
    COP [68] ( #01, #00, #E9, #01 )   ; chain: scroll up more
    COP [69] ( #01 )                  ; return to original position
```

- **Source examples:**
  - `boot/prologue_rococo/actor_04E7C5.asm` — 6 calls in sequence
  - `credits/credits_fortress/actor_04CD6E.asm` — 3 calls
  - `prinkys_mansion/mansion_exterior/actor_06D126.asm` — 2 calls

#### COP [69] — `camera_return` (scroll back to original position)

- **Preferred name:** `camera_return`
- **Handler:** `code_00B7C2`
- **Parameters:** `Byte` direction
- **Usage count:** 10

Restores camera from `$7F1030`/`$7F1032` (saved by `[68]`) and yields until the scroll completes.

##### Observed direction values

| Value | Count |
|------:|------:|
| `#01` | 3 |
| `#03` | 2 |
| `#05` | 1 |
| `#07` | 3 |
| `#11` | 1 |

- **Source examples:**
  - `prinkys_mansion/mansion_breaker_room/actor_06EE9C.asm:31` — `#01`
  - `system/actor_0CBA7F.asm:65` — `#07`
  - `unorganized/map_139/actor_0A8C3E.asm:55` — `#07`

#### COP [6A] — `screen_shake` (scroll bounds interpolation)

- **Preferred name:** `screen_shake`
- **Handler:** `code_00B807`
- **Parameters:** `Byte`×10
- **Usage count:** 15

##### Operand layout

| Byte | Role |
|------|------|
| 0 | Frame count |
| 1 | Step size |
| 2–5 | Target bounds (L, T, R, B) |
| 6–9 | Initial bounds (L, T, R, B) |

##### Typical usage

```asm
    STZ $30                            ; required init
    COP [6A] ( #01, #10, #10, #F0, #10, #90, #10, #F0, #10, #90 )
    COP [D0] ( #$0010 )               ; delay
    COP [68] ( #00, #00, #FB, #01 )   ; then scroll
```

- **Source examples:**
  - `boot/prologue_rococo/actor_04E7C5.asm:14` — standard bounds
  - `space/rocket_takeoff/actor_08C293.asm:11` — wide for space
  - `unorganized/actor_09CD0F.asm:11` — speed 4, custom bounds

#### COP [6B] — `camera_scroll_await` (conditional scroll-bound interpolation)

- **Preferred name:** `camera_scroll_await`
- **Aliases:** `scroll_bounds_wait`, `camera_phase2`
- **Handler:** `code_00B906`
- **Parameters:** `Word` flag, `Byte` speed, `Byte` step, `Byte` bound_top, `Byte` bound_bot, `Byte` bound_left, `Byte` bound_right
- **Usage count:** 2

##### Operand layout (8 bytes)

| Offset | Size | Field | Meaning |
|---|---|---|---|
| 0 | Word | `flag` | Flag id to wait for (`#$FFFF` = unconditional) |
| 2 | Byte | `speed` | Loop count per interpolation step → `$30` |
| 3 | Byte | `step` | Pixel delta per bound per frame → `$34` |
| 4 | Byte | `bound_top` | Target for `$0892` |
| 5 | Byte | `bound_bot` | Target for `$0894` |
| 6 | Byte | `bound_left` | Target for `$0896` |
| 7 | Byte | `bound_right` | Target for `$0898` |

##### How it works

1. Read Word operand (flag id). If `#$FFFF`, skip flag test.
2. Otherwise, `JSR code_00DBEF` — test flag in `$0730` bitfield. If not set, yield & retry.
3. Decrement `$30`. If nonzero, yield & retry (pre-wait countdown).
4. When ready: read remaining 6 Byte operands. Run the same 4-bound interpolation as `[6A]`.
5. On convergence: `JSR code_00DBBD` with `#$0322` (bit 15 clear = **clear** flag). Skip remaining 4 bytes and continue.

##### Difference from `[6A]`

| Aspect | `[6A]` screen_shake | `[6B]` camera_scroll_await |
|---|---|---|
| Entry | Immediate | Waits for flag or `#$FFFF` bypass |
| On completion | **Sets** flag `#$0322` | **Clears** flag `#$0322` |
| Spawns child | Yes | No |

The pair `[6A]` + `[6B]` forms a two-phase cinematic: `[6A]` shakes and sets `#$0322`, then `[6B]` waits and brings bounds to final position, clearing the flag.

##### All 2 call sites

| File | Operands | Context |
|---|---|---|
| `unorganized/actor_09CD0F.asm:25` | `#$0005, #04, #04, #20, #E0, #70, #70` | Wait for flag 5, speed 4 |
| `credits/credits_inventors/actor_04D524.asm:34` | `#$FFFF, #01, #01, #80, #80, #50, #50` | Unconditional, speed 1 |

- **WRAM:** `$0890`, `$0892`, `$0894`, `$0896`, `$0898`, `$28`, `$2C`, `$30`, `$32`, `$34`
- **JSR:** `code_00DBEF`, `code_00DBBD`

#### COP [6C] — `spawn_screen_effect` (screen flash / color-math child)

- **Preferred name:** `spawn_screen_effect`
- **Aliases:** `screen_flash`, `color_effect`
- **Handler:** `code_00B9D2`
- **Parameters:** `Byte` duration (frames)
- **Usage count:** 6

##### What it does

1. `JSR code_00E535` — allocate child actor slot
2. Set child code body to `code_04BB8D` (`$0028,X` / `$002A,X`)
3. Read Byte operand → store in child's `$0022,X` (duration/timer)
4. Store parent actor index in child's `$7F0022,X`
5. `JSR code_00DBBD` with `#$8323` (bit 15 set = **set** flag `#$0323`)
6. Continue script

##### `code_04BB8D` — screen effect child

The child actor configures SNES color math (`COLDATA`) and windowing (`WOBJSEL`, `WH2`, `WH3`) registers, runs a DMA-driven visual effect for the specified duration, then yields. When the parent sets flag `#$0323` (typically via `COP [0A] ( #$0323 )`), the child calls `code_04BBC5` to reset the windowing registers and self-destructs (`COP [B2]`).

##### Operand values

| Value | Frames | Duration | Context |
|------:|-------:|----------|---------|
| `#08` | 8 | ~130ms | Quick flash (tomb, mansion) |
| `#0C` | 12 | ~200ms | Medium flash (switch activation) |
| `#32` | 50 | ~800ms | Long effect (Rask's spaceship) |

##### All 6 call sites

| File | Operand | Context |
|---|---|---|
| `fathers_house/family_tomb_inner/actor_07886C.asm:19` | `#08` | Music fade → flash → SFX |
| `prinkys_mansion/mansion_underground_storage/actor_06CCE2.asm:14` | `#08` | Dialogue → flash → SFX |
| `prinkys_mansion/mansion_underground_switch/actor_06C854.asm:11` | `#0C` | Flag set → flash → solid on |
| `unorganized/actor_09E10B.asm:12` | `#32` | Flag clear → long effect → interact |
| `unorganized/actor_09E10B.asm:162` | `#32` | Callback → long effect → branch |
| `unorganized/map_157/actor_09E6C5.asm:9` | `#32` | Rask's spaceship scene |

- **WRAM:** `$0022`, `$0028`, `$002A`, `$0884`, `$0886`, `$0EF4`
- **Actor RAM:** `$7F0022,X`
- **JSR:** `code_00E535`, `code_00DBBD`
- **SNES regs:** `WOBJSEL` (`$2125`), `COLDATA` (`$2132`), `WH2` (`$2127`), `WH3` (`$2128`)

#### COP [6D] — `camera_y_shake` (vertical camera jitter)

- **Preferred name:** `camera_y_shake`
- **Aliases:** `screen_jitter`, `quake_y`
- **Handler:** `code_00BA04`
- **Parameters:** none (uses pre-loaded `$30` as frame counter)
- **Usage count:** 45

##### How it works

Each frame: `DEC $30` → if negative, done. Otherwise `$30 AND #$0003` indexes a 4-entry lookup (`+1, 0, +2, 0`) that is added to camera Y (`$080E`). The handler rewinds the script PC to self-loop until the counter expires.

##### Lookup table `word_00BA2A`

| `$30 & 3` | Y offset |
|---:|---:|
| 0 | +1 |
| 1 | 0 |
| 2 | +2 |
| 3 | 0 |

##### Typical usage

```asm
    LDA #$001E
    STA $30
    COP [6D]          ; shake 30 frames (~500ms)
    COP [0A] ( #$8060 )
```

##### Sample call sites (5 of 45)

| File | `$30` | Context |
|---|---|---|
| `hacker_fortress/tetron_room/actor_04DB88.asm:35` | `#$0078` | Tetron room collapse |
| `volcano_base/volcano_cave_tremors/actor_07ECD8.asm:38` | `#$0010` | Volcano tremor loop |
| `seaside_cave/cave_entrance/actor_06861D.asm:74` | `#$0024` | Cave earthquake |
| `prinkys_mansion/mansion_east_hallway/actor_06DD4C.asm:31` | `#$001E` | Mansion shake |
| `unorganized/actor_09F12D.asm:20` | `#$0001` | Continuous jitter loop |

- **WRAM:** `$080E` (camera Y), `$28`, `$2C`, `$30`

## Relationship diagram

```
  ┌───────────────────────────────────────────────────────┐
  │                Camera / Screen System                 │
  │                                                       │
  │  [6A] screen_shake ──► $0892-$0898 (bounds)           │
  │       $0890 (frame counter)                           │
  │       sets flag #$8322                                │
  │                    │                                  │
  │                    ▼                                  │
  │  [6B] camera_scroll_await ──► waits for flag          │
  │       same 4-bound interpolation                      │
  │       clears flag #$0322                              │
  │                                                       │
  │  [68] camera_scroll ──► spawn child actor             │
  │       $080A/$080E → $7F1030/$7F1032 (save)            │
  │       $0034/$0036 (target) via code_00E510            │
  │       code_04BC6C (scroll anim)                       │
  │                                                       │
  │  [69] camera_return ──► $7F1030/$7F1032 → target      │
  │       yields until child $0022 ≠ 0                    │
  │                                                       │
  │  [6C] spawn_screen_effect ──► spawn child actor       │
  │       code_04BB8D (color math / windowing)            │
  │       sets flag #$0323; parent clears to terminate    │
  │                                                       │
  │  [6D] camera_y_shake ──► $080E += lookup[$30 & 3]     │
  │       self-loops $30 times (vertical jitter)          │
  │       most-used camera op (45 sites)                  │
  └───────────────────────────────────────────────────────┘
```
