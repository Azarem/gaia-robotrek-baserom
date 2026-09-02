# Companion Sprite — COP `[7C]` `[7D]`

> Deep-audited ops: `[7C]` `[7D]`

## Overview

Manage the **robot companion's visual appearance** by switching spritemap banks on the companion actor referenced by `$0EEE`. COP `[7C]` conditionally resets the companion sprite when the focus id matches, and COP `[7D]` directly sets the companion to one of two spritemap banks.

| Op | Role | Operands |
|----|------|----------|
| `[7C]` | Conditional companion sprite reset (requires `$0676 == #$4C`) | (none) |
| `[7D]` | Direct companion spritemap switch | Byte (0 = normal, 1 = alternate) |

## Shared state

| Address | Role |
|---------|------|
| `$0EEE` | Pointer to companion actor (robot) direct page |
| `$0676` | Focus / selected tracked id (companion #1 = `#$004C`) |
| `$0678` | Secondary focus id (companion #2 = `#$004D`) |
| `$7F0000,X` / `$7F0002,X` | Companion actor's spritemap pointer (low/high) |
| `$7F101C,X` | Companion actor's spritemap mode |
| `$0006,X` | Companion actor's flags word |

### Spritemap banks

| Bank | Address | Mode | Meaning |
|------|---------|------|---------|
| Normal | `spritemap_0E8000` | `#$0004` | Standard robot companion appearance |
| Alternate | `spritemap_0EC000` | `#$0006` | Transformed / alternate robot appearance |

## Opcodes

---

#### COP [7C] — `companion_sprite_reset` (conditional companion reset)

- **Confidence:** high
- **Preferred name:** `companion_sprite_reset`
- **Aliases:** `reset_companion_sprite`, `check_focus_reset_companion`
- **Handler:** `code_00BDB5` @ chunk_008000.asm:8754–8780
- **Parameters:** (none)
- **Usage count:** 21

##### What it does

```asm
code_00BDB5 {
    TYX
    LDA $0676              ; load focus id
    CMP #$004C             ; companion #1?
    BEQ loc_00BDC3         ; yes → reset
    LDA $2C                ; no → continue (no-op)
    STA $02, S
    RTI

  loc_00BDC3:
    STZ $0676              ; clear focus id
    PHX
    LDX $0EEE             ; companion actor pointer
    LDA $0006, X           ; companion flags
    AND #$DFFF             ; clear bit 13
    STA $0006, X
    LDA #$0004
    STA $7F101C, X         ; mode = 4 (normal)
    LDA #$&spritemap_0E8000
    STA $7F0000, X         ; spritemap low
    LDA #$*spritemap_0E8000
    STA $7F0002, X         ; spritemap high
    PLX
    LDA $2C
    STA $02, S
    RTI
}
```

##### Behavior

1. Check `$0676 == #$004C` (focus id matches companion entity type)
2. If **no match**: do nothing, continue script
3. If **match**:
   - Clear `$0676` (release focus)
   - Clear bit 13 of companion's `$06` flags (likely a "transformed" or "special sprite" flag)
   - Set companion's spritemap to `spritemap_0E8000` (normal) with mode `#$0004`

##### Why / how used

Appears at the start of NPC scripts immediately after spawn gates, as a cleanup step that restores the companion's normal appearance if the focus system left it in a modified state:

```asm
    COP [75] ( #$805E )       ; spawn gate
    COP [7C]                   ; reset companion if needed
    COP [0A] ( #$8000 )       ; set flag
    COP [34] ( #$FF50 )       ; mask input
    ...
```

Most of the 21 call sites are in dungeon/cave actors and boss encounter scripts where the companion may have been visually altered by [7D] or the battle system.

---

#### COP [7D] — `companion_sprite_set` (direct spritemap switch)

- **Confidence:** high
- **Preferred name:** `companion_sprite_set`
- **Aliases:** `set_companion_sprite`, `switch_companion_bank`
- **Handler:** `code_00BDEE` @ chunk_008000.asm:8782–8816
- **Parameters:** `Byte` (sprite bank selector)
- **Usage count:** 2

##### What it does

```asm
code_00BDEE {
    TYX
    PHX
    LDA [$2C]              ; read Byte operand
    INC $2C
    AND #$00FF
    BNE loc_00BE1A         ; non-zero → alternate bank

    ; Byte = 0: normal bank
    LDX $0EEE
    LDA #$0004
    STA $7F101C, X         ; mode = 4
    LDA #$&spritemap_0E8000
    STA $7F0000, X         ; spritemap = 0E8000
    LDA #$*spritemap_0E8000
    STA $7F0002, X
    STZ $0678              ; clear secondary focus id
    PLX
    LDA $2C
    STA $02, S
    RTI

  loc_00BE1A:              ; Byte = 1: alternate bank
    LDX $0EEE
    LDA #$0006
    STA $7F101C, X         ; mode = 6
    LDA #$&spritemap_0EC000
    STA $7F0000, X         ; spritemap = 0EC000
    LDA #$*spritemap_0EC000
    STA $7F0002, X
    LDA #$004D
    STA $0678              ; set secondary focus = companion #2
    PLX
    LDA $2C
    STA $02, S
    RTI
}
```

##### Operand values

| Byte | Spritemap | Mode | `$0678` | Meaning |
|------|-----------|------|---------|---------|
| `#00` | `spritemap_0E8000` | 4 | cleared | Normal robot appearance |
| `#01` | `spritemap_0EC000` | 6 | `#$004D` | Alternate/transformed appearance |

##### Why / how used

Only 2 call sites, both in `volcano_base/base_einst_house/`:

```asm
    ; actor_09A470 — Dr. Einst transforms the robot
    COP [03] ( @code_04BF4D )     ; call transformation routine
    COP [D0] ( #$0010 )           ; delay
    COP [7D] ( #01 )              ; switch to alternate sprite

    ; actor_09A84F — Restore robot to normal
    COP [03] ( @code_04BF4D )     ; call routine
    COP [D0] ( #$0010 )           ; delay
    COP [7D] ( #00 )              ; restore normal sprite
```

## Usage statistics

| Op | Name | Sites | Files |
|----|------|------:|------:|
| `[7C]` | `companion_sprite_reset` | 21 | 20 |
| `[7D]` | `companion_sprite_set` | 2 | 2 |
| | **Total** | **23** | |

## Family notes

- `[7C]` is a **defensive cleanup** — it only acts when `$0676` still holds `#$004C`, indicating the focus system left the companion in a modified state. Most actors call it early in their script as a "reset companion if needed" guard.
- `[7D]` is a **direct switch** — it unconditionally changes the companion's spritemap bank and updates the secondary focus id `$0678`. Setting `$0678 = #$004D` effectively registers a second companion entity.
- The companion actor at `$0EEE` is the robot partner that follows the player. Its spritemap pointer lives in actor RAM at `$7F0000+offset`, not in a fixed WRAM location.
- The bit 13 clear in [7C]'s flags write (`AND #$DFFF` on `$0006,X`) likely disables a visual overlay or "transformed" rendering mode.
- Related to the Party Check family (`[62]`), which tests `$0676 == #$004C` and `$0678 == #$004D` to verify companion count.
