# Party Register (`[F5]`)

A single system-only opcode that registers a new party member actor into the secondary entity slot system (`$0A08,Y`, `$05C8`).

## Overview

| Op | Name | Operands | Action | Uses |
|----|------|----------|--------|-----:|
| `F5` | `register_party_member` | Byte, Word, Word, &Code | Claim slot, configure, register entity | 4 |

---

## `[F5]` — `register_party_member`

Registers the calling actor as a secondary party member by claiming a capability slot in `$05C8`, matching the actor's Y position to a hardcoded battle row, and initializing entity state from the parent actor.

### Handler: `code_00D8EF`

```
TYX
STZ $0000                           ; clear temp (tracks claimed bit)

; Find free capability slot:
LDY #$0008
LDA #$0100 : BIT $05C8              ; slot 8 free?
BEQ claim
INY : INY
LDA #$0200 : BIT $05C8              ; slot 10 free?
BEQ claim
INY : INY
LDA #$0400 : BIT $05C8              ; slot 12 free?
BEQ claim
JMP fail                              ; all 3 slots full

claim:
STY $04                               ; save slot index → actor $04
TSB $05C8                             ; mark slot as claimed
STA $0000                             ; save claimed bit for cleanup

; Match Y position to battle row:
LDY #$0000
LDA $02 : CMP #$0050 : BEQ matched   ; row 0 (Y=$50)
INY : INY : CMP #$0070 : BEQ matched ; row 1 (Y=$70)
INY : INY : CMP #$0090 : BNE fail   ; row 2 (Y=$90), else fail

matched:
LDA $0A08,Y : BNE fail               ; slot already occupied → fail
TXA : STA $0A08,Y                    ; register in secondary entity table
TYA : STA $7F0008,X                  ; set party slot index
LDA #$0000
STA $0A18,Y : STA $0A2C,Y : STA $0A5C,Y  ; clear slot state data

; Read Byte operand (parent state inheritance):
STZ $0000
LDA [$2C] : INC $2C : AND #$00FF
BEQ inherit                           ; Byte=0 → inherit parent's $7F0006
CMP #$00FF : BNE direct              ; Byte=FF → inherit parent's $7F0006 + 1
INC $0000                              ; set +1 flag

inherit:
TXY : LDA $7F0022,X : TAX            ; follow parent link
LDA $7F0006,X : CLC : ADC $0000      ; parent's state (optionally +1)
PHA
LDA $7F101A,X : PHA                  ; copy parent's $7F101A
LDA $7F101C,X : TYX
STA $7F101C,X                         ; → child's $7F101C
PLA : STA $7F101A,X                  ; → child's $7F101A
PLA

direct:
STA $7F0006,X                         ; set entity state field
JSL code_03C544                        ; helper (likely collision/interact setup)
JSL code_0BF2C1                        ; helper (likely zone registration)

; Read remaining operands:
LDA [$2C] : INC $2C : INC $2C        ; Word 1
ORA #$0200 : STA $0006,X             ; → actor $06 (with bit 9 forced)
LDA [$2C] : INC $2C : INC $2C        ; Word 2
STA $0008,X                           ; → actor $08
LDA #$F000 : TSB $0EE2               ; DMA flags
LDA $2C : INC : INC : STA $02,S : RTI  ; skip &Code, continue

; Failure path:
fail:
LDA $0000 : TRB $05C8                ; release claimed slot (if any)
LDA $2C : CLC : ADC #$0005 : STA $2C ; skip 5 bytes (Byte+Word+Word)
LDA [$2C]                              ; read &Code
BEQ self_destruct
STA $02,S : RTI                        ; &Code ≠ 0 → jump to fallback

self_destruct:
JSL code_04FD4E                        ; &Code == 0 → destroy self
PLA : PLA : RTL
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte | 1 | State inheritance: `#00` = copy parent `$7F0006`, `#FF` = parent+1, other = direct value |
| Word 1 | 2 | Flags → `$0006,X` (bit 9 `#$0200` always set) |
| Word 2 | 2 | Flags → `$0008,X` |
| &Code | 2 | Fallback on failure (0 = self-destruct) |

### Capability slots: `$05C8`

| Bit | Slot (Y) | Entity array index |
|----:|:--------:|:------------------:|
| 8 (`#$0100`) | 8 | `$0A08[0]` |
| 9 (`#$0200`) | 10 | `$0A08[2]` |
| 10 (`#$0400`) | 12 | `$0A08[4]` |

The same `$05C8` field is tested by `[D7]`–`[D9]` (player idle) via `code_03CD92` for interact capability.

### Battle row positions

| Row | Y position | Slot |
|----:|:----------:|:----:|
| 0 | `$0050` (80) | `$0A08[0]` |
| 1 | `$0070` (112) | `$0A08[2]` |
| 2 | `$0090` (144) | `$0A08[4]` |

### Parent state inheritance

When Byte is `#00` or `#FF`:
- Follows parent link `$7F0022,X`
- Copies `$7F0006` (entity state) from parent (optionally +1 for `#FF`)
- Copies `$7F101A` and `$7F101C` fields from parent to child

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:184` | `COP [F5] ( #FF, #$0000, #$0004, &code_02EB65 )` | Inherit parent+1, fallback to code |
| `actor_02EBB5.asm:253` | `COP [F5] ( #00, #$0031, #$0004, #$0000 )` | Inherit parent, self-destruct on fail |
| `chunk_038000.asm:9990` | `COP [F5] ( #00, #$0030, #$0002, #$0000 )` | Inherit parent, self-destruct on fail |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `F5` | `register_party_member` | 4 |
| | **Total** | **4** |

## Family notes

1. **System-only**: All 4 call sites are in system chunks (`actor_02E9AA`, `actor_02EBB5`, `chunk_038000.asm`).

2. **Secondary entity system**: F5 registers into `$0A08,Y` (the same secondary entity table searched by `[E4]`/`[E5]`/`[E8]`). This is the entry point for new party member actors joining the formation.

3. **Three-slot limit**: Only 3 secondary party member slots exist (bits 8–10 of `$05C8`). If all three are claimed, the actor fails.

4. **Position-locked**: Entity slot assignment is determined by the actor's Y position matching one of three hardcoded values ($50/$70/$90). These correspond to the three battle formation rows.

5. **Self-destruct on full failure**: When &Code is 0 and registration fails, the actor destroys itself via `code_04FD4E` — a spawn gate pattern similar to `[74]`–`[76]`.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Party AI Control](party_ai.md) `[E3]`–`[E9]` | E4/E5 search `$0A08` (secondary slots that F5 populates). E8 reads from `$0A08` for proximity checks |
| [Player Idle / Interact](player_idle.md) `[D7]`–`[D9]` | D7–D9 test `$05C8` (the same capability flags F5 claims) |
| [Party Render Init](party_render.md) `[F1]`–`[F4]` | F5 registers the entity; F4 sets up its rendering. Often used together |
| [Spawn Gate](spawn_gate.md) `[74]`–`[76]` | F5's self-destruct path shares the `code_04FD4E` pattern |
