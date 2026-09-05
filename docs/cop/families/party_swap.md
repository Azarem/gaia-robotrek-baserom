# Party Swap (`[ED]`–`[F0]`)

Four system-only opcodes implementing position swaps between adjacent party members. ED/EE initiate the swap (phase 1: snapshot positions, stage data, yield). EF/F0 execute the swap (phase 2: move entities, reassign slots, yield). ED+EF swap with the previous member; EE+F0 swap with the next.

## Overview

| Op | Name | Operands | Action | Uses |
|----|------|----------|--------|-----:|
| `ED` | `swap_prev_start` | &Code | Initiate swap with previous party member | 67 |
| `EE` | `swap_next_start` | &Code | Initiate swap with next party member | 67 |
| `EF` | `swap_prev_exec` | _(none)_ | Execute swap with previous member | 67 |
| `F0` | `swap_next_exec` | _(none)_ | Execute swap with next member | 67 |

---

## `[ED]` — `swap_prev_start`

Initiates a position swap with the previous party member (slot − 2). Snapshots current positions, stages swap data in `$0AF6,Y`, saves &Code as the swap completion handler, and yields.

### Handler: `code_00D5DC`

```
TYX : PHX
; Determine search range based on character type:
LDY #$0000
LDA $06 : BIT #$0400               ; secondary character?
BNE skip
LDY #$0006                          ; primary → search secondary range
skip:
STY $0000                           ; $0000 = search start offset
TYA : CLC : ADC #$0006 : STA $0002 ; $0002 = search end

JSL code_04FE07                     ; snapshot all party member positions
                                     ; copies $0000,X → $0AC2,Y and $0002,X → $0ACE,Y

LDA $7F0008,X : BEQ no_prev        ; slot 0 → no previous
DEC : DEC                           ; slot − 2
CLC : ADC $0000 : TAY
LDA $0A02,Y : BEQ setup            ; no entity → still set up (vacate)

; Entity found — check if it's busy:
PHA : TAY
LDA $0008,Y : BIT #$0002           ; bit 1 of entity $08 (busy flag)
BNE busy                            ; if busy → abort swap

; Stage swap data:
LDY $0000
LDA $0004,X : STA $0AF6,Y         ; copy caller's $04 → $0AF6[start]
INY : INY : PLX
LDA $0004,X : STA $0AF6,Y         ; copy target's $04 → $0AF6[start+2]

setup:
PLX
LDA [$2C] : INC $2C : INC $2C     ; read &Code
STA $7F2004,X                      ; save as swap completion handler
LDA $2C : STA $28                   ; set current PC as resume
PLA : PLA : RTL                     ; yield

busy:
PLA
no_prev:
PLX
LDA $06 : BIT #$0400
BEQ fallback
SEP #$20
LDA #$09 : STA $0879               ; secondary character → play SFX #09
REP #$20
fallback:
LDA [$2C] : STA $02,S : RTI       ; jump to &Code
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| &Code | 2 | Fallback target (jumped to on failure) / swap completion handler (saved to `$7F2004,X` on success) |

---

## `[EE]` — `swap_next_start`

Mirror of ED — initiates a swap with the next party member (slot + 2).

### Handler: `code_00D651`

```
TYX : PHX
; Same search range setup as ED:
LDY #$0000
LDA $06 : BIT #$0400 : BNE skip
LDY #$0006
skip:
STY $0000 : TYA : CLC : ADC #$0006 : STA $0002

JSL code_04FE07                     ; snapshot positions

LDA $7F0008,X : STA $0004
CMP #$0004 : BCS no_next           ; slot ≥ 4 → no next

INC : INC                           ; slot + 2
CLC : ADC $0000 : TAY
LDA $0A02,Y : BNE found
JMP setup                           ; no entity → vacate setup

