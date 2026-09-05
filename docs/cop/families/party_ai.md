# Party AI Control (`[E3]`–`[E9]`)

Seven system-only opcodes used by the party member AI controller. Five are conditional branches that test party member existence, state, or proximity; one sets actor state and yields; one is an unused reverse-facing variant. All operate exclusively in system chunks (`chunk_038000.asm`, `actor_02Exxx.asm`).

## Overview

| Op | Name | Operands | Action | Uses |
|----|------|----------|--------|-----:|
| `E3` | `branch_party_slot` | &Code, &Code, &Code | 3-way branch by party slot search (primary) | 57 |
| `E4` | `branch_no_prev_partner` | &Code | Branch if previous partner absent (secondary) | 17 |
| `E5` | `branch_no_next_partner` | &Code | Branch if next partner absent (secondary) | 17 |
| `E6` | `branch_if_state` | Byte, &Code | Branch if `$7F0006,X` == Byte | 20 |
| `E7` | `set_state_yield` | Byte, &Code | Set `$7F100C,X` + resume at &Code + yield | 19 |
| `E8` | `branch_party_near` | Word, &Code | Branch if party member within distance | 90 |
| `E9` | `branch_party_near_behind` | Word, &Code | E8 reversed facing — check from behind | 0 |

### Entity slot arrays

The party system uses two indexed arrays:

| Array | Slots | Searched by | Purpose |
|-------|-------|-------------|---------|
| `$0A02[0]`–`$0A02[4]` | 0, 2, 4 (3 primary) | `code_00D31C` (E3) | Primary party member entities |
| `$0A02[6]`–`$0A02[10]` | 6, 8, 10 (3 secondary) | `code_00D37F` (E4/E5) | Secondary / partner entities |

Each slot holds a pointer to an entity; 0 = empty. Entity `$7F0008,X` identifies which party slot the actor occupies.

---

## `[E3]` — `branch_party_slot`

Searches primary entity slots for a matching party member, trying the actor's own slot first, then adjacent slots (wrapping 0↔4). Branches to one of three inline targets based on which slot was found.

### Handler: `code_00D2B9`

```
TYX
LDA $7F0008,X : STA $30          ; target slot index
JSR code_00D31C                    ; search primary slots for match
BCC found_exact                    ; carry clear → found at own slot

; Try previous slot (slot - 2):
LDA $30 : BEQ skip_prev           ; slot 0 has no previous
DEC : DEC : STA $30
JSR code_00D31C
BCC found_prev

; Try next slot (slot + 2, wrapping 4→0):
...
JSR code_00D31C
BCC found_next

; No entity found at any slot:
LDA $2C : CLC : ADC #$0006        ; skip 6 bytes (3 × &Code)
STA $02,S : RTI

; Branch dispatch:
found_prev:  LDY #$0000 → LDA [$2C],Y  ; 1st &Code
found_exact: LDY #$0002 → LDA [$2C],Y  ; 2nd &Code
found_next:  LDY #$0004 → LDA [$2C],Y  ; 3rd &Code
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| &Code 1 | 2 | Target if found at previous slot |
| &Code 2 | 2 | Target if found at own slot |
| &Code 3 | 2 | Target if found at next slot |

### Helper: `code_00D31C`

Scans `$0A02[0]`, `$0A02[2]`, `$0A02[4]` for an active entity (bit 7 of `$0006,X` clear) whose `$7F0008` matches `$30`. Returns carry clear on success, Y = entity pointer.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:1051` | `COP [E3] ( &code_02F2C7, &code_02F295, &code_02F2C7 )` | Party: branch by slot (prev/exact/next) |
| `actor_02E9AA.asm:1092` | `COP [E3] ( &code_02F2DC, &code_02F2EC, &code_02F2E4 )` | Party: 3-way branch |

---

## `[E4]` — `branch_no_prev_partner`

Branches to &Code if the previous party member (slot - 2) is NOT present in the secondary entity group.

### Handler: `code_00D344`

```
TYX
LDA $7F0008,X : BEQ skip         ; slot 0 → no previous, skip
DEC : DEC : STA $30               ; target = slot - 2
JSR code_00D37F                    ; search secondary slots
BCS take_branch                    ; NOT found → jump to &Code

skip:
LDA $2C : INC : INC : STA $02,S : RTI   ; found → skip &Code

take_branch:
LDA [$2C] : STA $02,S : RTI      ; jump to &Code
```

### Helper: `code_00D37F`

Scans `$0A02[6]`, `$0A02[8]`, `$0A02[10]` for an entity whose `$7F0008` matches `$30`, excluding the caller (skips if `$0A02,Y == X`). Returns carry clear = found, carry set = not found.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:282` | `COP [E4] ( &code_02EC1D )` | Party: if no prev partner → jump |
| `chunk_038000.asm:9959` | `COP [E4] ( &code_03D0EF )` | Player: check prev partner |

---

## `[E5]` — `branch_no_next_partner`

Branches to &Code if the next party member (slot + 2) is NOT present in the secondary entity group. Mirror of E4.

### Handler: `code_00D360`

```
TYX
LDA $7F0008,X
CMP #$0004 : BEQ skip            ; slot 4 → no next, skip
INC : INC : STA $30               ; target = slot + 2
JSR code_00D37F                    ; search secondary slots
BCS take_branch                    ; NOT found → jump to &Code

