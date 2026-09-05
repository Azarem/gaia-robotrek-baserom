# Render Configuration — COP `[91]`–`[96]`, `[9D]`–`[A1]`

> Deep-audited ops: `[91]` `[92]` `[93]` `[94]` `[95]` `[96]` `[9D]` `[9E]` `[9F]` `[A0]` `[A1]`

## Overview

Eleven opcodes that configure and drive an actor's **rendering mode** — spritemap source, bitmap overlay, render flags, and their associated wait/tick companions. They set the actor's visual presentation at a lower level than the `[80]`–`[8C]` animation family: rather than just choosing an animation id, these ops assign the spritemap bank, VRAM destination, and optionally spawn a dedicated child rendering actor. The wait ops then tick the rendering forward and yield when complete.

### Sub-groups

| Sub-group | Ops | Purpose |
|-----------|-----|---------|
| **Spritemap render setup** | `[91]` `[92]` `[93]` `[94]` | Set anim id + spritemap bank pointer + render flags |
| **Bitmap overlay setup** | `[95]` `[96]` | Set anim id + raw bitmap overlay pointer |
| **OAM block copy** | `[9D]` | Copy sprite table data between WRAM regions |
| **Spritemap render wait** | `[9E]` `[9F]` | Tick spritemap rendering via `code_08E59D` |
| **Bitmap render wait** | `[A0]` `[A1]` | Tick bitmap rendering via `code_08E69B` |

### Combinatorial pattern

Within each sub-group, a speed byte (`$12`) and child spawn are optional:

| Op | Role | Speed | Child spawn | Companion | Uses |
|----|------|:-----:|:-----------:|-----------|-----:|
| `[91]` | setup | — | — | `[9E]` | 55 |
| `[92]` | setup | yes | — | `[9F]` | 7 |
| `[93]` | setup | — | yes | `[9E]` | 20 |
| `[94]` | setup | yes | yes | `[9F]` | 12 |
| `[95]` | setup | — | — | `[A0]` | 5 |
| `[96]` | setup | yes | — | `[A1]` | 0 |
| `[9D]` | utility | — | — | — | 6 |
| `[9E]` | wait | — | — | — | 75 |
| `[9F]` | wait | yes | — | — | 19 |
| `[A0]` | wait | — | — | — | 5 |
| `[A1]` | wait | yes | — | — | 0 |

## Spritemap render ops (`[91]`–`[94]`)

### Shared action

All four write the same actor fields:

| Field | Value | Purpose |
|-------|-------|---------|
| `$7F000C,X` | Byte operand | Animation id |
| `$10` | 0 | Clear frame timer |
| `$7F0000,X` | Address lo word | Spritemap bank pointer (lo) |
| `$7F0002,X` | Address bank byte | Spritemap bank pointer (hi) |
| `$1C` | 0 | Clear X velocity |
| `$1E` | 0 | Clear Y velocity |
| `$08` | `\| #$4000` | Enable spritemap render mode |
| `$06` | `& ~#$2000` | Clear interaction-busy flag |
| `$28` | `$2C` | Save script pointer |

The Address operand is a 24-bit pointer to a spritemap bank (e.g., `@spritemap_138000`, `@spritemap_14C000`). This tells the engine which sprite tile set to use for this actor.

---

#### COP [91] — `set_sprmap_render` (anim id + spritemap bank)

- **Confidence:** high
- **Preferred name:** `set_sprmap_render`
- **Handler:** `code_00C138` @ chunk_008000.asm:9223–9249
- **Parameters:** `Byte` (anim_id), `Address` (spritemap_bank)
- **Usage count:** 55

The base spritemap render op. Sets the actor's animation and spritemap source, enables render mode flag `$08 |= #$4000`, and clears interaction flag `$06 &= ~#$2000`. Always followed by `COP [9E]` (render wait).

Used across battle system and system actors for loading battle sprites, character sprites, and cutscene rendering configurations.

<details><summary>Handler</summary>

```asm
code_00C138 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $7F000C, X         ; anim id
    STZ $10                ; clear frame timer
    LDA [$2C]
    INC $2C
    INC $2C                ; read 3-byte address (lo word)
    STA $7F0000, X         ; spritemap bank lo
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $7F0002, X         ; spritemap bank hi (byte)
    STZ $1C                ; clear vel X
    STZ $1E                ; clear vel Y
    LDA #$4000
    TSB $08                ; enable spritemap render mode
    LDA #$2000
    TRB $06                ; clear interaction flag
    LDA $2C
    STA $28
    STA $02, S
    RTI
}
```

