# COP family: Switch tables

_Deep-audited ops: `[25]`, `[26]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Jump tables over an actor byte. `[25]` switches on spawn/focus param `$04`; `[26]` switches on actor-local counter `$22`.

## Shared state

- `$04` — instance / focus id (`[25]`, also `[32]`)
- `$22` — actor counter / mode (`[26]`)

## Family notes

- `[24]` is **not** part of this family.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `25` | `switch_param` | 14 | high | Byte, Byte, &Code… | `code_00A733` |
| `26` | `switch_counter` | 5 | high | Byte, Byte, &Code… | `code_00A762` |

**Family call-site total:** 19

## Shared reference

#### Switch family (shared model)

`[25]` and `[26]` are **jump tables** with a valid range. Layout:

```
COP [2x] ( #lo, #hi, &case_lo, &case_lo+step, …, &case_hi )
```

| | `[25]` `switch_param` | `[26]` `switch_counter` |
|--|----------------------|-------------------------|
| Selector | actor **`$04`** | actor **`$22`** |
| `#lo` / `#hi` units | **byte offsets** (0, 2, 4, …) | **indices** (0, 1, 2, …) then `ASL` ×2 |
| If selector in `[lo, hi]` | `RTI` → matching `&Code` | same |
| If selector **> hi** | fall through **after** the table | same |
| If selector **< lo** | still indexes (`sel−lo`); usually avoid | same |

`$04` is loaded from actor pool offset `$0004` at DP setup (`code_00E587`) — instance/spawn param (credits chickens `LDA $04` / `LS` for anim variant).  
`$22` is a free actor-local (scripts/`STA $22` in menus); often a mode or step counter.

## Opcodes

#### COP [25] — `switch_param` (jump table on `$04`)

- **Confidence:** high
- **Preferred name:** `switch_param`
- **Aliases:** `switch_byte`, `switch_on_04`, `branch_table_04`
- **Handler:** `code_00A733` @ `extracted/system/chunk_008000.asm:5354-5384`
- **Parameters:** `Byte` lo, `Byte` hi, then `(hi−lo)/2+1` × `&Code` (variable-length conditions)
- **Usage count:** 14

##### What it does

```asm
; Handler (complete)
code_00A733 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $30                 ; lo (byte offset)
    LDA [$2C]
    INC $2C
    AND #$00FF              ; hi
    CMP $04
    BCC past_table          ; hi < $04  →  $04 > hi → fall through

    ; $04 <= hi: jump to pointer at table + ($04 - lo)
    LDA $04
    SEC
    SBC $30
    CLC
    ADC $2C
    STA $2C
    LDA [$2C]
    STA $02, S
    RTI

  past_table:
    SEC
    SBC $30                 ; A was hi
    CLC
    ADC $2C
    INC
    INC                     ; skip last pointer
    STA $02, S              ; continue after table
    RTI
}
```

##### Why / how used

Per-instance behavior when several actors share one script but differ in `$04` (spawned clones, credits puppets). Also used as a **guard**: `#02, #02, &only_if_04_eq_2` then default dialog.

```asm
; credits: $04 in {0,2,4,6} picks one of four cutscene paths
COP [25] ( #00, #06, &path0, &path2, &path4, &path6 )

; interact: only special if $04 == 2
COP [25] ( #02, #02, &code_special )
COP [1D] ( &string_default )
RTL
```

| Item | Value |
|------|-------|
| Suggested alias | `switch_param #lo, #hi, &…` |
| Selector | `$04` (byte **offsets**) |

- **Source examples:**
  - `credits/credits_chickens/actor_04D745.asm:31` — `#00,#06` four-way
  - `credits/actor_04DAC5.asm:9` — `#00,#06`
  - `fathers_house/chicken_farm/actor_07A575.asm:40` — `#02,#02` guard
  - `hacker_fortress/tetron_room/actor_04DEB4.asm:81` — `#00,#08` five-way
  - `unorganized/map_12F/actor_0CA5C4.asm:22` — `#02,#10` eight-way

#### COP [26] — `switch_counter` (jump table on `$22`)

- **Confidence:** high
- **Preferred name:** `switch_counter`
- **Aliases:** `switch_byte_alt`, `switch_on_22`, `branch_table_22`
- **Handler:** `code_00A762` @ `extracted/system/chunk_008000.asm:5386-5418`
- **Parameters:** `Byte` lo, `Byte` hi, then `(hi−lo+1)` × `&Code`
- **Usage count:** 5

##### What it does

Same control flow as `[25]`, but selector is **`$22`**, and `(sel − lo)` is **`ASL`’d** (index → byte offset):

```asm
; Handler (complete)
code_00A762 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $30                 ; lo (index)
    LDA [$2C]
    INC $2C
    AND #$00FF              ; hi (index)
    CMP $22
    BCC past_table          ; $22 > hi → fall through

    LDA $22
    SEC
    SBC $30
    ASL                     ; index → byte offset
    CLC
    ADC $2C
    STA $2C
    LDA [$2C]
    STA $02, S
    RTI

  past_table:
    SEC
    SBC $30
    ASL
    CLC
    ADC $2C
    INC
    INC
    STA $02, S
    RTI
}
```

##### Why / how used

Branch on a **runtime counter/mode** in `$22` (set by prior script or system code). Typical on interact: different lines depending on progress stored in `$22`.

```asm
; only when $22 == 1
COP [26] ( #01, #01, &code_special )
COP [1D] ( &string_default )       ; $22 != 1
RTL

; $22 in {1,2,3}
COP [26] ( #01, #03, &case1, &case2, &case3 )
; fall through if $22 == 0 or > 3
```

All 5 sites use `lo = #01` (skip index 0 / treat 0 as “default fallthrough”).

| Item | Value |
|------|-------|
| Suggested alias | `switch_counter #lo, #hi, &…` |
| Selector | `$22` (**indices**, not byte offsets) |
| vs `[25]` | `$22` + `ASL` vs `$04` raw byte offset |

- **Source examples:**
  - `rococo/rococo/actor_05A19E.asm:22` — `#01,#01` dog-print special
  - `rococo/rococo/actor_058219.asm:15` — `#01,#03` three-way
  - `volcano_base/shrine_connector_w/actor_07E590.asm:17` — `#01,#02`
  - `rococo/cokers_upstairs/actor_05CBE1.asm:22` — `#01,#01`
  - `unorganized/actor_0A8A38.asm:17` — `#01,#03`
