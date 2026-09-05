# Facing Control (`[DD]`–`[E1]`)

Five opcodes that modify the actor's facing/flip state in `$0A` and advance one animation frame. All share the same epilogue: `STZ $10 : JSL code_04FC71 : STZ $10 : STZ $0E : LDA $2C : STA $02,S : RTI`. `[E2]` is a related unused proximity branch that shares the party member lookup mechanism.

## Overview

| Op | Name | Operands | Effect on `$0A` | Uses |
|----|------|----------|-----------------|-----:|
| `DD` | `toggle_facing` | (none) | `EOR #$4000` (toggle h-flip) | 24 |
| `DE` | `toggle_vflip` | (none) | `EOR #$8000` (toggle v-flip) | 0 |
| `DF` | `face_right` | (none) | `TRB #$4000` (clear h-flip) | 21 |
| `E0` | `face_left` | (none) | `TSB #$4000` (set h-flip) | 20 |
| `E1` | `face_toward` | (none) | set/clear `#$4000` based on target | 103 |

### Shared epilogue

After modifying `$0A`, all five (and E2) execute:

```
STZ $10                ; clear animation frame counter
JSL code_04FC71        ; advance one animation frame
STZ $10                ; re-clear frame counter
STZ $0E                ; clear delay counter
LDA $2C : STA $02,S   ; continue
RTI
```

This ensures the actor's sprite immediately reflects the new facing.

---

## `[DD]` — `toggle_facing`

Toggles horizontal facing (left ↔ right).

### Handler: `code_00D17F`

```
TYX
LDA $0A : EOR #$4000 : STA $0A   ; toggle bit 14 (h-flip)
; ... shared epilogue ...
```

### Usage (24 sites)

Used in party member actors and the player controller when the actor needs to turn around. All call sites are in system chunks.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:227` | `COP [DD]` | Party member: turn around |
| `actor_02F55D.asm:218` | `COP [DD]` | Party member: flip during movement |
| `chunk_038000.asm:9767` | `COP [DD]` | Player controller: toggle facing |

---

## `[DE]` — `toggle_vflip`

Toggles vertical flip.

### Handler: `code_00D196`

```
TYX
LDA $0A : EOR #$8000 : STA $0A   ; toggle bit 15 (v-flip)
; ... shared epilogue ...
```

### Usage (0 sites)

**Unused.** Not listed in `copdef.json`. Toggles bit 15 (SNES OAM vertical flip), which would invert the sprite vertically. Likely reserved for a visual effect never implemented.

---

## `[DF]` — `face_right`

Sets facing to right (clears h-flip).

### Handler: `code_00D1AD`

```
TYX
LDA #$4000 : TRB $0A             ; clear bit 14 → face right
; ... shared epilogue ...
```

### Usage (21 sites)

Used in the player controller and battle system when the actor must face right explicitly, rather than toggling or inferring direction.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_04E60C.asm:9` | `COP [DF]` | Title screen: face right |
| `chunk_038000.asm:3776` | `COP [DF]` | Player: face right before step |
| `chunk_0B8000.asm:5867` | `COP [DF]` | Battle system: face right |
| `actor_04F0FA.asm:80` | `COP [DF]` | Map: face right |

---

## `[E0]` — `face_left`

Sets facing to left (sets h-flip).

### Handler: `code_00D1C2`

```
TYX
LDA #$4000 : TSB $0A             ; set bit 14 → face left
; ... shared epilogue ...
```

### Usage (20 sites)

Paired with DF — used in the same system chunks when the actor must face left explicitly. DF and E0 call sites often appear in alternating code paths (left-branch vs right-branch of facing checks).

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_04E5C1.asm:12` | `COP [E0]` | Title screen: face left |
| `chunk_038000.asm:3763` | `COP [E0]` | Player: face left before step |
| `actor_04CEE3.asm:10` | `COP [E0]` | Credits: hero faces left |

---

## `[E1]` — `face_toward`

Sets facing toward a target party member's position.

### Handler: `code_00D1D7`

```
TYX
LDA $7F0008,X : TAY              ; Y = party slot index
LDA $06 : BIT #$0400             ; secondary character check
BEQ primary
LDA $0A08,Y : BEQ no_target     ; secondary: check $0A08[Y]
BRA face_calc

primary:
LDA $0A02,Y : BNE face_calc     ; primary: check $0A02[Y]
; Fallback: scan slots 0-3
LDY #$0000
LDA $0A02,Y : BNE face_calc
LDA $0A04,Y : BNE face_calc
LDA $0A06,Y : BEQ no_target

face_calc:
TAY                               ; Y = target entity address
LDA $0000,Y                       ; target X position
CMP $00                           ; compare to actor X
BEQ edge_check                    ; equal → screen-edge special case
BCS face_right                    ; target > actor → face right
LDA $0A : ORA #$4000 : BRA save  ; target < actor → face left