</details>

```asm
    COP [91] ( #03, @spritemap_138000 )   ; anim 3, use spritemap bank $138000
    COP [9E]                               ; render wait
```

---

#### COP [92] — `set_sprmap_render_spd` (speed + anim id + spritemap bank)

- **Confidence:** high
- **Preferred name:** `set_sprmap_render_spd`
- **Handler:** `code_00C12F` @ chunk_008000.asm:9218–9222 (falls through to `code_00C138`)
- **Parameters:** `Byte` (speed), `Byte` (anim_id), `Word` (spritemap_lo), `Byte` (spritemap_bank)
- **Usage count:** 7

Reads a speed byte into `$12`, then falls through to `[91]`'s handler. All 7 call sites are in battle actors using large spritemap banks (`$C000` / `$A000` / `$B000`).

<details><summary>Handler</summary>

```asm
code_00C12F {
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $12                ; read speed
}
; falls through to code_00C138 ([91] handler)
```

</details>

```asm
    COP [92] ( #02, #01, #$A000, #93 )   ; speed 2, anim 1, spritemap @$93:A000
    COP [9E]
```

---

#### COP [93] — `spawn_render_actor` (spawn child + anim id + spritemap bank)

- **Confidence:** high
- **Preferred name:** `spawn_render_actor`
- **Handler:** `code_00C179` @ chunk_008000.asm:9258–9295
- **Parameters:** `Byte` (child_mode), `Byte` (anim_id), `Address` (spritemap_bank)
- **Usage count:** 20

Spawns a **child rendering actor** via `code_00E55E` (full actor allocator), assigns it the `loc_04B7C3` rendering loop (which allocates child sprite slots and renders frames indefinitely), stores the child mode byte in the child's `$0022,X`, then configures the parent's animation and spritemap — same as `[91]`.

The child actor runs `loc_04B7C3` in `actor_04B763`, which:
1. Allocates a child sprite slot via `code_04FDDD`
2. Loads spritemap from `unk36_list_10D000`
3. Calls `code_08E757` + `code_08E805` (render)
4. Loops via `COP [CC]` / `COP [9C]` until parent dismisses

The first byte (child_mode) is stored in child's `$22` — selects which animation variant the child rendering loop uses.

Used in battle for spawning persistent visual effects that need their own rendering actor alongside the parent.

<details><summary>Handler</summary>

```asm
code_00C179 {
    PHY
    LDX $0EF6                  ; head of actor free chain
    JSR $&code_00E55E          ; allocate child actor
    TYX
    LDA #$&loc_04B7C3
    STA $0028, X               ; child script entry = render loop
    LDA #$*loc_04B7C3
    STA $002A, X               ; child script bank
    LDA $01, S
    STA $7F0022, X             ; link child to parent
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $0022, X               ; child mode/index byte
    PLX                        ; restore parent X
    ; ... then identical to [91]: read anim, address, set render flags ...
    RTI
}
```

</details>

```asm
    COP [93] ( #17, #01, @spritemap_13B000 )   ; child mode 17, anim 1, spritemap
    COP [9E]                                     ; render wait
    COP [B2]                                     ; (cleanup)
```

---

#### COP [94] — `spawn_render_actor_spd` (speed + spawn child + anim + spritemap)

- **Confidence:** high
- **Preferred name:** `spawn_render_actor_spd`
- **Handler:** `code_00C170` @ chunk_008000.asm:9251–9256 (falls through to `code_00C179`)
- **Parameters:** `Byte` (speed), `Byte` (child_mode), `Byte` (anim_id), `Address` (spritemap_bank)
- **Usage count:** 12

Reads a speed byte into `$12`, then falls through to `[93]`'s handler. All 12 call sites are in `chunk_038000.asm` (battle system).

```asm
    COP [94] ( #08, #1B, #00, @spritemap_13F000 )   ; speed 8, child 27, anim 0
    COP [9E]
```

## Bitmap overlay ops (`[95]`–`[96]`)

### Shared action

