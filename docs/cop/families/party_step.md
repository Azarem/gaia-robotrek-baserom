# Party Step (`[EA]`–`[EC]`)

Three system-only opcodes implementing directional tile-aware movement for party member actors. EA scans tiles and classifies terrain; EB initiates a directional step with collision checking; EC counts down the movement and yields each frame.

## Overview

| Op | Name | Operands | Action | Uses |
|----|------|----------|--------|-----:|
| `EA` | `tile_scan_classify` | Byte, &Code | Scan tiles in facing direction, classify terrain → `$30` | 17 |
| `EB` | `party_step_start` | Byte, &Code | Set direction + check passability + set velocity | 91 |
| `EC` | `party_step_tick` | _(none)_ | Decrement direction counter, yield or continue | 91 |

---

## `[EA]` — `tile_scan_classify`

Probes tiles in a facing-dependent direction and classifies the terrain type into `$30`. On passable terrain, skips the &Code operand and continues. On blocked, branches to &Code.

### Handler: `code_00D4BA`

```
TYX
LDA $00 : SEC : SBC #$0008 : STA $34   ; probe X = actor X - 8
LDA $02 : SEC : SBC #$0010 : STA $36   ; probe Y = actor Y - 16
LDA [$2C] : INC $2C : AND #$00FF       ; read Byte (direction mode)
BNE alternate_direction

; Byte == 0: perpendicular scan
LDA $0A : BIT #$4000
BNE facing_left
JSR code_00DEB5                          ; facing right → scan DOWN
BCS blocked
BRA classify

facing_left:
JSR code_00DDF4                          ; facing left → scan UP
BCS blocked

classify:
LDY #$0000
LDA $32                                  ; tile type from helper
BIT #$00F0 : BNE done                   ; high nibble set (occupied) → Y=0
AND #$000F
INY : CMP #$000F : BEQ done             ; solid → Y=1
INY : CMP #$0006 : BEQ done             ; type 6 → Y=2
INY : CMP #$0007 : BEQ done             ; type 7 → Y=3
INY : CMP #$000B : BEQ done             ; type 11 → Y=4

done:
STY $30                                  ; $30 = terrain class (0-4)
skip &Code → RTI                         ; continue script

blocked:
LDA [$2C]                                ; read &Code
BEQ classify                             ; &Code==0 → treat as passable, classify anyway
STA $02,S : RTI                          ; jump to &Code

; Byte != 0: along-facing scan
alternate_direction:
STA $0010                                ; save Byte as tile scan count
LDA $0A : BIT #$4000
BNE left_scan
JSR code_00DD06                          ; facing right → scan RIGHT
BCS blocked
BRA classify

left_scan:
JSR code_00DC26                          ; facing left → scan LEFT
BCS blocked → classify
```

### Direction logic

| Byte | Facing right | Facing left |
|------|-------------|-------------|
| `#00` | Scan DOWN (`code_00DEB5`) | Scan UP (`code_00DDF4`) |
| `≠0` | Scan RIGHT (`code_00DD06`, Byte tiles) | Scan LEFT (`code_00DC26`, Byte tiles) |

### Terrain classification (`$30`)

| Value | Tile condition | Meaning |
|------:|---------------|---------|
| 0 | High nibble ≠ 0 (occupied by entity) | Blocked/occupied |
| 1 | `$0F` (solid) | Wall |
| 2 | `$06` | Special terrain A |
| 3 | `$07` | Special terrain B |
| 4 | `$0B` | Special terrain C |

### Tile collision helpers

| Helper | Direction | Also used by |
|--------|-----------|-------------|
| `code_00DEB5` | Down | `[BD]` tile_collision_down |
| `code_00DDF4` | Up | `[BC]` tile_collision_up |
| `code_00DD06` | Right | Multi-tile scan (new) |
| `code_00DC26` | Left | Multi-tile scan (new) |

The right/left helpers (`code_00DD06`, `code_00DC26`) are extended versions that scan multiple tiles (up to `$0010` count) across the actor's bounding box, using `code_08F479` (step right) / `code_08F4AA` (step left) and `code_08F4DD` (step up) for multi-row scanning.

### Operand distribution

All 17 call sites use `Byte = #00` (perpendicular scan mode). The along-facing mode (Byte ≠ 0) exists in the handler but is unused in practice.

