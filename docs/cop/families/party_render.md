# Party Render Init (`[F1]`–`[F4]`)

Four system-only opcodes that configure rendering for party member child actors. F1 dispatches by party member type; F2–F4 set up spritemap loading, animation, velocity, and flags.

## Overview

| Op | Name | Operands | Action | Uses |
|----|------|----------|--------|-----:|
| `F1` | `branch_party_type` | Byte, &Code, &Code, &Code | 3-way branch by party member type | 15 |
| `F2` | `init_party_render_facing` | Byte, Byte, Byte | Facing-dependent anim + velocity + render flag | 8 |
| `F3` | `init_party_render_sfx` | Byte, Byte, Byte, Byte | Explicit spritemap + anim + velocity + SFX | 27 |
| `F4` | `init_party_render` | Word, Word, Byte | Flags + render flags + spritemap bank | 81 |

### Shared mechanism: spritemap loading

F2, F3, and F4 all load spritemaps via the parent actor's pointer:
1. Read parent: `LDA $7F0022,X : TAX` (follow parent link)
2. Load spritemap: `JSL code_08F3EA` (from bank index or `$05F8`)
3. Init rendering: `JSL code_08F34B` (set up rendering state)

All three also set `$06 |= #$0021` (bits 0 + 5) and `$08 = #$2010` (F2/F3) or from operand (F4).

---

## `[F1]` — `branch_party_type`

Looks up a party member's type from table `$06C5` and branches to one of three targets based on the type value.

### Handler: `code_00D7D7`