skip:
LDA $2C : INC : INC : STA $02,S : RTI

take_branch:
LDA [$2C] : STA $02,S : RTI
```

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:283` | `COP [E5] ( &code_02EC1D )` | Party: if no next partner → jump |
| `chunk_038000.asm:9960` | `COP [E5] ( &code_03D100 )` | Player: check next partner |

### E4/E5 pairing

E4 and E5 almost always appear consecutively (same &Code or complementary targets). They test "is the previous/next party member loaded?" and branch to fallback code if not.

---

## `[E6]` — `branch_if_state`

Branches to &Code if the actor's state field `$7F0006,X` equals the Byte operand.

### Handler: `code_00D3A4`

```
TYX
LDA [$2C] : INC $2C : AND #$00FF ; read Byte
SEP #$20
CMP $7F0006,X                     ; compare to actor state field (8-bit)
BEQ take_branch                    ; match → jump to &Code
REP #$20
LDA $2C : INC : INC : STA $02,S : RTI   ; no match → skip &Code

take_branch:
REP #$20
LDA [$2C] : INC $2C : INC $2C    ; read &Code
STA $02,S : RTI                   ; jump
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte | 1 | Expected state value |
| &Code | 2 | Branch target if state matches |

### Byte value distribution

| Byte | Count | Likely meaning |
|-----:|------:|---------------|
| `#05` | 1 | State 5 |
| `#08` | 1 | State 8 |
| `#0D` | 1 | State 13 |
| `#10` | 1 | State 16 |
| `#24`–`#2C` | 10 | Higher states (scene/quest-specific) |

All 20 call sites are in `chunk_038000.asm` — player controller state dispatch.

### Source examples

| File | Call | Context |
|------|------|---------|
| `chunk_038000.asm:9850` | `COP [E6] ( #05, &code_03CFD7 )` | If state == 5 → jump |
| `chunk_038000.asm:9934` | `COP [E6] ( #08, &code_03D0DB )` | If state == 8 → jump |

---

## `[E7]` — `set_state_yield`

Sets actor state `$7F100C,X` from Byte operand, saves &Code as resume point, sets a 2-frame delay, and yields.

### Handler: `code_00D3C8`

```
TYX
LDA [$2C] : INC $2C : AND #$00FF ; read Byte
STA $7F100C,X                     ; set state field
LDA [$2C] : INC $2C : INC $2C    ; read &Code
STA $28                            ; save as resume point
LDA #$0002 : STA $0E              ; delay = 2 frames
PLA : PLA : RTL                    ; yield
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte | 1 | State value → `$7F100C,X` (interact state counter for D7/D8) |
| &Code | 2 | Resume target after 2-frame delay |

### Byte values observed

| Byte | Count | Likely meaning |
|-----:|------:|---------------|
| `#01` | 6 | State 1 |
| `#02` | 9 | State 2 |
| `#04` | 4 | State 4 |

### Relationship to D7/D8