found:
JMP swap_staging                    ; → shared code_00D60C (same as ED)
```

Shares `code_00D60C` (swap staging) and `code_00D628` (setup + yield) with ED.

---

## Shared mechanisms

### Position snapshot: `code_04FE07`

Called by both ED and EE before the swap. Iterates through party entity slots from `Y` to `$0002`, copying each entity's position:
- `$0000,X` → `$0AC2,Y` (X position cache)
- `$0002,X` → `$0ACE,Y` (Y position cache)

These cached positions are used by `[EF]`/`[F0]` (swap executors) to move entities to their swapped positions.

### Swap staging: `$0AF6,Y`

| Offset | Content | Purpose |
|--------|---------|---------|
| `$0AF6 + start` | Caller's `$04` | Identifies the initiating party member |
| `$0AF6 + start + 2` | Target's `$04` | Identifies the swap partner |

The `start` offset depends on character type: 0 for secondary characters (`$06 bit #$0400` set), 6 for primary characters.

### Swap completion handler: `$7F2004,X`

The &Code operand serves dual purpose:
- **On success**: Saved to `$7F2004,X` for use by `[EF]`/`[F0]` as the swap completion callback
- **On failure**: Jumped to directly as a fallback target

### Busy guard: `$0008 bit #$0002`

If the target entity's `$08` field has bit 1 set (indicating it's busy — e.g., in a swap animation or interaction), the swap is aborted. This prevents conflicting swap operations.

### SFX on secondary failure

When a secondary character (`$06 bit #$0400`) fails to swap, SFX `#$09` is played via `$0879` — likely a "denied" sound effect.

---

## Call site patterns

ED and EE always appear in complementary pairs driven by `[E3]` (party slot search):

```asm
    COP [E3] ( &prev_handler, &own_handler, &next_handler )

prev_handler:
    COP [ED] ( &completion )       ; swap with previous
    COP [EF]                        ; execute swap tick
    BRA loop

next_handler:
    COP [EE] ( &completion )       ; swap with next
    COP [F0]                        ; execute swap tick
    BRA loop

completion:
    COP [E1]                        ; face toward leader
    COP [EB] ( #03, &fallback )    ; start stepping
    ...
```

ED is always followed by `[EF]` (swap-previous executor); EE is always followed by `[F0]` (swap-next executor).

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02F429.asm:24` | `COP [ED] ( &code_02F454 )` | Swap with previous member |
| `actor_02F429.asm:30` | `COP [EE] ( &code_02F454 )` | Swap with next member |
| `actor_02F1F3.asm:80` | `COP [ED] ( &code_02F29D )` | Previous swap |
| `actor_02F55D.asm:52` | `COP [EE] ( &code_02F5C9 )` | Next swap |

---

## `[EF]` — `swap_prev_exec`

Executes the position swap with the previous party member (slot − 2). This is the phase-2 companion to ED.

### Handler: `code_00D68D`

```
TYX : PHX
; Determine search range:
LDY #$0000
LDA $06 : BIT #$0400 : BNE skip
LDY #$0006
skip:
STY $0000 : ...

; Check if swap staging is still active:
LDA $0AF6,Y : ORA $0AF8,Y
BEQ proceed
JMP code_00D77A                     ; staging busy → yield (PLA PLA RTL)

proceed:
LDA #$F000 : TSB $0EE2             ; set DMA flags
LDA $7F0008,X : STA $0004
BNE has_prev
JMP code_00D772                     ; slot 0 → no previous → completion handler ($7F2004,X)

has_prev:
DEC : DEC : PHA                    ; slot − 2
CLC : ADC $0000 : TAY
LDA $0A02,Y : BNE use_cached       ; entity exists → use cached position

; No entity at target — compute position: actor pos - 32 Y (above)
LDA $00 : STA $34
LDA $02 : SEC : SBC #$0020 : STA $36

; Movement validation:
JSR code_00E1AD                     ; check tile passability
JSR code_00E45F                     ; check collision clearance
; If both pass → compute new positions:
JSR code_00E257                     ; update tile state
JSR code_00E2D2                     ; update collision
BRA swap_entities

