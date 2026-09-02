# BCD Counter — COP `[77]` `[78]`

> Deep-audited ops: `[77]` `[78]`

## Overview

General-purpose **BCD (Binary-Coded Decimal) counters** stored in a WRAM array at `$7E4222`. COP `[78]` writes to a counter (set / add / subtract) and COP `[77]` tests a counter against a threshold and conditionally branches. Both operate in 65816 decimal mode (`SED`/`CLD`).

These counters are used for scene-specific tracking that isn't covered by the flag system: visit counts, donation totals, and similar progressive state.

| Op | Role | Operands |
|----|------|----------|
| `[77]` | Compare counter and branch | Byte (index+mode), Word (threshold), &Code |
| `[78]` | Set / add / subtract counter | Byte (index+op), Word (value) |

## Shared state

| Address | Role |
|---------|------|
| `$7E4222` | BCD counter array (word-sized entries, indexed by operand byte bits 0–5/6) |
| `$0000` | Scratch — `[77]` saves full byte operand here for bit-7 check |
| `$2C` | Script pointer |

The counter array is zeroed during scene reset (both `code_009960` and `code_009A45` clear `$7E4222`–`$7E4223`).

### Counter indices observed in call sites

| Index | Context | Purpose |
|------:|---------|---------|
| 0 | Prinky's Mansion east foyer, volcano quake room, system actor | Visit/event counter |
| 2 | Map $139 (Chino town building fund) | BCD donation total (target: 9000 GP) |

## Opcodes

---

#### COP [77] — `branch_if_counter` (BCD compare and branch)

- **Confidence:** high
- **Preferred name:** `branch_if_counter`
- **Aliases:** `bcd_compare_branch`
- **Handler:** `code_00BC82` @ chunk_008000.asm:8571–8601
- **Parameters:** `Byte` (index + mode), `Word` (BCD threshold), `&Code` (branch target)
- **Usage count:** 11

##### Operand encoding

| Field | Bits | Meaning |
|-------|------|---------|
| Byte bits 0–6 | `#$7F` | Counter index (after clearing bit 7) |
| Byte bit 7 | `#$80` | Comparison mode: `0` = branch on EQUAL only; `1` = branch on EQUAL OR GREATER (>=) |
| Word | | BCD threshold value |
| &Code | | Branch target address |

##### What it does

```asm
code_00BC82 {
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $0000             ; save full byte (for bit-7 check later)
    AND #$FF7F            ; clear bit 7 → index
    TAX
    LDA [$2C]             ; read Word threshold
    INC $2C
    INC $2C
    SED                   ; enter decimal mode
    CMP $7E4222, X        ; BCD compare: threshold vs counter[index]
    CLD
    BEQ loc_00BCAC        ; equal → branch taken
    BCC loc_00BCA4        ; counter > threshold → check mode

  loc_00BCA0:             ; condition not met
    TYX
    JMP $&code_009F00     ; skip &Code (2 bytes), continue

  loc_00BCA4:             ; counter > threshold
    LDA $0000
    BIT #$0080            ; check bit 7 (>= mode)
    BEQ loc_00BCA0        ; bit 7 clear → exact match only → skip

  loc_00BCAC:             ; branch taken
    TYX
    LDA [$2C]             ; read &Code target
    STA $02, S
    RTI                   ; jump to target
}
```

The BCD `CMP` instruction sets flags: `Z` if equal, `C` if accumulator >= operand. Since the accumulator holds the **threshold** and the operand is the **counter**, `BCC` (carry clear) means counter > threshold.

##### Semantics

| Bit 7 | Counter vs Threshold | Action |
|-------|---------------------|--------|
| 0 | counter == threshold | Branch to &Code |
| 0 | counter != threshold | Skip &Code, continue |
| 1 | counter >= threshold | Branch to &Code |
| 1 | counter < threshold | Skip &Code, continue |

##### Common patterns