| Field | Value | Purpose |
|-------|-------|---------|
| `$7F000C,X` | Byte 1 | Animation id |
| `$10` | 0 | Clear frame timer |
| `$7F002E,X` | `word_04B879[byte2] + rawbitmap_128FAE` | Bitmap data pointer (lo) |
| `$7F0030,X` | `#$*rawbitmap_128FAE` | Bitmap data bank byte |
| `$7F0000,X` | `#$4800` | VRAM destination address |
| `$7F0002,X` | `#$007E` | VRAM destination bank |
| `$1C` | 0 | Clear X velocity |
| `$1E` | 0 | Clear Y velocity |
| `$28` | `$2C` | Save script pointer |

Byte 2 is an index into `word_04B879` — a lookup table of offsets into `rawbitmap_128FAE`. The resulting pointer addresses a raw bitmap image that will be DMA'd to VRAM at `$7E:4800`.

---

#### COP [95] — `set_bitmap_overlay` (anim id + bitmap index)

- **Confidence:** high
- **Preferred name:** `set_bitmap_overlay`
- **Handler:** `code_00C1DA` @ chunk_008000.asm:9303–9334
- **Parameters:** `Byte` (anim_id), `Byte` (bitmap_index)
- **Usage count:** 5

Sets up a raw bitmap overlay for screen effects. The bitmap index selects from a table of pre-computed image offsets. Always followed by `COP [A0]` (bitmap render wait).

Used for screen-transition effects: the SFX `#22` is played, then two bitmap frames are displayed in sequence (indices 0→2 or similar), separated by metatile writes.

<details><summary>Handler</summary>

```asm
code_00C1DA {
    TYX
    PHX
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $7F000C, X         ; anim id
    STZ $10
    LDA [$2C]
    INC $2C
    AND #$00FF
    ASL
    TAX
    LDA $@word_04B879, X   ; bitmap offset table lookup
    CLC
    ADC #$&rawbitmap_128FAE ; add base address
    PLX
    STA $7F002E, X         ; bitmap pointer lo
    LDA #$*rawbitmap_128FAE
    STA $7F0030, X         ; bitmap pointer bank
    LDA #$4800
    STA $7F0000, X         ; VRAM dest address
    LDA #$007E
    STA $7F0002, X         ; VRAM dest bank
    STZ $1C
    STZ $1E
    LDA $2C
    STA $28
    STA $02, S
    RTI
}
```

</details>

```asm
    COP [41] ( #22 )       ; play SFX 22
    COP [95] ( #00, #01 )  ; anim 0, bitmap index 1
    COP [A0]               ; bitmap render wait
    COP [4D] ( ... )       ; metatile write
    COP [95] ( #02, #01 )  ; anim 2, bitmap index 1
    COP [A0]               ; bitmap render wait
```

---

#### COP [96] — `set_bitmap_overlay_spd` (speed + anim id + bitmap index)

- **Confidence:** high
- **Preferred name:** `set_bitmap_overlay_spd`
- **Handler:** `code_00C1D1` @ chunk_008000.asm:9297–9302 (falls through to `code_00C1DA`)
- **Parameters:** `Byte` (speed), `Byte` (anim_id), `Byte` (bitmap_index)
- **Usage count:** 0

Reads a speed byte into `$12`, then falls through to `[95]`'s handler. **Unused** — no call sites in the extracted ROM.

## OAM block copy (`[9D]`)

#### COP [9D] — `copy_oam_block` (sprite table transfer)

- **Confidence:** high
- **Preferred name:** `copy_oam_block`
- **Handler:** `code_00C2B1` @ chunk_008000.asm:9455–9489
- **Parameters:** `Byte` (slot_index)
- **Usage count:** 6

Copies 32 bytes of sprite/OAM table data between two WRAM regions. The byte operand selects a 16-byte-aligned slot:

1. If byte = 0: uses `$04 | #$0010` (actor instance id with bit 4 forced) as the index
2. If byte ≠ 0: uses `byte & #$FFFE` (clear bit 0)
3. Index is shifted left 4 (`<<4`)
4. **Source:** `$7F:0A00 + (index<<4)` — secondary sprite attribute table
5. **Destination:** `$7E:3800 + (index<<4)` — primary OAM/sprite attribute table
6. **Size:** 32 bytes (`MVN #$7E, #$7F`, count = `#$001F`)

This transfers pre-computed sprite attribute data from a staging buffer to the active OAM table. Used in the battle system to refresh sprite visuals after animation state changes.

<details><summary>Handler</summary>