use_cached:
TAX
LDA $0AC2,Y : STA $34             ; cached X from snapshot
LDA $0ACE,Y : STA $36             ; cached Y from snapshot

swap_entities:
; Swap entity slot assignments:
LDX $0A02,Y                        ; get entity at previous slot
LDA $0004 : CLC : ADC $0000 : TAY
TXA : STA $0A02,Y                 ; move it to caller's slot
BEQ no_entity
LDA $0004 : STA $7F0008,X         ; update its party slot ID
LDA $00 : STA $0000,X             ; set its position to caller's
LDA $02 : STA $0002,X

no_entity:
LDA $34 : STA $00                  ; set caller's position to target
LDA $36 : STA $02
PLY : PLA : PLX
STA $7F0008,X : TXA : STA $0A02,Y  ; register caller in new slot

JSR code_00E375                     ; update movement/collision state
LDA $06 : BIT #$0400 : BNE skip_delay
LDA #$0008 : STA $0E               ; primary chars: 8-frame delay

skip_delay:
LDA $2C : STA $28                   ; set resume
PLA : PLA : RTL                     ; yield
```

### Completion path: `code_00D772`

When the actor has slot 0 (no previous member to swap with), jumps to the completion handler saved by ED in `$7F2004,X`.

### Failure path: `code_00D76B`

When tile/collision checks fail during position computation, restores saved positions and falls through to `code_00D772` (completion handler).

---

## `[F0]` — `swap_next_exec`

Mirror of EF — executes the swap with the next party member (slot + 2).

### Handler: `code_00D77E`

Same structure as EF but:
- Checks `slot < 4` (must have a next member)
- Slot = slot + 2 (next instead of previous)
- Target position for empty slots = `actor Y + 32` (below, instead of above)
- Shares all core execution code (`code_00D711`, `code_00D6DD`, `code_00D71C`) with EF

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `ED` | `swap_prev_start` | 67 |
| `EE` | `swap_next_start` | 67 |
| `EF` | `swap_prev_exec` | 67 |
| `F0` | `swap_next_exec` | 67 |
| | **Total** | **268** |

## Family notes

1. **Perfect symmetry**: All four opcodes have identical call site counts (67 each). Every party member that can initiate a swap can also execute it, in both directions.

2. **System-only**: All 268 call sites are in system-only party member actors (`actor_02Exxx`).

3. **Two-phase swap**: ED/EE initiate (phase 1: snapshot, stage, yield). EF/F0 execute (phase 2: move entities, update slot assignments, yield). The yield between phases allows the engine to process the position snapshot.

4. **Dual-purpose &Code**: ED/EE's &Code serves as both the success continuation (saved to `$7F2004,X` for EF/F0's completion path) and the failure fallback (jumped to on abort).

5. **E3 dispatch**: The typical flow is `[E3]` (which slot found?) → `[ED]` + `[EF]` (previous) or `[EE]` + `[F0]` (next) → completion → `[EB]`/`[EC]` (resume movement).

6. **DMA flag**: Both EF and F0 set `$0EE2 |= #$F000` to trigger DMA updates for the position changes.

7. **Computed positions**: When the target slot has no entity, EF targets 32 pixels above the actor; F0 targets 32 pixels below. When an entity exists, cached positions from `code_04FE07`'s snapshot (`$0AC2`/`$0ACE`) are used.

8. **Tile validation**: The no-entity path validates tile passability (`code_00E1AD`), collision clearance (`code_00E45F`), and updates tile/collision state (`code_00E257`, `code_00E2D2`). The cached-entity path skips validation (positions are known good from the snapshot).

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Party AI Control](party_ai.md) `[E3]`–`[E9]` | E3 dispatches to ED or EE based on party slot search result |
| [Party Step](party_step.md) `[EA]`–`[EC]` | After swap completes, EB/EC resume directional stepping |
| [Audio](../families/audio.md) `[41]` | SFX `#$09` played on secondary character swap failure |