```asm
    ; Branch if counter[0] == 1
    COP [77] ( #00, #$0001, &code_06F6C2 )

    ; Branch if counter[0] >= 3
    COP [77] ( #80, #$0003, &code_058AFC )

    ; Branch if counter[2] >= 9000 (BCD)
    COP [77] ( #82, #$9000, &code_0A8A94 )
```

---

#### COP [78] — `set_counter` (BCD set / add / subtract)

- **Confidence:** high
- **Preferred name:** `set_counter`
- **Aliases:** `bcd_counter_op`, `modify_counter`
- **Handler:** `code_00BCB2` @ chunk_008000.asm:8603–8655
- **Parameters:** `Byte` (index + operation), `Word` (BCD value)
- **Usage count:** 8

##### Operand encoding

| Byte bits | Operation | Index extraction |
|-----------|-----------|------------------|
| 7:6 = `00` | **SET** (direct assign) | Byte = raw index (bits 0–7) |
| bit 7 = `1`, bit 6 = `0` | **ADD** (BCD addition) | Index = byte AND `#$7F` (bits 0–6) |
| bit 6 = `1` | **SUBTRACT** (BCD subtraction, clamped to 0) | Index = byte AND `#$BF` (bits 0–5, 7) |

##### What it does

```asm
code_00BCB2 {
    LDA [$2C]
    INC $2C
    AND #$00FF
    BIT #$00C0            ; test bits 6-7
    BNE loc_00BCCF        ; any set → add or subtract
    TAX                   ; SET mode: raw byte = index
    LDA [$2C]
    INC $2C
    INC $2C
    STA $7E4222, X        ; counter[index] = value
    TYX
    LDA $2C
    STA $02, S
    RTI

  loc_00BCCF:
    BIT #$0040            ; test bit 6
    BNE loc_00BCEF        ; bit 6 set → SUBTRACT

    ; ADD path (bit 7 set, bit 6 clear)
    AND #$FF7F            ; clear bit 7 → index
    TAX
    LDA [$2C]
    INC $2C
    INC $2C
    SED
    CLC
    ADC $7E4222, X        ; counter += value (BCD)
    STA $7E4222, X
    CLD
    TYX
    LDA $2C
    STA $02, S
    RTI

  loc_00BCEF:
    ; SUBTRACT path (bit 6 set)
    AND #$FFBF            ; clear bit 6 → index (bit 7 may remain)
    TAX
    SED
    LDA $7E4222, X
    SEC
    SBC [$2C]             ; counter -= value (BCD)
    BCS ok
    LDA #$0000            ; clamp to zero
  ok:
    STA $7E4222, X
    CLD
    TYX
    LDA $2C
    STA $02, S
    RTI
}
```

##### Common patterns

```asm
    ; Set counter[0] to 0 (reset)
    COP [78] ( #00, #$0000 )

    ; Add BCD 1 to counter[0]
    COP [78] ( #80, #$0001 )

    ; Add BCD 10 to counter[2] (donation)
    COP [78] ( #82, #$0010 )

    ; Add BCD 100 to counter[2]
    COP [78] ( #82, #$0100 )

    ; Add BCD 1000 to counter[2]
    COP [78] ( #82, #$1000 )
```

## Usage statistics

| Op | Name | Sites | Files |
|----|------|------:|------:|
| `[77]` | `branch_if_counter` | 11 | 6 |
| `[78]` | `set_counter` | 8 | 4 |
| | **Total** | **19** | |

## Family notes

- The BCD counter array is **not saved to SRAM** — counters reset when the player leaves the area (scene reset clears `$7E4222`). This limits their use to within-scene tracking (e.g., counting interactions during a single visit, accumulating donations in a single session).
- The donation counter for Chino's building fund (index 2) accumulates BCD GP amounts of 10, 100, and 1000 and branches when the total reaches 9000.
- The mansion east foyer (index 0) uses `[78]` to increment a visit counter and `[77]` to branch on exact equality (`#00` = no >= mode), implementing a "do something different on the Nth visit" pattern.
- All observed values are valid BCD (no hex digits A–F). The `SED`/`CLD` bracketing ensures correct decimal arithmetic.