```asm
code_00C2B1 {
    TYX
    PHB
    PHX
    LDA [$2C]
    INC $2C
    AND #$00FF
    BEQ loc_00C2C2           ; byte=0 → use $04
    AND #$FFFE               ; clear bit 0
    BRA loc_00C2C7

  loc_00C2C2:
    LDA $04                  ; use actor instance id
    ORA #$0010               ; force bit 4

  loc_00C2C7:
    ASL
    ASL
    ASL
    ASL                      ; <<4 → 16-byte slot offset
    PHA
    CLC
    ADC #$0A00               ; source = $7F:0A00+offset
    TAX
    PLA
    CLC
    ADC #$3800               ; dest = $7E:3800+offset
    TAY
    LDA #$001F               ; 32 bytes
    MVN #$7E, #$7F           ; block move
    PLX
    PLB
    LDA $2C
    STA $02, S
    RTI
}
```

</details>

All 6 call sites use byte `#00` and are in the battle system (`chunk_038000.asm` and `chunk_0B8000.asm`). Typical usage:

```asm
    COP [8E] ( #00, #02, #01 )   ; spawn child sprite
    COP [CB]                       ; (render tick)
    COP [9C]                       ; wait for child
    COP [9D] ( #00 )              ; copy OAM data from staging
    COP [B2]                       ; cleanup
```

## Spritemap render wait ops (`[9E]`–`[9F]`)

### Shared mechanism

Both call `code_08E665` (DMA setup — queues a VRAM transfer of sprite data to `$7E:4800`) first, then tick `code_08E59D` (spritemap render frame advance) which:
- Navigates the spritemap bank data (same as `code_04FC71` but with OAM position updates)
- Updates actor position `$00`/`$02` based on frame displacement
- Reads sprite attribute data (`$14`/`$16`/`$18`/`$1A`)
- Returns C=0 (still animating) or C=1 (animation done)

On completion, both ops:
- Clear velocities (`$1C`/`$1E = 0`)
- Set `$06 |= #$2000` (interaction flag — **re-enables** interaction after render)
- Clear `$08 &= ~#$4000` (clears spritemap render mode flag set by `[91]`–`[94]`)

This reverses the flag changes made by the setup ops: `[91]`–`[94]` set `$08 |= #$4000` and clear `$06 &= ~#$2000`; the wait ops restore these flags when rendering completes.

### Helper: `code_08E665` — DMA setup

Located at `chunk_08D15C.asm:2062`. Queues a VRAM DMA entry:

| Field | Value | Meaning |
|-------|-------|---------|
| VRAM dest | `#$4800` | Sprite tile data area |
| Bank | `#$007E` | WRAM bank |
| Transfer size | `#$3000` | 12 KB |
| Mode | `#$0500` | DMA transfer mode |

Guarded by `$0EE2 bit #$0002` — only queues once per frame.

### Helper: `code_08E59D` — spritemap render tick

Located at `chunk_08D15C.asm:1944`. The "rendering" counterpart of `code_04FC71`:
- Same frame navigation: `$7F000C,X` → `$7F0000,X`/`$7F0002,X` → frame table → frame data
- Also updates actor position `$00`/`$02` with displacement offsets (facing-aware via `$0A`)
- Reads visual attributes into `$14`/`$16`/`$18`/`$1A`
- Increments `$10`, returns C=0 (in progress) or C=1 (done, resets `$10`)

---

#### COP [9E] — `sprmap_render_wait` (render one frame)

- **Confidence:** high
- **Preferred name:** `sprmap_render_wait`
- **Handler:** `code_00C2E4` @ chunk_008000.asm:9492–9510
- **Parameters:** (none)
- **Usage count:** 75

The primary render-wait companion to `[91]`–`[94]`. Queues DMA, renders one frame, then either continues (RTI) or yields (PLA PLA RTL). Every spritemap setup call site is followed by `[9E]` (base speed) or `[9F]` (multi-frame).

<details><summary>Handler</summary>

```asm
code_00C2E4 {
    TYX
    JSL $@code_08E665       ; queue DMA setup
    JSL $@code_08E59D       ; render spritemap frame
    BCC loc_00C302           ; C=0 = done → yield
    STZ $1C
    STZ $1E
    LDA #$2000
    TSB $06                  ; re-enable interaction
    LDA #$4000
    TRB $08                  ; clear spritemap render mode
    LDA $2C
    STA $02, S
    RTI                      ; continue (re-tick)

  loc_00C302:
    PLA
    PLA
    RTL                      ; yield — rendering complete
}
```

