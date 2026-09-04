# Actor Spawn — Render Chain (`[A9]`–`[B1]`)

Nine opcodes that allocate a new actor and link it into the **render execution chain** (`$0EF6` / `$24`–`$26`). The spawned actor receives a far code pointer as its script entry point and optionally receives position offsets, flag configuration, and/or an actor-local counter value.

This family is the **render-chain mirror** of the [main-chain actor spawn](actor_spawn.md) family (`[A2]`–`[A8]`). Both use the same slot allocator (`code_0481EE`) and field initializer (`code_00E587`), but link into different chains.

## Overview

All nine ops share the same core sequence:
1. Allocate a free actor slot via `code_0481EE` (pool at `$56`)
2. Link the new actor into the render chain
3. Initialize via `code_00E587` (copy parent fields `$00`–`$0C`, reset actor state)
4. Read a far code pointer from the script → store in `$28`/`$2A` (child's entry point)
5. Optionally read position, flags, and/or counter words
6. Store parent reference → `$7F0022,X`
7. Continue parent script (`RTI`)

### Chain insertion methods

| Method | Ops | Helper | Chain global | Links |
|--------|-----|--------|-------------|-------|
| **Head insert** | `[A9]` | direct `code_0481EE` | `$0EF6` | new→head; `$24` = old head, `$26` = 0 |
| **Child insert** | `[AA]`–`[B1]` | `code_00E55E` | `$0EF6` (tail) | new→child of parent; `$24`/`$26` doubly-linked |

Note: The render chain uses `$24`/`$26` with **reversed roles** compared to the main chain. In `code_00E55E`, `$24` stores the parent (back-link) and `$26` is the forward link; in `code_00E535` (main chain) it's the opposite.

### Combinatorial dimensions

The nine ops form a matrix across three optional features:

| Op | Chain | Position | Extra | Operands | Uses |
|----|-------|----------|-------|----------|-----:|
| `[A9]` | head | — | flags (`$06`) | `@Code, Word` | 14 |
| `[AA]` | child | — | — | `@Code` | 206 |
| `[AB]` | child | — | counter (`$22`) | `@Code, Word` | 43 |
| `[AC]` | child | — | flags (`$06`) | `@Code, Word` | 138 |
| `[AD]` | child | facing-relative | — | `@Code, Word, Word` | 247 |
| `[AE]` | child | facing-relative | flags (`$06`) | `@Code, Word, Word, Word` | 110 |
| `[AF]` | child | absolute | — | `@Code, Word, Word` | 24 |
| `[B0]` | child | absolute | flags (`$06`) | `@Code, Word, Word, Word` | 4 |
| `[B1]` | child | facing-relative | counter (`$22`) | `@Code, Word, Word, Word` | 33 |

All nine ops are used in practice. Compared to the main-chain family, this family adds the **counter (`$22`)** dimension (`[AB]`, `[B1]`) and has no unused combinations among the implemented set.

---

## `[A9]` — `spawn_render_head`

Allocates a new actor and inserts it at the **head** of the render execution chain (`$0EF6`). The child receives a far code pointer and a flags word.

### Handler: `code_00C503`

```
code_00C503:
  TYX : PHX : PHD
  JSL code_0481EE          ; Allocate free slot → Y
  LDX $0EF6               ; X = current render chain head
  TYA : TCD                ; DP = new actor
  STX $24                  ; new.$24 = old head (back-link)
  STA $0026, X             ; old_head.$26 = new actor (forward-link)
  STZ $26                  ; new.$26 = 0 (no predecessor)
  STA $0EF6                ; $0EF6 = new actor (becomes head)
  LDA $03, S : TAX         ; X = parent slot
  JSR code_00E587          ; Init: copy parent → new, reset fields
  PLD : TYX                ; X = new actor
  ; Read operands:
  LDA [$2C] : INC $2C×2    ; @Code lo → $28
  STA $0028, X
  LDA [$2C] : INC $2C      ; @Code bank → $2A
  AND #$00FF : STA $002A, X
  LDA [$2C] : INC $2C×2    ; Word → $06 (raw, no forced bits)
  STA $0006, X
  LDA $01, S               ; parent slot
  STA $7F0022, X
  TXY : PLX
  LDA $2C : STA $02, S
  RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `@Code` (3 bytes) | `$28`/`$2A` | Far code pointer — child's script entry |
| 2 | `Word` (2 bytes) | `$06` | Actor flags (stored raw — no forced `#$2000` OR) |

### Flag word values observed

| Value | Sites | Context |
|-------|------:|---------|
| `#$2800` | 6 | Player host system: screen dim/fade, enter/exit processes |
| `#$2001` | 4 | Battle system: combat helper processes (`code_03BC0A`, `code_03B7BA`, `code_04C753`, `code_04C61A`) |
| `#$2000` | 2 | Player host: interrupt handler processes |
| `#$0000` | 2 | Reward/item acquisition: item get fanfare processes |

Unlike `[A2]` (main chain head), `[A9]` does **not** force `$06 |= #$2000`. However, `code_00E587` already sets `$06 |= #$2000` during initialization, so the flag word effectively replaces (not augments) the init value.

### Usage (14 sites)

Primary use cases:
- **Player host actor** (`actor_0BD8F4` / `chunk_0B8000`): spawns render-priority processes for screen transitions (enter house, exit area), interrupt handler setup, and visual effects. 8 of 14 sites.
- **Battle system** (`chunk_038000` / `chunk_008000`): spawns combat helper processes with `#$2001` flags (bit `#$0001` may signal battle-mode). 4 sites.
- **Reward system** (`chunk_0B8000`): spawns item acquisition display processes. 2 sites.

### Source examples

```
; Player host: screen dim effect on enter
COP [A9] ( @code_0BDC80, #$2800 )

; Battle: spawn combat helper
COP [A9] ( @code_03BC0A, #$2001 )

; Item get fanfare process
COP [A9] ( @code_0BE7E3, #$0000 )
```

---

## `[AA]` — `spawn_render_child`

The simplest render-chain child spawn — only a far code pointer. This is the **most-used spawn opcode** in the game and the workhorse for creating child actors.

### Handler: `code_00C54A`

```
code_00C54A:
  TYX : PHX
  JSR code_00E55E           ; Allocate + link as render child
  TYX                       ; X = new actor
  LDA [$2C] : INC $2C×2    ; @Code lo → $28
  STA $0028, X
  LDA [$2C] : INC $2C      ; @Code bank → $2A
  AND #$00FF : STA $002A, X
  LDA $01, S
  STA $7F0022, X
  TXY : PLX
  LDA $2C : STA $02, S
  RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `@Code` (3 bytes) | `$28`/`$2A` | Far code pointer — child's script entry |

### Usage (206 sites)

Ubiquitous across all actor types — cutscene directors, the player host, system controllers, NPC setup, menu managers. Used whenever a child actor needs to be spawned with inherited position/state and no extra configuration.

---

## `[AB]` — `spawn_render_child_counter`

Child spawn with a word written to the actor-local counter `$22`. This allows the parent to pass a mode/subtype value to the child.

### Handler: `code_00C570`

```
code_00C570:
  TYX : PHX
  JSR code_00E55E           ; Allocate + link as render child
  TYX
  LDA [$2C] : INC $2C×2 : STA $0028, X   ; @Code lo
  LDA [$2C] : INC $2C : AND #$00FF : STA $002A, X  ; @Code bank
  LDA [$2C] : INC $2C×2 : STA $0022, X   ; Word → $22 (counter)
  LDA $01, S : STA $7F0022, X
  TXY : PLX : LDA $2C : STA $02, S : RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `@Code` (3 bytes) | `$28`/`$2A` | Far code pointer |
| 2 | `Word` (2 bytes) | `$22` | Actor-local counter / mode selector |

### Usage (43 sites)

The `$22` value typically selects a sub-behavior in the spawned child (read via `LDA $22` or `COP [26]` switch). Used for spawning actors that need a variant/mode parameter.

---

## `[AC]` — `spawn_render_child_flags`

Child spawn with a flags word written to `$06`. Allows the parent to configure the child's actor flags beyond the defaults set by `code_00E587`.

### Handler: `code_00C59F`

```
code_00C59F:
  TYX : PHX
  JSR code_00E55E
  TYX
  LDA [$2C] : INC $2C×2 : STA $0028, X   ; @Code lo
  LDA [$2C] : INC $2C : AND #$00FF : STA $002A, X  ; @Code bank
  LDA [$2C] : INC $2C×2 : STA $0006, X   ; Word → $06 (flags)
  LDA $01, S : STA $7F0022, X
  TXY : PLX : LDA $2C : STA $02, S : RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `@Code` (3 bytes) | `$28`/`$2A` | Far code pointer |
| 2 | `Word` (2 bytes) | `$06` | Actor flags (raw) |

### Usage (138 sites)

Second-most-used variant after `[AA]`. The flags word typically includes `#$2000` (spawned), `#$0800` (render mode), and scene-specific bits.

---

## `[AD]` — `spawn_render_child_offset`

Child spawn with **facing-relative position adjustment**. The X offset is negated when the parent faces left (`$0A bit #$4000`), allowing directional spawning.

### Handler: `code_00C5CE`

```
code_00C5CE:
  TYX : PHX
  JSR code_00E55E
  TYX
  LDA [$2C] : INC $2C×2 : STA $0028, X  ; @Code lo
  LDA [$2C] : INC $2C : AND #$00FF : STA $002A, X  ; bank
  LDA $000A, X : ASL : ASL              ; bit 14 (#$4000) → carry
  LDA [$2C] : INC $2C×2                 ; Word (X offset)
  BCC +                                 ; if facing right, use as-is
  EOR #$FFFF : INC                      ; negate for left-facing
+ CLC : ADC $0000, X : STA $0000, X    ; apply X offset
  LDA [$2C] : INC $2C×2                 ; Word (Y offset)
  CLC : ADC $0002, X : STA $0002, X    ; apply Y offset
  LDA $01, S : STA $7F0022, X
  TXY : PLX : LDA $2C : STA $02, S : RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `@Code` (3 bytes) | `$28`/`$2A` | Far code pointer |
| 2 | `Word` (2 bytes) | `$00` adj | X position offset (negated when facing left) |
| 3 | `Word` (2 bytes) | `$02` adj | Y position offset (always added) |

### Usage (247 sites)

The **most-used variant** in this family (and the most-used actor spawn opcode overall). Heavy use in cutscene directors for spawning positioned NPC/prop actors. The facing-relative offset is the primary mechanism for placing actors relative to the parent's orientation.

---

## `[AE]` — `spawn_render_child_offset_flags`

Combines facing-relative position (`[AD]`) with a flags word (`[AC]`).

### Handler: `code_00C619`

Reads: `@Code, Word (facing X), Word (Y), Word (→ $06)`.

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `@Code` (3 bytes) | `$28`/`$2A` | Far code pointer |
| 2 | `Word` (2 bytes) | `$00` adj | X offset (facing-relative) |
| 3 | `Word` (2 bytes) | `$02` adj | Y offset |
| 4 | `Word` (2 bytes) | `$06` | Actor flags |

### Usage (110 sites)

Third-most-used variant. Used when the spawned actor needs both a positioned start and specific flag configuration.

---

## `[AF]` — `spawn_render_child_xy`

Child spawn with **absolute position override**. The X and Y words are written directly to `$00`/`$02`, replacing the inherited parent position.

### Handler: `code_00C66D`

```
code_00C66D:
  TYX : PHX
  JSR code_00E55E
  TYX
  LDA [$2C] : INC $2C×2 : STA $0028, X  ; @Code lo
  LDA [$2C] : INC $2C : AND #$00FF : STA $002A, X  ; bank
  LDA [$2C] : INC $2C×2 : STA $0000, X  ; Word → $00 (abs X)
  LDA [$2C] : INC $2C×2 : STA $0002, X  ; Word → $02 (abs Y)
  LDA $01, S : STA $7F0022, X
  TXY : PLX : LDA $2C : STA $02, S : RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `@Code` (3 bytes) | `$28`/`$2A` | Far code pointer |
| 2 | `Word` (2 bytes) | `$00` | Absolute X position |
| 3 | `Word` (2 bytes) | `$02` | Absolute Y position |

### Usage (24 sites)

Used when the child actor needs a fixed world position independent of the parent. Typical in scene setup where actors must appear at exact tile coordinates.

---

## `[B0]` — `spawn_render_child_xy_flags`

Combines absolute position (`[AF]`) with a flags word.

### Handler: `code_00C6A5`

Reads: `@Code, Word (→ $00), Word (→ $02), Word (→ $06)`.

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `@Code` (3 bytes) | `$28`/`$2A` | Far code pointer |
| 2 | `Word` (2 bytes) | `$00` | Absolute X position |
| 3 | `Word` (2 bytes) | `$02` | Absolute Y position |
| 4 | `Word` (2 bytes) | `$06` | Actor flags |

### Usage (4 sites)

Least-used variant. All 4 sites are in system-level code for spawning actors at fixed positions with specific flag configurations.

---

## `[B1]` — `spawn_render_child_offset_counter`

Combines facing-relative position (`[AD]`) with an actor-local counter word (`[AB]`). Unique to the render-chain family — no main-chain equivalent exists.

### Handler: `code_00C6E6`

```
code_00C6E6:
  TYX : PHX
  JSR code_00E55E
  TYX
  LDA [$2C] : INC $2C×2 : STA $0028, X  ; @Code lo
  LDA [$2C] : INC $2C : AND #$00FF : STA $002A, X  ; bank
  LDA $000A, X : ASL : ASL              ; facing check
  LDA [$2C] : INC $2C×2                 ; Word (X offset)
  BCC + : EOR #$FFFF : INC              ; negate if facing left
+ CLC : ADC $0000, X : STA $0000, X
  LDA [$2C] : INC $2C×2                 ; Word (Y offset)
  CLC : ADC $0002, X : STA $0002, X
  LDA [$2C] : INC $2C×2                 ; Word → $22 (counter)
  STA $0022, X
  LDA $01, S : STA $7F0022, X
  TXY : PLX : LDA $2C : STA $02, S : RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `@Code` (3 bytes) | `$28`/`$2A` | Far code pointer |
| 2 | `Word` (2 bytes) | `$00` adj | X offset (facing-relative) |
| 3 | `Word` (2 bytes) | `$02` adj | Y offset |
| 4 | `Word` (2 bytes) | `$22` | Actor-local counter / mode |

### Usage (33 sites)

Used for spawning positioned actors that also need a mode/variant parameter, e.g. NPC spawn directors where facing offset determines screen placement and `$22` selects behavior.

---

## Helper functions

### `code_0481EE` — Actor slot allocator

Shared with the [main-chain family](actor_spawn.md). Reads the next free slot from a sequential pool at pointer `$56`. Returns C=0 (success, Y=slot) or C=1 (failure, Y=`#$1FC0`).

### `code_00E55E` — Child actor linkage (render chain)

Allocates via `code_0481EE`, then links the new actor into the parent's render chain via `$24`/`$26`:
- `new.$24` = parent slot (back-link)
- `new.$26` = parent's previous `$26` child (next sibling)
- `parent.$26` = new actor (parent's render child head)
- If the previous sibling was null, updates `$0EF6` (global render chain endpoint)

Then calls `code_00E587` to initialize fields.

Compared to `code_00E535` (main chain), E55E links via `$26` (forward) and `$24` (back), whereas E535 uses `$24` (forward) and `$26` (back). The chain globals are also swapped: E535 → `$0EF4`, E55E → `$0EF6`.

### `code_00E587` — New actor field initialization

Shared with the main-chain family. Copies parent's `$00`–`$0C`, sets `$06 |= #$2000`, clears render flags, zeros 16+ actor RAM fields.

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `A9` | `spawn_render_head` | 14 |
| `AA` | `spawn_render_child` | 206 |
| `AB` | `spawn_render_child_counter` | 43 |
| `AC` | `spawn_render_child_flags` | 138 |
| `AD` | `spawn_render_child_offset` | 247 |
| `AE` | `spawn_render_child_offset_flags` | 110 |
| `AF` | `spawn_render_child_xy` | 24 |
| `B0` | `spawn_render_child_xy_flags` | 4 |
| `B1` | `spawn_render_child_offset_counter` | 33 |
| | **Total** | **819** |

## Family notes

1. **Largest spawn family**: 819 total call sites — far exceeding the main-chain family (27 sites). The render chain is the primary mechanism for creating new actors in Robotrek.

2. **All variants used**: Unlike the main-chain family where 4 of 7 ops have zero uses, all 9 render-chain ops see real usage. `[AD]` (247 sites) and `[AA]` (206 sites) dominate.

3. **Counter dimension**: The `$22` actor-local counter (`[AB]`, `[B1]`) has no equivalent in the main-chain family. `$22` is the same field used by `COP [26]` (switch_counter), providing an immediate subtype/mode to spawned actors.

4. **No forced flags**: Unlike `[A2]` (main chain head) which forces `$06 |= #$2000`, `[A9]` stores the flags word raw. Since `code_00E587` already sets this bit during initialization, `[A9]` can actually override it by providing `#$0000` (2 sites do this).

5. **Missing combinations**: Not every 3D matrix cell exists:
   - No head-insert + counter or head-insert + position variants
   - No absolute position + counter variant
   - These gaps suggest the head-insert path was designed for a single use case (priority processes) while the child-insert path needed maximal flexibility.

6. **Chain direction**: The render chain (`$0EF6`/E55E) and main chain (`$0EF4`/E535) use the same `$24`/`$26` fields but with reversed link directions. An actor can belong to both chains simultaneously since the semantics are per-chain.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Actor Spawn — Main Chain](actor_spawn.md) `[A2]`–`[A8]` | Mirror family using `$0EF4` main chain instead of `$0EF6` render chain |
| [Render Configuration](render_config.md) `[93]`–`[94]` | Also use `code_00E55E` to spawn render child actors for spritemap rendering |
| [Child Sprite Spawn](child_sprite.md) `[8D]`–`[90]` | Different child spawn system (uses `code_04FDDD`, not `code_0481EE`) |
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | Often follows spawn ops to configure the child's animation |