`$7F100C,X` is the same field used by `[D7]`/`[D8]` as the interact state counter. E7 sets this field and schedules a resume, effectively transitioning the party member into a new behavior state.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02EDE2.asm:166` | `COP [E7] ( #01, &code_02EE05 )` | Set state 1, resume at code |
| `chunk_038000.asm:10067` | `COP [E7] ( #01, &code_03D167 )` | Set state 1, resume |
| `chunk_038000.asm:11115` | `COP [E7] ( #02, &code_03D92B )` | Set state 2, resume |

---

## `[E8]` — `branch_party_near`

Branches to &Code if a target party member is within a facing-adjusted distance threshold.

### Handler: `code_00D3E4`

```
TYX : PHX
; Compute actor's facing-adjusted edge X:
LDA $0A : BIT #$4000 : PHP        ; save facing
LDA $00 : CLC : ADC $7F000E,X    ; actor X + footprint offset
PLP : BNE skip_width
CLC : ADC $7F0016,X               ; facing left → add width
skip_width:
STA $34                             ; actor edge X

; Look up target entity:
LDA $7F0008,X : TAY
LDA $06 : BIT #$0400              ; secondary character?
BEQ primary
LDX $0A08,Y : BEQ no_target
BRA check
primary:
LDX $0A02,Y : BEQ no_target

check:
LDA $0006,X : BIT #$0080          ; hidden?
BNE no_target

; Distance calculation (facing-dependent):
LDY #$0002                         ; default = &Code offset
LDA $0A : BIT #$4000
BNE facing_left

; Facing right: target left edge - actor right edge
LDA $0000,X : CLC : ADC $7F000E,X
SEC : SBC $34 : CLC : ADC #$0010
BEQ within : BMI no_target
DEC : CMP [$2C]                    ; compare to Word threshold
BCS no_target                      ; >= threshold → skip

within:
PLX : LDA [$2C],Y : STA $02,S : RTI   ; jump to &Code

facing_left:
; Mirror calculation for left-facing
...

no_target:
PLX : LDA $2C : CLC : ADC #$0004  ; skip 4 bytes (Word + &Code)
STA $02,S : RTI
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Word | 2 | Distance threshold (pixels) |
| &Code | 2 | Branch target if within range |

### Threshold distribution

| Threshold | Pixels | Count | Notes |
|-----------|-------:|------:|-------|
| `#$0010` | 16 | 24 | Close range (1 tile) |
| `#$0020` | 32 | 20 | Near range (2 tiles) |
| `#$0040` | 64 | 14 | Medium range |
| `#$0100` | 256 | 10 | Long range |
| `#$0030` | 48 | 8 | Short-medium |
| `#$0080` | 128 | 7 | Medium-long |

The **most-used** op in this family (90 sites, 41%). Used at the start of party member decision loops to determine behavior based on distance to the party leader.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:36` | `COP [E8] ( #$0020, &code_02EA83 )` | Party: if within 32px → close behavior |
| `actor_02EF9F.asm:25` | `COP [E8] ( #$0010, &code_02F0BF )` | Party: if within 16px → adjacent |
| `actor_02F1F3.asm:38` | `COP [E8] ( #$0100, &code_02F236 )` | Party: if within 256px → follow |

---

## `[E9]` — `branch_party_near_behind` (unused)

Unused reverse-facing variant of E8.

### Handler: `code_00D474`

Computes the actor's edge X position using the **opposite** facing logic from E8 (right edge when facing right, left edge when facing left — i.e., the actor's back side). Then jumps directly into E8's distance comparison code (`code_00D427` / `loc_00D445`) with the facing branches swapped.

```
TYX : PHX
LDA $0A : BIT #$4000 : PHP
LDA $00 : CLC : ADC $7F000E,X     ; actor X + footprint
PLP : BEQ skip                      ; facing RIGHT → skip width (use left edge)
CLC : ADC $7F0016,X                ; facing LEFT → add width (use right edge)
skip:
STA $34

; Same entity lookup as E8, then:
LDA $0A : BIT #$4000
BEQ loc_00D445                      ; facing RIGHT → use E8's "facing left" calc
JMP code_00D427                     ; facing LEFT → use E8's "facing right" calc
```

This effectively measures distance from the actor's **back** rather than front. Uses the same operand layout as E8 (Word threshold + &Code target). 0 call sites.

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `E3` | `branch_party_slot` | 57 |
| `E4` | `branch_no_prev_partner` | 17 |
| `E5` | `branch_no_next_partner` | 17 |
| `E6` | `branch_if_state` | 20 |
| `E7` | `set_state_yield` | 19 |
| `E8` | `branch_party_near` | 90 |
| `E9` | `branch_party_near_behind` | 0 |
| | **Total** | **220** |

## Family notes

1. **System-only**: All 220 call sites are in system chunks. E3–E5 and E8 are in party member actors (`actor_02Exxx`) and `chunk_038000.asm`. E6 is exclusively in `chunk_038000.asm`. E7 is split between party actors and the player controller.

2. **Two entity groups**: E3 searches the primary group (`$0A02[0..4]` via `code_00D31C`), while E4/E5 search the secondary group (`$0A02[6..10]` via `code_00D37F`). The primary group likely holds active party members; the secondary holds their "partner" or companion entities.

3. **E8 decision tree**: Party member AI typically starts with `COP [E1]` (face toward leader) followed by cascading `COP [E8]` checks with decreasing thresholds — `#$0100` → `#$0040` → `#$0020` → `#$0010` — to select behavior based on proximity (far → follow, mid → walk, near → idle).

4. **E6 state dispatch**: The 20 E6 call sites all test different state values in `$7F0006,X`. This implements a state machine for the player controller — each state has its own handler routine.

5. **E7 transition**: E7 sets `$7F100C,X` (the same field D7/D8 check as the interact counter) and yields with a 2-frame delay. This transitions the actor into a new interaction/behavior state that D7/D8 will detect on their next tick.

6. **E4/E5 symmetry**: E4 and E5 are always used in pairs (both 17 sites each). They check "does the actor before/after me in the party exist?" — used for formation management where adjacent party members need to coordinate movement.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Player Idle / Interact](player_idle.md) `[D7]`–`[D9]` | E7 sets `$7F100C,X` — the same field D7/D8 test as interact state. E6 checks `$7F0006,X` (actor sub-state) |
| [Facing Control](facing_control.md) `[E1]` | E1 (`face_toward`) is typically called just before E8's proximity check in party AI decision loops |
| [Smooth Movement](smooth_move.md) `[DA]`–`[DC]` | E8 determines distance; DA/DB/DC execute the movement. E3 determines which party member to move toward |
| [Proximity](proximity.md) `[0E]`–`[16]` | E8 is functionally similar to the proximity family but targets party member entities specifically, with facing-adjusted distance |
| [Party Step](party_step.md) `[EA]`–`[EC]` | E8 determines distance; EA/EB/EC execute the actual directional movement steps |
| [Party Swap](party_swap.md) `[ED]`–`[EE]` | E3 dispatches by slot position; ED/EE initiate swaps with adjacent party members |