</details>

**Typical pattern:**

```asm
    COP [91] ( #01, @spritemap_13E000 )   ; set spritemap render
    COP [9E]                               ; render wait (one frame)
    COP [B2]                               ; cleanup
```

---

#### COP [9F] — `sprmap_render_wait_multi` (render N frames)

- **Confidence:** high
- **Preferred name:** `sprmap_render_wait_multi`
- **Handler:** `code_00C305` @ chunk_008000.asm:9513–9534
- **Parameters:** (none) — consumes `$12` set by `[92]`/`[94]`
- **Usage count:** 19

Calls `code_08E665` once, then loops `code_08E59D` decrementing `$12` each frame — same multi-frame pattern as `[98]` but with spritemap rendering. Always follows a speed-variant setup op (`[92]` or `[94]`).

<details><summary>Handler</summary>

```asm
code_00C305 {
    TYX
    JSL $@code_08E665       ; queue DMA setup (once)

  loc_00C30A:
    JSL $@code_08E59D       ; render frame
    BCC loc_00C327           ; done → yield
    DEC $12                  ; decrement frame counter
    BNE loc_00C30A           ; loop if frames remain
    STZ $1C
    STZ $1E
    LDA #$2000
    TSB $06                  ; re-enable interaction
    LDA #$4000
    TRB $08                  ; clear spritemap render mode
    LDA $2C
    STA $02, S
    RTI                      ; budget exhausted → continue

  loc_00C327:
    PLA
    PLA
    RTL                      ; yield — rendering complete
}
```

</details>

**Typical pattern:**

```asm
    COP [92] ( #10, #03, #$C000, #94 )   ; speed 16, anim 3, spritemap $94:C000
    COP [9F]                               ; render N frames
    COP [B2]                               ; cleanup
```

## Bitmap render wait ops (`[A0]`–`[A1]`)

### Helper: `code_08E69B` — bitmap render tick

Located at `chunk_08D15C.asm:2088`. Similar to `code_08E59D` but for bitmap overlays:
- Reads bitmap source from `$7F002E,X`/`$7F0030,X` (set by `[95]`/`[96]`)
- Queues a DMA transfer entry with the bitmap data address
- Returns C=0 (in progress) or C=1 (done, resets `$10`)

---

#### COP [A0] — `bitmap_render_wait` (render one frame)

- **Confidence:** high
- **Preferred name:** `bitmap_render_wait`
- **Handler:** `code_00C32A` @ chunk_008000.asm:9538–9549
- **Parameters:** (none)
- **Usage count:** 5

The bitmap render-wait companion to `[95]`. Calls `code_08E69B` per tick; continues while rendering, yields when done. All 5 call sites follow `COP [95]`.

<details><summary>Handler</summary>

```asm
code_00C32A {
    TYX
    JSL $@code_08E69B       ; bitmap render tick
    BCC loc_00C336           ; done → yield
    LDA $2C
    STA $02, S
    RTI                      ; continue (re-tick)

  loc_00C336:
    PLA
    PLA
    RTL                      ; yield
}
```

</details>

**Typical pattern:**

```asm
    COP [95] ( #00, #01 )   ; set bitmap overlay
    COP [A0]                  ; bitmap render wait
```

---

#### COP [A1] — `bitmap_render_wait_multi` (render N frames)

- **Confidence:** high
- **Preferred name:** `bitmap_render_wait_multi`
- **Handler:** `code_00C339` @ chunk_008000.asm:9551–9566
- **Parameters:** (none) — would consume `$12` set by `[96]`
- **Usage count:** 0

The multi-frame bitmap render companion to `[96]`. Loops `code_08E69B` decrementing `$12`. **Unused** — 0 call sites, matching the unused `[96]` setup op.

<details><summary>Handler</summary>

```asm
code_00C339 {
    TYX

  loc_00C33A:
    JSL $@code_08E69B       ; bitmap render tick
    BCC loc_00C349           ; done → yield
    DEC $12
    BNE loc_00C33A           ; loop
    LDA $2C
    STA $02, S
    RTI                      ; budget exhausted

  loc_00C349:
    PLA
    PLA
    RTL
}
```

</details>

## Usage statistics