### Source examples

| File | Call | Context |
|------|------|---------|
| `chunk_02E9AA.asm:1368` | `COP [EA] ( #00, &code_02F50B )` | Tile scan before movement |
| `chunk_038000.asm:6603` | `COP [EA] ( #00, &code_03B8D2 )` | Player host tile check |

---

## `[EB]` — `party_step_start`

Initiates a directional movement step for a party member. Checks tile passability in a facing-dependent direction, then sets velocity and animation. The Byte operand encodes both direction and step count.

### Handler: `code_00D538`

```
TYX
LDA $2C : DEC : DEC
STA $7F002A,X                      ; save script pointer for re-entry
STZ $000A                           ; clear inversion flag
LDA $7F0028,X : BNE use_saved     ; if direction already saved, use it
LDA [$2C] : AND #$00FF
STA $7F0028,X                      ; save Byte as direction

use_saved:
BIT #$0080 : BEQ no_invert        ; bit 7 = inversion flag
INC $000A                           ; set inversion flag

no_invert:
INC $2C                             ; advance past Byte
LDA $00 : SEC : SBC #$0008 : STA $34
LDA $02 : SEC : SBC #$0010 : STA $36

; Direction + facing → tile check:
LDA $0A : BIT #$4000
BNE facing_left
LDA $000A : BNE inverted           ; inversion flag?

; Facing right, not inverted → check DOWN:
JSR code_00DEB5
BCS blocked
LDA #$0003 : STA $0C               ; direction = 3 (down)
BRA success

facing_left:
LDA $000A : BNE normal_dir         ; if inverted, swap to down

inverted:
; Check UP:
JSR code_00DDF4
BCS blocked
LDA #$0002 : STA $0C               ; direction = 2 (up)

success:
JSR code_00E4E1                     ; update player direction state
JSR code_00E462                     ; compute animation + velocity
STA $1C                             ; set X velocity
STZ $10                             ; clear frame counter
BCS blocked
LDA $2C : INC : INC : STA $02,S : RTI  ; skip &Code, continue

blocked:
LDA #$0000 : STA $7F0028,X        ; clear direction
LDA [$2C] : STA $02,S : RTI       ; jump to &Code
```

### Byte encoding

| Bits | Meaning |
|------|---------|
| 6–0 | Direction / step count (stored in `$7F0028,X`) |
| 7 | Inversion flag — swaps up↔down relative to facing |

### Direction mapping

| Facing | Bit 7 | Tile check | `$0C` value |
|--------|-------|-----------|-------------|
| Right | 0 | DOWN (`code_00DEB5`) | 3 |
| Right | 1 | UP (`code_00DDF4`) | 2 |
| Left | 0 | UP (`code_00DDF4`) | 2 |
| Left | 1 | DOWN (`code_00DEB5`) | 3 |

### Byte values observed

| Byte | Count | Meaning |
|-----:|------:|---------|
| `#02` | 24 | 2-step, normal |
| `#03` | 33 | 3-step, normal |
| `#04` | 12 | 4-step, normal |
| `#82` | 12 | 2-step, inverted |
| `#83` | 6 | 3-step, inverted |
| `#84` | 4 | 4-step, inverted |

### WRAM fields