face_right:
LDA $0A : AND #$BFFF             ; clear h-flip → face right

save:
STA $0A

no_target:
; ... shared epilogue ...

edge_check:
; If X positions are equal and actor is near screen edges (< 33 or ≥ 224):
LDA $00 : AND #$00FF
CMP #$0021 : BCC flip            ; near left edge → toggle
CMP #$00E0 : BCC no_change       ; in center → no change
flip:
LDA $0A : EOR #$4000 : STA $0A  ; toggle facing
BRA epilogue
```

### Usage (103 sites)

The **most-used** op in this family — used before every movement decision in party member actors. The pattern is typically `COP [E1]` followed by `COP [EB]` (step/walk command) or `COP [D8]` (idle loop). All 103 sites are in system chunks.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:25` | `COP [E1]` | Party member: face toward leader before walking |
| `actor_02EDE2.asm:27` | `COP [E1]` | Party member: face toward target |
| `actor_02EF9F.asm:24` | `COP [E1]` | Party member: face toward target |
| `actor_02F770.asm:29` | `COP [E1]` | Party member: face toward target |

---

## `[E2]` — `proximity_branch_toward` (unused)

A proximity-based 3-way branch toward a target party member. **Not listed in `copdef.json`. 0 call sites.**

### Handler: `code_00D241`

Uses the same party member lookup as E1 (`$7F0008,X` → `$0A02,Y`/`$0A08,Y`), but instead of setting facing, it computes the distance between the actor and target (accounting for footprint offsets `$7F000E,X`/`$7F0016,X`) and branches to one of three inline word targets:

| Offset | Condition |
|-------:|-----------|
| `[$2C]+0` | Threshold value (Word) |
| `[$2C]+2` | Target is left and distance ≥ threshold |
| `[$2C]+4` | Default (distance < threshold, or positions equal) |
| `[$2C]+6` | Target is right and distance ≥ threshold |

If no target entity exists, skips 8 bytes (past all four words).

Inline layout: `Word (threshold), &Code (left), &Code (center), &Code (right)` = 8 bytes.

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `DD` | `toggle_facing` | 24 |
| `DE` | `toggle_vflip` | 0 |
| `DF` | `face_right` | 21 |
| `E0` | `face_left` | 20 |
| `E1` | `face_toward` | 103 |
| `E2` | `proximity_branch_toward` | 0 |
| | **Total** | **168** |

## Family notes

1. **System-only ops**: All 168 call sites are in system chunks. DD is in party member actors (`actor_02Exxx`); DF/E0 are in the player controller and battle system (`chunk_038000`, `chunk_0B8000`); E1 is the most broadly used across party member actors.

2. **DF/E0 pairing**: In `chunk_038000.asm`, DF and E0 often appear in alternating code paths of facing-conditional blocks. Line 3763 uses E0 (face left), line 3776 uses DF (face right) — mirror-image handlers for left/right directions.

3. **E1 dominance**: E1 (103 sites) accounts for 61% of this family. It's the standard "face toward target" op used before every movement decision in party member AI.

4. **Shared epilogue**: All ops reset both `$10` (frame counter) and `$0E` (delay counter) to 0 after calling `code_04FC71`. This ensures the actor is in a clean animation state after the facing change — ready for the next animation command.

5. **OAM attribute bits**: Bit 14 (`#$4000`) is the SNES OAM horizontal flip. Bit 15 (`#$8000`) is the vertical flip. The high byte of `$0A` maps directly to OAM attribute byte `vhoopppc` (see [Sprite Attribute Set](sprite_attribs.md)).

6. **DE/E2 unused**: Both DE and E2 exist in the jump table but have 0 call sites and are not in `copdef.json`. DE toggles vertical flip (potentially for upside-down effects); E2 implements a distance-threshold branch that was likely replaced by simpler logic.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Sprite Attribute Set](sprite_attribs.md) `[C5]`–`[C7]` | `[C5]` sets priority, `[C6]` palette, `[C7]` name table — all in `$0A` high byte. DD–E0 modify the facing/flip bits in the same word |
| [Player Idle / Interact](player_idle.md) `[D7]`–`[D9]` | D7 uses facing (anim 2/3 based on `$0A` bit 14); E1 is often called just before D8 to face toward the party leader |
| [Smooth Movement](smooth_move.md) `[DA]`–`[DC]` | DA's alternate path (`$0B12 < 0`) can flip `$0A #$4000`; E1 sets facing before DA/DB movement |
| [Proximity](proximity.md) `[0E]`–`[16]` | E2's distance-branch pattern is similar to the proximity family's axis-based branching, but E2 targets party members specifically |