| Op | Name | Sites | Files |
|----|------|------:|------:|
| `[91]` | `set_sprmap_render` | 55 | 7 |
| `[92]` | `set_sprmap_render_spd` | 7 | 2 |
| `[93]` | `spawn_render_actor` | 20 | 2 |
| `[94]` | `spawn_render_actor_spd` | 12 | 1 |
| `[95]` | `set_bitmap_overlay` | 5 | 2 |
| `[96]` | `set_bitmap_overlay_spd` | 0 | 0 |
| `[9D]` | `copy_oam_block` | 6 | 2 |
| `[9E]` | `sprmap_render_wait` | 75 | 8 |
| `[9F]` | `sprmap_render_wait_multi` | 19 | 2 |
| `[A0]` | `bitmap_render_wait` | 5 | 2 |
| `[A1]` | `bitmap_render_wait_multi` | 0 | 0 |
| | **Total** | **204** | |

## Family notes

- **Speed fall-through pattern**: `[92]`/`[94]`/`[96]` each read `$12` and fall through to `[91]`/`[93]`/`[95]` respectively. The wait side mirrors this: `[9F]` loops `$12` times (speed variant of `[9E]`); `[A1]` loops `$12` times (speed variant of `[A0]`).
- **`$08 bit #$4000`**: The spritemap render mode flag. Set by `[91]`–`[94]`, cleared by `[9E]`/`[9F]` when rendering completes. The renderer checks this bit to decide whether to read from the spritemap bank pointer.
- **`$06 bit #$2000`**: Interaction flag. Cleared by `[91]`–`[94]` (disable interaction during render); re-set by `[9E]`/`[9F]` when rendering completes (re-enable interaction).
- **Flag symmetry**: Setup ops set `$08 |= #$4000` and clear `$06 &= ~#$2000`; wait ops reverse both flags. This guarantees the actor returns to normal state after rendering.
- **`[93]`/`[94]` child actor**: The spawned child runs `loc_04B7C3` in `actor_04B763` — a persistent rendering loop that manages child sprite allocation, rendering, and frame-by-frame polling.
- **`$0EF6`**: Head of the actor free chain. `[93]`/`[94]` read this to find where to allocate the child actor.
- **`$0EE2`**: DMA slot bitmask. `code_08E665` sets bit `#$0002` to prevent duplicate DMA queuing per frame.
- **Bitmap overlays** (`[95]`/`[96]`/`[A0]`/`[A1]`): A separate rendering path that DMA's raw bitmap data to `$7E:4800` (VRAM). The `word_04B879` table maps bitmap indices to offsets within `rawbitmap_128FAE`.
- **`[96]` and `[A1]` are both unused**: The speed variants of bitmap overlay setup and wait have 0 call sites.
- **`[9D]` OAM copy**: Stands alone as a utility — copies 32 bytes of sprite attribute data from a staging buffer (`$7F:0A00`) to the active OAM table (`$7E:3800`). All 6 sites use byte `#00` (index from `$04`).
- **Three rendering pipelines**: (1) Animation via `code_04FC71` ([97]/[98] wait); (2) Spritemap via `code_08E59D` ([9E]/[9F] wait); (3) Bitmap via `code_08E69B` ([A0]/[A1] wait). Pipeline 2 additionally moves the actor's position.

## Relationship to other families

```
[91]–[A1] render_config family (setup + utility + wait)
  ├── Setup:
  │   ├── [91]/[92] set_sprmap_render — spritemap bank + render flags
  │   ├── [93]/[94] spawn_render_actor — spawn child + spritemap render
  │   │     └── loc_04B7C3 (actor_04B763) — child rendering loop
  │   └── [95]/[96] set_bitmap_overlay — raw bitmap DMA to VRAM
  ├── Utility:
  │   └── [9D] copy_oam_block — MVN sprite table staging → active OAM
  ├── Wait:
  │   ├── [9E]/[9F] sprmap_render_wait — code_08E665 + code_08E59D
  │   └── [A0]/[A1] bitmap_render_wait — code_08E69B
  ├── [B2] (cleanup)              — often follows [9E]/[9F] in battle
  ├── [8B] set_anim_sprmap        — related: reload spritemap via code_08F322
  ├── [8D]–[90] child_sprite      — related: spawn child sprites (simpler mechanism)
  └── [97]–[9C] anim_wait         — related: wait for code_04FC71 (different pipeline)
```
