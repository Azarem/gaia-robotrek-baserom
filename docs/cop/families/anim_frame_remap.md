# Anim Frame Remap (`[F6]`)

A single system-only opcode that sets an animation ID, advances one frame, and optionally copies the parent actor's spritemap with palette remapping.

## Overview

| Op | Name | Operands | Action | Uses |
|----|------|----------|--------|-----:|
| `F6` | `init_anim_with_remap` | Byte | Set anim ID (low 7 bits); if bit 7: remap parent spritemap | 4 |

---

## `[F6]` — `init_anim_with_remap`

### Handler: `code_00D9D0`

```
TYX
LDA [$2C] : INC $2C : AND #$00FF   ; read Byte
STA $30
BIT #$0080 : BEQ skip               ; bit 7 → spritemap remap
JSR code_00D9FC                      ; complex spritemap copy + palette remap

skip:
LDA $30 : AND #$007F                ; mask to animation ID
STA $7F000C,X : STZ $10             ; set anim ID, clear frame counter
JSL code_04FC71                      ; advance one animation frame
STZ $0E                              ; clear delay counter
JSL code_04FCE6                      ; animation render step
LDA $2C : STA $02,S : RTI           ; continue
```

### Operand

| Part | Size | Meaning |
|------|------|---------|
| Byte | 1 | Bits 0–6: animation ID; Bit 7: if set, invoke spritemap palette remap |

### Observed values

| Byte | Anim ID | Remap? | Sites |
|------|---------|--------|------:|
| `#00` | 0 | No | 1 |
| `#0A` | 10 | No | 1 |
| `#81` | 1 | **Yes** | 1 |
| `#87` | 7 | **Yes** | 1 |

### Spritemap remap: `code_00D9FC`

Called when bit 7 is set. This subroutine creates a custom copy of the parent actor's spritemap data in WRAM with palette bits remapped:

```
; Compute destination address:
;   dest = $7E:7000 + (($04 - 8) * 6) * 256
STA $7F0000,X                       ; set spritemap pointer lo to dest
LDA #$007E : STA $7F0002,X          ; bank = $7E

; Get parent's spritemap:
LDA $7F0022,X : TAX                  ; follow parent link
LDA $7F0000,X : STA $0042            ; parent spritemap → $42

; Copy spritemap structure with palette remapping:
; For each frame entry:
;   - Copy 12-byte header via MVN
;   - Copy tile entries (5 bytes each via MVN)
;   - Remap palette bits: AND #$F1FF, ORA $02 (actor $02 holds new palette bits)
; Until terminator (negative entry)

; Copy 32 bytes OAM staging:
;   $7E:(0B00+parent_offset) → $7E:(3900+actor_offset)
;   $7F:(0B00+parent_offset) → $7F:(0B00+actor_offset)
```

The remap operation replaces palette bits (OAM bits 9–11) in every tile entry with the value from actor `$02`, creating a palette-swapped version of the parent's sprite sheet. This is used to give each party member a unique color scheme while sharing the same sprite graphics.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:185` | `COP [F6] ( #0A )` | After F5 registration, set anim 10, no remap |
| `actor_02EBB5.asm:254` | `COP [F6] ( #00 )` | After F5 registration, set anim 0, no remap |
| `chunk_038000.asm:9991` | `COP [F6] ( #87 )` | Anim 7 with palette remap |
| `chunk_038000.asm:14591` | `COP [F6] ( #81 )` | Anim 1 with palette remap |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `F6` | `init_anim_with_remap` | 4 |
| | **Total** | **4** |

## Family notes

1. **System-only**: All 4 call sites are in party member system actors.

2. **Palette sharing**: The remap mechanism allows multiple party members to share the same spritemap ROM data while each having distinct palette assignments via the actor's `$02` field.

3. **MVN-heavy**: `code_00D9FC` uses multiple `MVN` (block move) instructions to copy spritemap data — one of the more complex helper routines in the COP system.

4. **Post-registration**: In two sites, F6 immediately follows `[F5]` (party registration), initializing the newly registered actor's first animation frame.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | F6 also sets `$7F000C,X` and calls `code_04FC71` — same core animation mechanism |
| [Party Register](party_register.md) `[F5]` | F6 often follows F5, setting the initial animation for a newly registered party member |
| [Sprite Attribute Set](sprite_attribs.md) `[C5]`–`[C7]` | F6's remap operates on the same OAM palette bits that C6 modifies |
| [Party Render Init](party_render.md) `[F1]`–`[F4]` | F2–F4 also configure party member rendering; F6 adds the spritemap copy dimension |
