# COP family: Party follow

_Deep-audited ops: `[2B]`, `[2C]`, `[2D]`, `[2E]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Recruit / claim a follower slot and step toward the player track tables. Max **6** followers via `$09C8` bits.

## Shared state

- `$09C8` — follower occupancy bitmask
- `$09CA` / `$09D6` — track X/Y words
- `$7F1028,X` — this actor’s follower slot index
- `[2E]` packs a `[98]`/`BRA` epilogue that restores `$7F0028`

## Family notes

- Chase/herd `[2F]`/`[30]` is a **separate** pool (`$09E2`/`$09E4`).

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `2B` | `snap_to_player_if_flag` | 9 | high | Word, &Code | `code_00A887` |
| `2C` | `claim_follower_slot` | 24 | high | (none) | `code_00A8BD` |
| `2D` | `follower_step` | 12 | high | Byte, Word | `code_00A95E` |
| `2E` | `follower_step_anim` | 12 | high | Byte×3, Word (+ packed epilogue) | `code_00AA9E` |

**Family call-site total:** 57

## Opcodes

#### COP [2B] — `snap_to_player_if_flag` (recruit gate)

- **Confidence:** high
- **Preferred name:** `snap_to_player_if_flag`
- **Aliases:** `join_if_flag`, `follow_if_flag`, `branch_if_flag_snap_player`
- **Handler:** `code_00A887` @ `extracted/system/chunk_008000.asm:5571-5599`
- **Parameters:** `Word` flag, `&Code` join body
- **Usage count:** 9

##### What it does

```asm
code_00A887 {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    JSR $&code_00DBEF         ; BCS = flag SET
    BCS do_snap
    JMP $&code_009F00         ; clear → skip &Code, fall through

  do_snap:
    LDA $00
    STA $34
    LDA $02
    STA $36
    JSR $&code_00E2D2         ; clear solid at OLD position
    LDA $0BA6
    CLC
    ADC #$0008
    STA $00                   ; sprite X = player cell X + 8
    LDA $0BA8
    CLC
    ADC #$0010
    STA $02                   ; sprite Y = player cell Y + 16
    LDA $0BAA
    STA $0C                   ; copy player facing
    LDA [$2C]
    STA $02, S                ; RTI → &Code
    RTI
}
```

| Flag state | Result |
|------------|--------|
| **Clear** | Skip `&Code`, continue after `[2B]` (idle / wait path) |
| **Set** | Clear old occupancy, warp onto player hotspot, copy facing, jump to `&Code` |

Does **not** mark the new cell solid — join bodies start with `COP [45]` (`solid_off`).

##### How it is used

Always the **gate** into follower setup:

```asm
; fathers_house/actor_07A684.asm
code_07A69D {
    COP [2B] ( #$01BC, &code_07A6B8 )  ; recruited?
    COP [75] ( #$81BB )                ; else wait / idle setup
    …
}

code_07A6B8 {
    COP [45]                           ; solid_off
    COP [2C]                           ; claim_follower_slot
    ; follow loop ([CB] / [2D] / [98]) …
}
```

Same skeleton in illusion forest (`#$004F`), Prinky (`#$0062`), system robots (`#$0324`), etc.

| Item | Value |
|------|-------|
| Suggested alias | `snap_to_player_if_flag #flag, &join` |
| Flag test | `code_00DBEF` (same as `[0B]`) |
| Pairs with | `[45]` → `[2C]` → `[2D]` follow loop |

- **Source examples:**
  - `fathers_house/actor_07A684.asm:19` — `#$01BC`
  - `forest_of_illusions/illusion_warning/actor_06AC68.asm:10` — `#$004F`
  - `prinkys_mansion/actor_06E420.asm:18` — `#$0062`
  - `system/actor_04BB2E.asm:107` — `#$0324` (poll via `[CD]`)

#### COP [2C] — `claim_follower_slot` (join party track)

- **Confidence:** high
- **Preferred name:** `claim_follower_slot`
- **Aliases:** `join_party`, `start_following`, `clear_action_script` (old misnomer)
- **Handler:** `code_00A8BD` @ `extracted/system/chunk_008000.asm:5601-5699`
- **Parameters:** (none)
- **Usage count:** 24

##### What it does

Claims one of **six** follower bits in `$09C8` and arms this actor to track the player:

```asm
code_00A8BD {
    TYX
    LDA #$2000
    TRB $06                     ; clear interact-highlight bit
    LDA #$0000
    STA $7F0028, X              ; clear talk script (can't talk while following)

    ; find lowest free bit in $09C8 → Y = slot 0..5, A = bit mask
    …
    CPY #$0006
    BCS slots_full              ; → skip +$0F to solid_on epilogue

    PHA
    TYA
    ASL
    STA $7F1028, X              ; slot index (word offset)
    TAY
    BEQ claim                   ; slot 0: no proximity gate

    ; slots 1..5: must be within #$11 px of $09CA,Y / $09D6,Y
    ; else → retry path

  claim:
    ; copy player move-table base
    LDX $0EEE
    LDA $7F101C, X
    ; … STA into this actor …
    PLA
    ORA $09C8
    STA $09C8                   ; occupy bit
    LDA $2C
    STA $28                     ; resume at follow loop
    PLA
    PLA
    RTL                         ; yield

  retry:                        ; too far from track point
    ; if flag #$0321 set → TSB $06 #$2000
    ; $28 ← $2C-2  (rewinds to COP opcode; re-run [2C] next frame)
    RTL

  slots_full:
    LDA $2C
    CLC
    ADC #$000F                  ; skip fixed 15-byte follow preamble
    STA $28
    STA $02, S
    RTI                         ; land on COP [44] solid_on
}
```

##### Three outcomes

| Condition | Action |
|-----------|--------|
| Free slot + (slot0 **or** within `$11` of track) | Claim bit, copy player `$7F101C`, clear interact, **RTL** into follow loop |
| Slot free but too far | Rewind to re-execute `[2C]`; maybe set `$06` bit `$2000` if flag `#$0321` |
| All 6 bits taken | Skip **15 bytes** → `COP [44]` reclaim-solid epilogue (no follow) |

The +`$0F` skip matches a **fixed follow preamble** used everywhere:

```
COP [CB]                          ; 2
COP [2D] ( #xx, #$flag ) …        ; 5   — or COP [2E] (…11 ops…) = 13 with CB
COP [98]                          ; 2
BRA loop                          ; 2
<4 bytes padding>                 ; BRK/NOP or INX/LDX/NOP
COP [44]                          ; ← slots-full landing
```

(`native_village` uses `[2E]` instead of `[2D]`/`[98]`/`BRA`; `CB`+`2E` alone = 15 bytes.)

Track positions `$09CA`/`$09D6` are maintained from player `$0BB6`/`$0BB8` (`chunk_0B8000.asm` `loc_0BEEDD`). Cleared on scene reset by `code_009C30`.

##### Canonical recruit chain

```asm
    COP [2B] ( #$01BC, &join )
    ; … idle while flag clear …

join:
    COP [45]                    ; solid_off
    COP [2C]                    ; claim_follower_slot
follow:
    COP [CB]
    COP [2D] ( #08, #$01BB )    ; step toward player / exit on flag
    COP [98]
    BRA follow
    ; 4-byte pad
    COP [44]                    ; solid_on if party was full
```

| Item | Value |
|------|-------|
| Suggested alias | `claim_follower_slot` |
| Max followers | 6 (`$09C8` bits 0–5) |
| Side effects | Clears `$7F0028`; `TRB $06 #$2000`; may `TSB` on retry |

- **WRAM:** `$09C8`, `$09CA`, `$09D6`, `$06`, `$28`, player `$7F101C` → self, `$7F1028`, `$7F0028`
- **Source examples:**
  - `fathers_house/actor_07A684.asm:33` — after `[2B]`/`[45]`
  - `fathers_house/chicken_farm/actor_07A575.asm:24` — chicken recruit
  - `system/actor_04BB2E.asm:120` — system companion
  - `native_village/native_village/actor_07B7D4.asm:38` — `[2C]` then `[2E]`

##### Related (`[2B]`–`[2C]` recruit / claim)

| Op | Name | Role |
|----|------|------|
| `[2B]` | `snap_to_player_if_flag` | If flag set, warp onto player → join body |
| `[2C]` | `claim_follower_slot` | Occupy `$09C8` bit and enter follow preamble |

`[2A]` (`set_move_profile`) belongs with **wander** (`[28]`/`[29]`), not recruit. Full party-follow set continues at `[2D]`/`[2E]`.

#### COP [2D] — `follower_step` (one step toward player track)

- **Confidence:** high (full handler walkthrough)
- **Preferred name:** `follower_step`
- **Aliases:** `follow_player`, `play_sfx_or_effect` (old misnomer)
- **Handler:** `code_00A95E` → shared core `code_00A965` @ `extracted/system/chunk_008000.asm:5701-5870`
- **Parameters (runtime):** `Byte` anim_adj, `Word` exit_flag
- **Usage count:** 12

##### What it does

`[2D]` clears absolute anim scratch `$0004`/`$0006`, then shares the follower core with `[2E]`:

```asm
code_00A95E {
    TYX
    STZ $0004
    STZ $0006
    ; fall into code_00A965
}

code_00A965 {
    LDA #$2000
    TRB $06
    LDA #$0321
    JSR $&code_00DBEF
    BCC +
    LDA #$2000
    TSB $06                    ; optional interact-highlight while following
+
    LDA [$2C]                  ; anim_adj
    INC $2C
    AND #$00FF
    SEC
    SBC #$0004
    STA $0008                  ; used when $7F101A & 3 == 3
    LDA [$2C]                  ; exit_flag
    INC $2C
    INC $2C
    CMP #$FFFF
    BEQ keep_following         ; #$FFFF = never auto-dismiss
    JSR $&code_00DBEF
    BCC keep_following         ; flag clear → still following
    JMP $&code_00AA6F          ; flag SET → dismiss

  keep_following:
    ; if dialog busy ($05AE) or player not on cell grid → idle yield (code_00AA37)
    ; else:
    LDA $0BAE
    STA $7F101A, X             ; mirror player move profile
    LDA $0BAC
    STA $30                    ; player move mode
    LDY $7F1028, X             ; follower slot → $09CA/$09D6
    ; compare actor vs track point → facing in $32/$0C
    ; JSR code_00E3BA → $1C or $1E velocity
    ; if $30==2 (player “mode 2”), also copy $09FE/$0A00/$09FA/$09FC
    ; success: STA $28/$02,S = $2C (points at following COP [98])
    ; fail: bounce anim via $0006, RTL yield
}

; dismiss (code_00AA6F):
;   clear this actor's bit in $09C8
;   $2C += 4                ; skip COP [98] + BRA (see packed epilogue)
;   $7F0028 ← word at $2C   ; restore interact (often $0000 / pad)
;   RTI past that word      ; usually lands on COP [44]
```

##### Packed follow epilogue

Every `[2D]` site is written as:

```asm
    COP [CB]
    COP [2D] ( #08, #$01BB )   ; or #$FFFF = no flag dismiss
    COP [98]
    BRA loop
    ; 2–4 bytes: interact-restore word and/or pad
    COP [44]                   ; solid_on after dismiss / party-full
```

On a successful step, `$2C` already points at `COP [98]` — the step-wait runs, then `BRA` returns to `[CB]`. On dismiss, `code_00AA6F` skips those 4 bytes and treats the next word as the restored `$7F0028` interact pointer (`BRK #$00` pads → `$0000`).

##### Operands

| Operand | Role |
|---------|------|
| `#anim_adj` | Stored as `adj−4` in `$0008`; added to walk anim when `$7F101A & 3 == 3` |
| `#exit_flag` | `#$FFFF` = never; else dismiss when flag **set** |

| Item | Value |
|------|-------|
| Suggested alias | `follower_step #adj, #flag` |
| Requires | Prior `[2C]` (slot in `$7F1028` / bit in `$09C8`) |
| Pairs with | `[CB]` / `[98]` / `[44]` |

- **Source examples:**
  - `fathers_house/actor_07A684.asm:37` — `#08, #$01BB`
  - `fathers_house/chicken_farm/actor_07A575.asm:28` — `#08, #$FFFF`
  - `system/actor_04BB2E.asm:124` — `#0C, #$0325`
  - `prinkys_mansion/actor_06E420.asm:27` — `#0D, #$005C`

#### COP [2E] — `follower_step_anim` (follower step + custom anim)

- **Confidence:** high
- **Preferred name:** `follower_step_anim`
- **Aliases:** `follow_player_ex`, `cop_2e`
- **Handler:** `code_00AA9E` @ `extracted/system/chunk_008000.asm:5872-5885` → `code_00A965`
- **Parameters (runtime):** `#anim_base, #bounce_add, #anim_adj, #exit_flag`
- **Usage count:** 12

##### What it does

```asm
code_00AA9E {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    SEC
    SBC #$0004
    STA $0004              ; walk anim = facing + base  (same trick as [29])
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $0006              ; bounce anim add
    JMP $&code_00A965      ; identical follower core as [2D]
}
```

So `[2E]` = `[29]`-style anim bias + `[2D]` follower logic.

##### Copdef vs reality

`us/copdef.json` lists 11 operand bytes:

`Byte, Byte, Byte, Word, Word, Word, &Code`

The handler only **reads** the first four fields (`3×Byte + Word`). The trailing six bytes are the **packed epilogue** that every site emits, mis-parsed as operands:

| Bytes (LE) | Actual code |
|------------|-------------|
| `#$9802` | `COP [98]` (`$02,$98`) |
| `#$F380` | `BRA $F3` (−13 → back to `COP [CB]`) |
| `&Code` / `#$0000` | Interact restore for dismiss (`code_00AA6F`) |

Verified: BRA offset `$F3` = −13 = size of `COP [CB]` (2) + `[2E]` core (7) + `COP [98]` (2) + `BRA` (2).

Disassembled form (what you see in extracted ASM):

```asm
COP [2E] ( #08, #00, #0B, #$FFFF, #$9802, #$F380, &code_05C4AE )
COP [44]
```

Runtime-equivalent:

```asm
COP [2E] ( #08, #00, #0B, #$FFFF )   ; true operands
COP [98]
BRA loop                              ; $F3
DW &code_05C4AE                       ; restore interact on dismiss
COP [44]
```

##### Operand meanings

| Operand | Role |
|---------|------|
| `#anim_base` | `$0004 = base−4` → walk anim `facing+base` |
| `#bounce_add` | `$0006` → bounce/idle frame add |
| `#anim_adj` | Same as `[2D]` `$0008` |
| `#exit_flag` | `#$FFFF` / `#$0000` / story flag |

Common pattern: `#08,#00,#xx,#$FFFF` with interact restore pointing at the NPC’s talk script (re-enable talk after follow ends).

| Item | Value |
|------|-------|
| Suggested alias | `follower_step_anim #base,#bounce,#adj,#flag` |
| Relation | Prefixed `[2D]`; dismiss restores `$7F0028` from packed `&Code` |

- **Source examples:**
  - `rococo/cokers_house/actor_05C481.asm:21` — restore `&code_05C4AE`
  - `native_village/native_village/actor_07B7D4.asm:40` — `#15,#00,#08,#$FFFF`
  - `unorganized/map_127/actor_0AEA1F.asm:19` — `#18,#10,#08,#$0000` + null interact
  - `volcano_base/.../actor_099867.asm:45` — `#08,#00,#1D,#$0000`

##### Related (`[2B]`–`[2E]` party follow)

| Op | Name | Role |
|----|------|------|
| `[2B]` | `snap_to_player_if_flag` | Recruit gate: warp onto player if flag set |
| `[2C]` | `claim_follower_slot` | Occupy `$09C8` bit |
| `[2D]` | `follower_step` | Step toward `$09CA/$09D6` |
| `[2E]` | `follower_step_anim` | Same + walk/bounce anim; packed `[98]`/`BRA` epilogue |

Chase/herd (`[2F]`/`[30]`) is a **separate** system (`$09E2`/`$09E4`), not party follow.
