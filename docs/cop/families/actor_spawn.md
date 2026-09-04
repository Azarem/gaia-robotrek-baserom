# Actor Spawn — Main Chain (`[A2]`–`[A8]`)

Seven opcodes that allocate a new actor and link it into the **main execution chain** (`$0EF4` / `$24`–`$26`). The spawned actor receives a far code pointer as its script entry point and optionally receives position offsets and/or flag configuration.

## Overview

All seven ops share the same core sequence:
1. Allocate a free actor slot via `code_0481EE` (pool at `$56`)
2. Link the new actor into a chain
3. Initialize via `code_00E587` (copy parent fields `$00`–`$0C`, reset actor state)
4. Read a far code pointer from the script → store in `$28`/`$2A` (child's entry point)
5. Optionally read position/flag words
6. Store parent reference → `$7F0022,X`
7. Continue parent script (`RTI`)

### Chain insertion methods

Two linking strategies exist within this family:

| Method | Ops | Helper | Chain global | Links |
|--------|-----|--------|-------------|-------|
| **Head insert** | `[A2]` | direct `code_0481EE` | `$0EF4` | new→head of chain; `$26` = old head, `$24` = 0 |
| **Child insert** | `[A3]`–`[A8]` | `code_00E535` | `$0EF4` (tail) | new→child of parent; `$24`/`$26` doubly-linked |

`[A2]` inserts the new actor at the **head** of the `$0EF4` global chain, making it execute first. `[A3]`–`[A8]` use `code_00E535`, which inserts the new actor as a **child** of the calling actor via the `$0024`/`$0026` doubly-linked list.

### Combinatorial dimensions

The seven ops form a matrix across three optional features:

| Op | Chain | Position | Flags (`$06`) | Operands | Uses |
|----|-------|----------|---------------|----------|-----:|
| `[A2]` | head | — | Word \| `#$2000` | `@Code, Word` | 22 |
| `[A3]` | child | — | — | `@Code` | 2 |
| `[A4]` | child | — | Word (raw) | `@Code, Word` | 0 |
| `[A5]` | child | facing-relative | — | `@Code, Word, Word` | 3 |
| `[A6]` | child | facing-relative | Word (raw) | `@Code, Word, Word, Word` | 0 |
| `[A7]` | child | absolute | — | `@Code, Word, Word` | 0 |
| `[A8]` | child | absolute | Word (raw) | `@Code, Word, Word, Word` | 0 |

Only `[A2]`, `[A3]`, and `[A5]` are used in practice. `[A4]`, `[A6]`, `[A7]`, `[A8]` are valid handlers but have zero call sites and are absent from `copdef.json`.

---

## `[A2]` — `spawn_actor_head`

Allocates a new actor and inserts it at the **head** of the main execution chain. The child receives a far code pointer and a flags word.

### Handler: `code_00C34C`

```
code_00C34C:
  TYX : PHX : PHD
  JSL code_0481EE          ; Allocate free actor slot → Y
  LDX $0EF4               ; X = current chain head
  TYA : TCD                ; DP = new actor
  STX $26                  ; new.$26 = old head (back-link)
  STA $0024, X             ; old_head.$24 = new actor (forward-link)
  STZ $24                  ; new.$24 = 0 (no predecessor)
  STA $0EF4                ; $0EF4 = new actor (becomes head)
  LDA $03, S : TAX         ; X = parent slot (from stack)
  JSR code_00E587          ; Init: copy parent → new, reset fields
  PLD : TYX                ; X = new actor (Y set by E587)
  ; Read operands from parent script:
  LDA [$2C] : INC $2C×2    ; @Code lo → $28
  STA $0028, X
  LDA [$2C] : INC $2C      ; @Code bank → $2A
  AND #$00FF : STA $002A, X
  LDA [$2C] : INC $2C×2    ; Word → $06 | #$2000
  ORA #$2000 : STA $0006, X
  LDA $01, S               ; parent slot
  STA $7F0022, X           ; new.$7F0022 = parent ref
  TXY : PLX                ; restore Y=new, X=parent
  LDA $2C : STA $02, S     ; update parent return PC
  RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `@Code` (3 bytes) | `$28`/`$2A` | Far code pointer — child's script entry |
| 2 | `Word` (2 bytes) | `$06` | Actor flags, ORed with `#$2000` before storing |

### Flag word values observed

| Value | After `\| #$2000` | Sites | Context |
|-------|-------------------|------:|---------|
| `#$2800` | `#$2800` | 13 | Standard screen effect actor (inns, bedrooms, cutscenes) |
| `#$0800` | `#$2800` | 6 | Same effective result — screen flash/fade actors |
| `#$A800` | `#$A800` | 2 | Special flag combo (`#$8000` bit = extra flag) |
| `#$0000` | `#$2000` | 1 | Minimal flags (system actor) |

The `#$2000` bit in `$06` marks the actor as spawned/child. `#$0800` sets a render-related flag. The practical distinction between `#$2800` and `#$0800` input is nil — both yield `#$2800` after the OR.

### Usage (22 sites)

Primary use case: spawning **screen effect / overlay actors** that run independently at the head of the execution chain. These actors typically:
- Configure SNES hardware registers (`COLDATA`, `CGADSUB`, `WOBJSEL`) for color math / screen fades
- Set up interrupt-driven rendering (`code_008277` / `code_008A57`)
- Yield with `COP [CB]` and self-clean

Common targets:
- `code_04BB57` (7 sites) — screen dim/flash effect: writes `COLDATA`, installs interrupt handler via `code_008277`, yields
- `code_0CAC03` (3 sites) — subtractive color fill: writes `CGADSUB` = `#$B3`, `COLDATA` = `#$FF`
- `code_06F4A1` (2 sites) — Prinky's Mansion brightness controller
- `code_0BDCE0` — map-dependent NPC table loader (via `unk31_01C7C0`)

### Source examples

```
; Inn fade-to-black effect (native_village)
COP [A2] ( @code_04BB57, #$2800 )

; Screen flash (Prinky's Mansion entrance)
COP [A2] ( @code_06F4A1, #$0800 )

; System process spawn (chunk_008000)
COP [A2] ( @code_03BB88, #$0000 )
```

---

## `[A3]` — `spawn_actor_child`

Allocates a new actor as a **child** of the current actor. The simplest spawn variant — only a far code pointer is passed.

### Handler: `code_00C396`

```
code_00C396:
  TYX : PHX
  JSR code_00E535           ; Allocate + link as child of parent
  TYX                       ; X = new actor
  LDA [$2C] : INC $2C×2    ; @Code lo → $28
  STA $0028, X
  LDA [$2C] : INC $2C      ; @Code bank → $2A
  AND #$00FF : STA $002A, X
  LDA $01, S                ; parent slot
  STA $7F0022, X
  TXY : PLX
  LDA $2C : STA $02, S
  RTI
```

### Parameters

| # | Type | Dest | Notes |
|---|------|------|-------|
| 1 | `@Code` (3 bytes) | `$28`/`$2A` | Far code pointer — child's script entry |

### Usage (2 sites)

Both sites are in critical system code:

1. **`actor_0BD8F4`** (the player host actor, class `#44`): spawns `code_0BDCE0` as a child. This code scans a map-dependent NPC table (`unk31_01C7C0`) and populates NPC tracking globals (`$09F8`–`$0A00`).

2. **`chunk_038000`**: spawns `code_03BFCA` during battle initialization — a child process that manages battle-specific state.

### Source examples

```
; Player host spawning map-NPC loader
COP [A3] ( @code_0BDCE0 )

; Battle init helper
COP [A3] ( @code_03BFCA )
```

---

## `[A4]` — `spawn_actor_child_flags`

Child spawn with an additional flags word written to `$06`. Equivalent to `[A3]` + flags.

### Handler: `code_00C3BC`

```
code_00C3BC:
  TYX : PHX
  JSR code_00E535           ; Allocate + link as child
  TYX                       ; X = new actor
  LDA [$2C] : INC $2C×2    ; @Code lo → $28
  STA $0028, X
  LDA [$2C] : INC $2C      ; @Code bank → $2A
  AND #$00FF : STA $002A, X
  LDA [$2C] : INC $2C×2    ; Word → $06 (raw, no OR)
  STA $0006, X
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
| 2 | `Word` (2 bytes) | `$06` | Actor flags (raw — no `#$2000` OR) |

### Usage

**0 call sites.** Not in `copdef.json`. This is the child-chain equivalent of `[A2]`'s flag feature, but without the forced `#$2000` bit.

---

## `[A5]` — `spawn_actor_child_offset`

Child spawn with **facing-relative position adjustment**. The X offset is conditionally negated based on the parent's horizontal facing, allowing spawned actors to appear "in front of" the parent regardless of which direction it faces.

### Handler: `code_00C3EB`

```
code_00C3EB:
  TYX : PHX
  JSR code_00E535           ; Allocate + link as child
  TYX                       ; X = new actor
  LDA [$2C] : INC $2C×2    ; @Code lo → $28
  STA $0028, X
  LDA [$2C] : INC $2C      ; @Code bank → $2A
  AND #$00FF : STA $002A, X
  LDA $000A, X              ; Read new actor's $0A (flags, copied from parent)
  ASL : ASL                  ; Bit 14 (#$4000 = facing) → carry
  LDA [$2C] : INC $2C×2     ; Read Word (X offset)
  BCC loc_00C415             ; If facing bit clear, use offset as-is
  EOR #$FFFF : INC           ; Negate (two's complement)
loc_00C415:
  CLC : ADC $0000, X        ; Add to actor X position
  STA $0000, X
  LDA [$2C] : INC $2C×2     ; Read Word (Y offset)
  CLC : ADC $0002, X        ; Add to actor Y position (always positive)
  STA $0002, X
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
| 2 | `Word` (2 bytes) | `$00` adj | X position offset (negated when `$0A bit #$4000` = facing left) |
| 3 | `Word` (2 bytes) | `$02` adj | Y position offset (always added) |

### Facing logic

The child actor inherits the parent's position and flags via `code_00E587`. The handler then checks bit `#$4000` of `$0A` (horizontal facing):
- **Facing right** (bit clear): X offset is added as-is
- **Facing left** (bit set): X offset is **negated** (two's complement), so the child spawns on the mirrored side

The Y offset is always applied directly (no facing adjustment).

### Usage (3 sites)

| File | Operands | Context |
|------|----------|---------|
| `chunk_038000:13974` | `@code_03F049, #$0010, #$0000` | Battle: spawn projectile 16px ahead, no Y offset |
| `chunk_0B8000:11793` | `@code_0BEA93, #$00A0, #$FF00` | System: spawn helper 160px ahead, -256 Y (above) |
| `chunk_0B8000:11809` | `@code_0BEB64, #$0000, #$FF00` | System: spawn helper at same X, -256 Y (above) |

Note: `#$FF00` as a signed word is `-256`, placing the child 256 pixels above the parent.

### Source examples

```
; Battle projectile spawn, 16px in front of actor
COP [A5] ( @code_03F049, #$0010, #$0000 )

; Spawn helper actor 160px ahead, 256px above
COP [A5] ( @code_0BEA93, #$00A0, #$FF00 )
```

---

## Unused variants: `[A6]`, `[A7]`, `[A8]`

Three additional child-spawn variants exist with valid handlers but zero call sites and no `copdef.json` entries.

### `[A6]` — `spawn_actor_child_offset_flags`

**Handler:** `code_00C436` — combines `[A5]` (facing-relative offset) + `[A4]` (flags word).

Operands (inferred): `@Code, Word (X offset), Word (Y offset), Word (→ $06)`

### `[A7]` — `spawn_actor_child_xy`

**Handler:** `code_00C48A` — writes absolute X/Y position (overwrites `$00`/`$02` directly, no facing logic).

Operands (inferred): `@Code, Word (→ $00 abs X), Word (→ $02 abs Y)`

### `[A8]` — `spawn_actor_child_xy_flags`

**Handler:** `code_00C4C2` — combines `[A7]` (absolute position) + flags word.

Operands (inferred): `@Code, Word (→ $00), Word (→ $02), Word (→ $06)`

---

## Helper functions

### `code_0481EE` — Actor slot allocator

Reads the next free slot from a sequential pool at pointer `$56`. Returns:
- **C=0** (success): Y = allocated slot index
- **C=1** (failure): Y = `#$1FC0` (invalid sentinel)

The pool is consumed sequentially — `$56` advances by 2 for each allocation. A zero entry signals pool exhaustion.

### `code_00E535` — Child actor linkage (main chain)

Allocates via `code_0481EE`, then links the new actor into the parent's `$0024`/`$0026` doubly-linked child list:
- `new.$26` = parent slot (back-link)
- `new.$24` = parent's previous `$0024` child (next sibling)
- `parent.$0024` = new actor (parent's child head)
- If the previous child was null, updates `$0EF4` (global chain endpoint)

Then calls `code_00E587` to initialize the new actor's fields.

### `code_00E587` — New actor field initialization

Copies the parent's core fields (`$00`–`$0C`: position, flags, facing, etc.) to the new actor via `MVN #$7F, #$7F`. Then:
- Sets `$06 |= #$2000` (child/spawned marker)
- Clears `$06 &= ~$0800`
- Clears `$08 &= ~$BF80`
- Zeros: `$0E`, `$22`, and 16+ `$7F` actor RAM fields (`$7F1026`, `$7F1028`, `$7F2000`, `$7F0020`, `$7F001A`, `$7F001C`, `$7F0028`, `$7F002A`, `$7F002C`, etc.)

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `A2` | `spawn_actor_head` | 22 |
| `A3` | `spawn_actor_child` | 2 |
| `A4` | `spawn_actor_child_flags` | 0 |
| `A5` | `spawn_actor_child_offset` | 3 |
| `A6` | `spawn_actor_child_offset_flags` | 0 |
| `A7` | `spawn_actor_child_xy` | 0 |
| `A8` | `spawn_actor_child_xy_flags` | 0 |
| | **Total** | **27** |

## Family notes

1. **Head vs child**: `[A2]` is the only op that inserts at the `$0EF4` chain head (highest execution priority). All others link as children of the calling actor. This mirrors the `[A9]` vs `[AA]` split in the render chain family — one head-insert op plus many child variants.

2. **Forced `#$2000` bit**: Only `[A2]` forces `$06 |= #$2000` in the handler. `[A4]`/`[A6]`/`[A8]` store the flags word raw. However, `code_00E587` (called by all ops) also sets `$06 |= #$2000`, so all spawned actors get this bit regardless. The `[A2]` OR is effectively redundant with E587 but ensures the script-provided flags don't accidentally clear it.

3. **Facing-relative position** (`[A5]`/`[A6]`): The X offset is negated when `$0A bit #$4000` (horizontal facing) is set. Since E587 copies the parent's `$0A` to the child before the handler reads it, the facing check uses the **parent's** facing direction. The Y offset is never facing-adjusted.

4. **Absolute position** (`[A7]`/`[A8]`): These overwrite `$00`/`$02` directly (after E587 copied the parent's position), giving the child a fixed position independent of the parent.

5. **Sparse usage**: Only 3 of 7 ops are used. The unused ops (`[A4]`, `[A6]`, `[A7]`, `[A8]`) represent all combinations that were implemented but never needed by game scripts. All unused ops lack `copdef.json` entries.

6. **Relationship to `code_00E55E`**: The render chain family (`[A9]`+) uses `code_00E55E` instead of `code_00E535`. E55E links via `$0026`/`$0024` (reversed) with `$0EF6` as the chain head. This is a completely separate execution chain for rendering actors.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Render Chain Spawn](render_config.md) `[A9]`–`[B1]` | Mirror family using `$0EF6` render chain instead of `$0EF4` main chain |
| [Child Sprite Spawn](child_sprite.md) `[8D]`–`[90]` | Lower-level child spawn for visual effects (uses `code_04FDDD` allocator, not `code_0481EE`) |
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | Often follows spawn ops to configure the child's animation |
| [Animation Wait](anim_wait.md) `[97]`–`[9C]` | Often follows spawn+anim to wait for completion |