```
TYX
LDA [$2C] : INC $2C : AND #$00FF   ; read Byte (party member index, 1-based)
DEC : ASL : PHA : ASL               ; (index-1) * 4
CLC : ADC $01,S                     ; + (index-1) * 2 = (index-1) * 6
CLC : ADC $04 : TAY                 ; + actor $04 → table offset
PLA
LDA $06C5,Y : AND #$00FF           ; read type from $06C5

LDY #$0000
CMP #$0004 : BCC branch             ; type < 4 → 1st &Code (Y=0)
INY : INY
CMP #$0007 : BCC branch             ; type 4-6 → 2nd &Code (Y=2)
INY : INY                            ; type ≥ 7 → 3rd &Code (Y=4)

branch:
LDA [$2C],Y : STA $02,S : RTI      ; jump to selected target
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte | 1 | Party member index (1-based) |
| &Code 1 | 2 | Target for type < 4 (basic party members) |
| &Code 2 | 2 | Target for type 4–6 (intermediate) |
| &Code 3 | 2 | Target for type ≥ 7 (advanced) |

### Type table: `$06C5`

Indexed by `(member_index - 1) * 6 + actor_$04`. The table likely holds party formation or robot type data. Each branch target typically configures different render params (via F2 or `[94]` render child spawn).

### Source examples

| File | Call | Context |
|------|------|---------|
| `chunk_038000.asm:4111` | `COP [F1] ( #02, &code_03A42A, &code_03A437, &code_03A444 )` | Member 2: dispatch by type |
| `chunk_038000.asm:4138` | `COP [F1] ( #01, &code_03A42A, &code_03A437, &code_03A444 )` | Member 1: same targets |

---

## `[F2]` — `init_party_render_facing`

Configures a party member child with facing-dependent animation ID, velocity, and optional render flag.

### Handler: `code_00D807`

```
TYX
LDA $06 : AND #$0700 : ORA #$0021 : STA $06   ; preserve bits 8-10, set bits 0+5
LDA #$2010 : STA $08                            ; render flags
PHX : LDA $7F0022,X : TAX                      ; parent actor
LDA $05F8 : JSL code_08F3EA                    ; load spritemap from $05F8
PLX : JSL code_08F34B                           ; init rendering

LDA [$2C] : INC $2C : AND #$00FF : TAY        ; Byte 1 = anim base
LDA $0A : BIT #$4000 : BNE left
INY                                              ; facing right → base + 1
left:
TYA : STA $7F000C,X : STZ $10                 ; set anim ID + clear frame counter

LDA [$2C] : INC $2C : AND #$00FF              ; Byte 2 = velocity index
JSR code_00E398 : STA $1C                      ; lookup → X velocity

LDA [$2C] : INC $2C : AND #$00FF              ; Byte 3 = render flag control
BEQ skip
LDA #$0010 : TRB $08                           ; clear bit 4 of $08
skip:
LDA $2C : STA $28 : STA $02,S : RTI
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte 1 | 1 | Animation base (facing right adds +1) |
| Byte 2 | 1 | Velocity index → `code_00E398` → `$1C` |
| Byte 3 | 1 | If nonzero: clear `$08 bit #$0010` |

### Source examples

| File | Call | Context |
|------|------|---------|
| `chunk_038000.asm:4162` | `COP [F2] ( #0B, #0F, #00 )` | Anim 0B/0C, vel 0F, keep render flag |
| `chunk_038000.asm:4261` | `COP [F2] ( #0B, #0F, #01 )` | Same anim/vel, clear render flag |

---

## `[F3]` — `init_party_render_sfx`

Configures a party member child with explicit spritemap bank, animation, velocity, and optional SFX.

### Handler: `code_00D861`

```
TYX
LDA $06 : AND #$0700 : ORA #$0021 : STA $06
LDA #$2010 : STA $08
PHX : LDA $7F0022,X : TAX
LDA [$2C] : INC $2C : AND #$00FF              ; Byte 1 = spritemap bank
JSL code_08F3EA                                 ; load from bank index
PLX : JSL code_08F34B

LDA [$2C] : INC $2C : AND #$00FF              ; Byte 2 = animation ID
STA $7F000C,X : STZ $10
LDA [$2C] : INC $2C : AND #$00FF              ; Byte 3 = velocity index
JSR code_00E398 : STA $1C
LDA [$2C] : INC $2C : AND #$00FF              ; Byte 4 = SFX number
BEQ skip
SEP #$20 : STA $0879 : REP #$20               ; play SFX
skip:
LDA $2C : STA $28 : STA $02,S : RTI
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte 1 | 1 | Spritemap bank index → `code_08F3EA` |
| Byte 2 | 1 | Animation ID (direct, not facing-adjusted) |
| Byte 3 | 1 | Velocity index → `code_00E398` → `$1C` |
| Byte 4 | 1 | SFX number (0 = none) → `$0879` |

### Source examples

| File | Call | Context |
|------|------|---------|
| `chunk_02E9AA.asm:1162` | `COP [F3] ( #00, #09, #0F, #13 )` | Bank 0, anim 9, vel F, SFX 13 |
| `chunk_038000.asm:9799` | `COP [F3] ( #01, #09, #03, #0C )` | Bank 1, anim 9, vel 3, SFX 0C |

---

## `[F4]` — `init_party_render`

The most generic variant — sets actor flags, render flags, and spritemap bank. No animation or velocity setup.

### Handler: `code_00D8B7`

```
TYX
LDA [$2C] : INC $2C : INC $2C                 ; Word 1 (flags)
PHA
LDA $06 : AND #$0700 : ORA #$0001
ORA $01,S : STA $06                            ; merge flags into $06
PLA
LDA [$2C] : INC $2C : INC $2C                 ; Word 2 (render flags)
STA $08                                         ; set $08 directly
PHX : LDA $7F0022,X : TAX                     ; parent actor
LDA [$2C] : INC $2C : AND #$00FF             ; Byte (spritemap bank)
JSL code_08F3EA                                 ; load spritemap
PLX : JSL code_08F34B                          ; init rendering
LDA $2C : STA $02,S : RTI                     ; continue
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Word 1 | 2 | Flags merged into `$06` (with bits 0 set, bits 8-10 preserved) |
| Word 2 | 2 | Render flags → `$08` directly |
| Byte | 1 | Spritemap bank index → `code_08F3EA` via parent |

### Common operand values

| Word 1 | Word 2 | Byte | Count | Notes |
|--------|--------|------|------:|-------|
| `#$0020` | `#$2050` | `#00` | 15 | Standard render, bank 0 |
| `#$0020` | `#$2050` | `#01` | 11 | Standard render, bank 1 |
| `#$0030` | `#$2050` | `#01` | 6 | Extra flag, bank 1 |
| `#$0020` | `#$2000` | `#01` | 5 | Simplified render, bank 1 |

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:113` | `COP [F4] ( #$0020, #$2000, #02 )` | Flags $20, render $2000, bank 2 |
| `chunk_038000.asm:3456` | `COP [F4] ( #$0020, #$2000, #01 )` | Standard setup |
| `chunk_038000.asm:4109` | `COP [F4] ( #$0020, #$2050, #01 )` | With extra render bits |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `F1` | `branch_party_type` | 15 |
| `F2` | `init_party_render_facing` | 8 |
| `F3` | `init_party_render_sfx` | 27 |
| `F4` | `init_party_render` | 81 |
| | **Total** | **131** |

## Family notes

1. **System-only**: All 131 call sites are in system chunks (`chunk_038000.asm`, `actor_02Exxx`).

2. **F4 dominance**: F4 accounts for 62% of call sites. It's the minimal "set up child rendering" instruction. F2 and F3 add animation/velocity on top.

3. **F1 → F2 pipeline**: F1 dispatches by type, then each branch target uses F2 or `[94]` (render child spawn) to configure type-specific rendering. F4 is used independently to set up the initial render state before F1 dispatches.

4. **Parent link**: All render setup goes through `$7F0022,X` (parent actor pointer) for spritemap data. The child inherits the parent's graphics bank.

5. **Shared helpers**: `code_08F3EA` loads spritemap data from a bank index; `code_08F34B` initializes the rendering state machine. Both are also used by the [Render Configuration](render_config.md) family.

6. **Facing**: Only F2 adjusts animation by facing (base + 1 when facing right). F3 uses a direct animation ID regardless of facing.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Render Configuration](render_config.md) `[91]`–`[A1]` | Shares `code_08F3EA`/`code_08F34B` helpers. F2–F4 are party-specific equivalents of the general render setup ops |
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | F2/F3 set animation ID (`$7F000C,X`) + velocity (`$1C`) — similar to `[80]`–`[87]` but combined with spritemap loading |
| [Velocity Set](velocity_set.md) `[B4]`–`[B6]` | F2/F3 use `code_00E398` for velocity lookup — same helper as animation setup |
| [Party AI Control](party_ai.md) `[E3]`–`[E9]` | F1 dispatches party type; E3 dispatches party slot position. Both are 3-way branches in the party system |
