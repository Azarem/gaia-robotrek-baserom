# COP family: Party Check

_Deep-audited ops: `[62]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

Test how many **robot companions** are in the active party by checking the hardcoded companion IDs `#$004C` and `#$004D` against the focus/companion slots `$0676`/`$0678`. Related to the tracked-id system but uses fixed IDs rather than dynamic tracking.

## Shared state

| Address | Width | Role |
|---------|------:|------|
| `$0676` | 2 bytes | Focus/companion slot A |
| `$0678` | 2 bytes | Focus/companion slot B |

### Companion IDs

| ID | Meaning |
|----|---------|
| `#$004C` | Robot companion 1 |
| `#$004D` | Robot companion 2 |

## Family notes

- All 233 call sites use operand `#$0002` (require both robots). No `#$0000` or `#$0001` variants exist.
- The check gates NPC dialog and area access that should only trigger when the full party is assembled.
- `$0676`/`$0678` are shared with the tracked_ids family (`[56]`/`[57]`/`[5A]`/`[5B]`) but `[62]` tests for specific companion IDs, not general tracked instances.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `62` | `branch_if_companions` | 233 | high | Word, &Code | `code_00B633` |

**Family call-site total:** 233

## Opcodes

#### COP [62] — `branch_if_companions` (test robot companion count)

- **Confidence:** high
- **Preferred name:** `branch_if_companions`
- **Aliases:** `branch_if_party_size`, `check_robots`
- **Handler:** `code_00B633` @ `extracted/system/chunk_008000.asm:7596-7624`
- **Parameters:** `Word` required_count, `&Code` on_match
- **Usage count:** 233

##### What it does

```asm
code_00B633 {
    TYX
    LDY #$0002              ; count = 2
    LDA #$004D              ; robot 2
    CMP $0678  BEQ found
    CMP $0676  BEQ found
    DEY                     ; count = 1
    LDA #$004C              ; robot 1
    CMP $0678  BEQ found
    CMP $0676  BEQ found
    DEY                     ; count = 0
  found:
    TYA  CMP [$2C]          ; count vs operand
    BEQ match
    JMP $&code_009F07       ; skip &Code + Word
  match:
    INC $2C  INC $2C
    LDA [$2C]  STA $02,S  RTI  ; goto &Code
}
```

##### Branch polarity

| Condition | Outcome |
|-----------|---------|
| Count = operand | goto `&Code` |
| Count ≠ operand | skip (fall through) |

##### Typical usage

```asm
    COP [62] ( #$0002, &full_party )  ; both robots?
    COP [1D] ( &string_solo )         ; no → solo dialog
    RTL
  full_party:
    COP [1D] ( &string_party )        ; yes → party dialog
```

- **WRAM:** `$0676`, `$0678`
- **Source examples:**
  - `fathers_house/farmers_house/actor_07A382.asm:22` — `#$0002`
  - `volcano_base/base_conveyor_center/actor_09A1DE.asm` — `#$0002` (4 uses)
  - `unorganized/map_14E/actor_09D95A.asm` — `#$0002` (14 uses)
