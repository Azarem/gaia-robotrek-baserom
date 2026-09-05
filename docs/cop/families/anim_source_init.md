# Animation Source Init (`[D5]`–`[D6]`)

Two opcodes that combine animation ID assignment with spritemap pointer loading in a single instruction. They set up the actor's animation state and graphics source simultaneously, clearing the name table bit and saving the resume point.

## Overview

| Op | Name | Operands | Speed | Uses |
|----|------|----------|:-----:|-----:|
| `D5` | `init_anim_spritemap` | Byte, Address | — | 26 |
| `D6` | `init_anim_spritemap_spd` | Byte, Byte, Address | yes | 2 |

Both perform the same core sequence:
1. Set animation ID → `$7F000C,X`
2. Clear frame counter → `STZ $10`
3. Load spritemap pointer → `$7F0000,X` / `$7F0002,X`
4. Clear name table bit → `$0A &= ~#$0100`
5. Save resume point → `$28 = $2C`
6. Continue (RTI)

D6 additionally sets the speed/duration field `$12` from a second Byte operand.

### Combined effect

These ops merge the functionality of several simpler ops:

| Step | Equivalent separate op |
|------|----------------------|
| Animation ID → `$7F000C,X` | `[80]` (`set_anim`) — sets animation ID |
| Spritemap pointer → `$7F0000,X`/`$7F0002,X` | `[C8]` (`load_spritemap`) — loads pointer (but C8 also optionally does frame advance) |
| Name table clear → `$0A bit 8` | `[C7] ( #00 )` (`set_sprite_nametable`) — clears page select |
| Speed → `$12` | `[84]` (`set_anim_spd`) — sets speed (D6 only) |
| Resume save → `$28` | `[CB]` (`mark_resume`) — saves current PC |

### Key difference from `[C8]`

`[C8]` (`load_spritemap`) with byte `#01` also resets animation and calls `code_04FC71`/`code_04FCE6` to advance frame 0 and set up the collision box. D5/D6 do **not** call these helpers — they just set the fields without advancing any frames. The animation frame advance happens on the next render tick.

---

## `[D5]` — `init_anim_spritemap`

Sets animation ID and spritemap pointer.

### Handler: `code_00CC8A`

```
TYX
LDA [$2C] : INC $2C : AND #$00FF ; read Byte (animation ID)
STA $7F000C,X                     ; set animation ID
STZ $10                            ; clear frame counter
LDA [$2C] : INC $2C : INC $2C    ; read Address (low 16 bits)
STA $7F0000,X                     ; spritemap pointer low
LDA [$2C] : INC $2C : AND #$00FF ; read bank byte
STA $7F0002,X                     ; spritemap pointer bank
LDA #$0100 : TRB $0A             ; clear name table bit (page 0)
LDA $2C : STA $28                 ; save resume
STA $02,S : RTI                   ; continue
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte | 1 | Animation ID (index into spritemap table) |
| Address | 3 | 24-bit far pointer to spritemap table |

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_04B3D8.asm:16` | `COP [D5] ( #00, @spritemap_12B000 )` | World map: init anim 0, world spritemap |
| `actor_04B3FE.asm:9` | `COP [D5] ( #01, @spritemap_12B000 )` | World map: init anim 1 |
| `actor_04B506.asm:28` | `COP [D5] ( #11, @spritemap_12B000 )` | Space world: init anim 17 |
| `chunk_048000.asm:6117` | `COP [D5] ( #05, @spritemap_128000 )` | System: init anim 5, main spritemap |
| `chunk_038000.asm:3916` | `COP [D5] ( #00, @spritemap_12A000 )` | Dialog: init anim 0, dialog spritemap |

---

## `[D6]` — `init_anim_spritemap_spd`

Sets animation ID, speed, and spritemap pointer.

### Handler: `code_00CCB9`

```
TYX
LDA [$2C] : INC $2C : AND #$00FF ; read Byte 1 (animation ID)
STA $7F000C,X                     ; set animation ID
STZ $10                            ; clear frame counter
LDA [$2C] : INC $2C : AND #$00FF ; read Byte 2 (speed/duration)
STA $12                            ; set speed
LDA [$2C] : INC $2C : INC $2C    ; read Address (low 16 bits)
STA $7F0000,X                     ; spritemap pointer low
LDA [$2C] : INC $2C : AND #$00FF ; read bank byte
STA $7F0002,X                     ; spritemap pointer bank
LDA #$0100 : TRB $0A             ; clear name table bit
LDA $2C : STA $28                 ; save resume
STA $02,S : RTI                   ; continue
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte 1 | 1 | Animation ID |
| Byte 2 | 1 | Animation speed/duration → `$12` |
| Address | 3 | 24-bit far pointer to spritemap table |

### Source examples

| File | Call | Context |
|------|------|---------|
| `chunk_038000.asm:4828` | `COP [D6] ( #01, #03, @spritemap_128000 )` | Dialog: anim 1, speed 3 |
| `chunk_038000.asm:14830` | `COP [D6] ( #0F, #0A, @spritemap_128000 )` | System: anim 15, speed 10 |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `D5` | `init_anim_spritemap` | 26 |
| `D6` | `init_anim_spritemap_spd` | 2 |
| | **Total** | **28** |

## Family notes

1. **Convenience ops**: D5/D6 exist to reduce the number of COP instructions in common initialization sequences. Instead of `[C8] + [80] + [C7] + [CB]`, a single D5 does all four in 5 bytes of script space.

2. **No frame advance**: Unlike `[C8]` with byte `#01`, D5/D6 do not call `code_04FC71`/`code_04FCE6`. The actor's collision box is not updated until the next render tick. This makes them lighter-weight for cases where rendering hasn't started yet.

3. **Name table reset**: Both always clear `$0A` bit 8 (`#$0100`), equivalent to `COP [C7] ( #00 )`. This ensures the actor uses tile page 0.

4. **Resume point save**: Both save `$2C → $28` (like `[CB]`), so the actor's resume point is current after the init. This is important because D5/D6 are typically used at the start of a rendering phase.

5. **D6 rarity**: Only 2 call sites use D6. Most scripts set animation speed separately via `[84]` after the init, or don't need a custom speed for the initial animation.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | `[80]` sets `$7F000C,X` (animation ID) alone; D5/D6 combine it with spritemap load |
| [Render Source Load](render_source_load.md) `[C8]`–`[CA]` | `[C8]` loads spritemap pointer with optional frame advance; D5/D6 load pointer without frame advance |
| [Sprite Attribute Set](sprite_attribs.md) `[C7]` | D5/D6 implicitly clear the name table bit that `[C7]` explicitly sets |
| [Script Yield / Resume](script_yield.md) `[CB]` | D5/D6 include the `$28 = $2C` resume save that `[CB]` provides |