| Address | Role |
|---------|------|
| `$7F0028,X` | Saved direction byte (persists across EB↔EC loop) |
| `$7F002A,X` | Saved script pointer (re-entry for EC yield) |
| `$0C` | Direction code: 2 = up, 3 = down |
| `$1C` | X velocity (set from `code_00E462` result) |

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_02E9AA.asm:30` | `COP [EB] ( #03, &code_02E9D5 )` | 3-step down, fallback to E9D5 |
| `actor_02E9AA.asm:104` | `COP [EB] ( #82, &code_02E9B4 )` | 2-step inverted, fallback |
| `actor_02F429.asm:37` | `COP [EB] ( #03, &code_02F463 )` | 3-step normal |

---

## `[EC]` — `party_step_tick`

Decrements the direction counter in `$7F0028,X` and yields. When the counter reaches 1 (which computes to 0), the movement is complete and the script continues.

### Handler: `code_00D5B3`

```
TYX
SEP #$20                           ; 8-bit mode
LDA $7F0028,X                     ; load direction/count
BEQ done                            ; if 0 → already done
ASL                                  ; × 2
DEC : DEC                           ; - 2
BEQ done                            ; if 0 → movement complete
ROR                                  ; ÷ 2 (carry from ASL restores bit 7)
STA $7F0028,X                     ; save decremented value (bit 7 preserved)
REP #$20
LDA $7F002A,X : STA $28           ; restore saved script PC as resume
PLA : PLA : RTL                    ; yield (1 frame)

done:
STA $7F0028,X                     ; clear direction field
REP #$20
LDA $2C : STA $02,S : RTI        ; continue script
```

### Decrement logic

The ASL → DEC → DEC → ROR sequence effectively decrements the low 7 bits by 1 while preserving bit 7 (the inversion flag):

| Input | ASL | -2 | ROR | Result |
|------:|----:|---:|----:|-------:|
| `#04` | `#08` | `#06` | `#03` | 4→3 |
| `#03` | `#06` | `#04` | `#02` | 3→2 |
| `#02` | `#04` | `#02` | `#01` | 2→1 |
| `#01` | `#02` | `#00` | done | 1→done |
| `#82` | `#04` (C=1) | `#02` | `#81` | 82→81 (bit 7 preserved) |
| `#81` | `#02` (C=1) | `#00` | done | 81→done |

### EB↔EC loop pattern

The typical usage is:
```asm
    COP [EB] ( #03, &fallback )  ; start: set direction, check tile, set velocity
    COP [51]                      ; step_begin (movement bracket)
    COP [98]                      ; wait_anim_frames
    COP [52]                      ; step_end
    COP [EC]                      ; tick: decrement counter, yield or continue
```

EC yields with the saved resume point from EB's `$7F002A,X`, so execution loops back to EB on the next frame. EB checks if `$7F0028,X` is already set (nonzero) and reuses the saved direction rather than re-reading the Byte operand. This creates a multi-frame movement loop that runs for the step count encoded in Byte.

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `EA` | `tile_scan_classify` | 17 |
| `EB` | `party_step_start` | 91 |
| `EC` | `party_step_tick` | 91 |
| | **Total** | **199** |

## Family notes

1. **System-only**: All 199 call sites are in system chunks (`actor_02Exxx`, `chunk_038000.asm`).

2. **EB↔EC loop**: EB and EC always appear as a pair (both 91 sites). EB sets up the first step; EC counts down and yields. On the next frame, EB re-enters with the saved direction and continues stepping.

3. **Movement bracket**: EB/EC wrap a standard `[51]`/`[98]`/`[52]` movement bracket, meaning the actual pixel-level movement uses the same walk-step system as regular actors.

4. **Tile collision reuse**: EA and EB reuse the same tile collision helpers as `[BA]`–`[BD]`: `code_00DEB5` (down), `code_00DDF4` (up). EA additionally uses extended multi-tile variants `code_00DD06` (right) and `code_00DC26` (left).

5. **Terrain classification**: EA's `$30` result (0–4) is used by subsequent inline code to select walking animation, velocity, or special-case handling (stairs, ice, etc.).

6. **Direction persistence**: `$7F0028,X` persists across the EB↔EC yield loop. EB only reads the Byte operand on the first iteration (when `$7F0028,X` is 0). On subsequent ticks, it reuses the saved value. EC clears it when the countdown completes.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Party AI Control](party_ai.md) `[E3]`–`[E9]` | E8 proximity check determines distance; EA/EB/EC execute the movement. E3 determines which direction to move |
| [Tile Collision](tile_collision.md) `[BA]`–`[BD]` | Shares tile scan helpers (`code_00DEB5`, `code_00DDF4`); EA uses extended multi-tile variants |
| [Movement / Walk Steps](movement.md) `[51]`–`[55]` | EB/EC wrap `[51]`/`[52]` step brackets for actual pixel movement |
| [Player Move Response](player_move_response.md) `[BE]`–`[C0]` | EB calls `code_00E4E1` (direction state) and `code_00E462` (animation/velocity) — the same helpers used by the player move response family |
| [Party Swap](party_swap.md) `[ED]`–`[EE]` | After EB/EC complete a step sequence, ED/EE may initiate position swaps if party members need to cross |
