# Spawn Gate — COP `[74]` `[75]` `[76]`

> Deep-audited ops: `[74]` `[75]` `[76]`

## Overview

Conditional actor spawn gates that test a condition during actor initialization and **destroy the actor before it appears** if the condition fails. These are the primary mechanism for making actors appear or disappear based on story progress or the current map.

All three share the same destroy path (`code_04FD4E` — actor self-destruct) and the same design pattern: they appear at the very start of an actor's script (often the first instruction) and are evaluated exactly once per spawn.

| Op | Gate type | Operand | Typical use |
|----|-----------|---------|-------------|
| `[74]` | Flag expression (AND/OR/AND-NOT) | 2+ Words | Complex multi-flag conditions |
| `[75]` | Single flag | 1 Word | Simple story-progress gate |
| `[76]` | Map id | 1 Word | Map-specific actor filtering |

## Shared state

| Address | Role |
|---------|------|
| `$0730+` | Story flag bitfield (tested via `code_00DBEF`) |
| `$05A8` | Current map id (tested by `[76]`) |
| `$2C` | Script pointer (advanced past operands on continue) |

### Helpers

| Label | Role |
|-------|------|
| `code_00DBEF` | Test story flag — returns carry set if flag is set |
| `code_04FD4E` | Actor self-destruct (unlink from chain, decrement `$56`) |
| `code_009F00` | Skip Word operand and continue (`INC $2C` ×2, RTI) |

## Family notes

- **`[75]` is the most common spawn gate** (271 call sites, 253 files) — nearly every scene-conditional NPC uses it. 85% of operands have bit 15 set (`#$8xxx`), meaning "destroy if flag IS set" (actor disappears once a story event occurs).
- **`[74]` handles multi-flag conditions** (108 sites, 104 files). The most common pattern is a 2-word AND expression like `( #$1048, #$804A )` meaning "require both flags $048 and $04A."
- **`[76]` is rare** (6 sites, 4 files) and only used by system/player actors that need to behave differently depending on which map they're on.
- These ops are closely related to `[6E] npc_spawn_gate` (NPC Lifecycle family), which tests the hardcoded flag `#$000F` instead of an operand-specified flag. `[75]` is the general-purpose version.
- Unlike `[0B] branch_if_flag` which branches to a code address, `[75]` either continues or destroys — there is no branch target. This is intentional: spawn gates run before the actor is visible, so there's nothing to branch to.

## Usage statistics

| Op | Name | Sites | Files |
|----|------|------:|------:|
| `[74]` | `gate_flag_expr` | 108 | 104 |
| `[75]` | `gate_flag` | 271 | 253 |
| `[76]` | `gate_map` | 6 | 4 |
| | **Total** | **385** | |

## Opcodes

---

#### COP [74] — `gate_flag_expr` (boolean expression spawn gate)

- **Confidence:** high
- **Preferred name:** `gate_flag_expr`
- **Aliases:** `spawn_gate_expr`, `branch_flags_expr_halt`
- **Handler:** `code_00BBA9` @ chunk_008000.asm:8431–8518
- **Parameters:** Word, Word(+) — variable-length flag expression
- **Usage count:** 108

##### Operand encoding

Each Word in the expression encodes a flag id in bits 0–10 and an operator in bits 11–15:

| Bits | Mask | Meaning |
|------|------|---------|
| 0–10 | `#$07FF` | Flag id (passed to `code_00DBEF`) |
| 12 | `#$1000` | AND — test next flag, accumulate with AND |
| 13 | `#$2000` | AND-NOT — test next flag; if current result is true and next is true, result becomes false |
| 14 | `#$4000` | OR — test next flag, accumulate with OR |
| 15 | `#$8000` | Terminator polarity — inverts the final destroy/continue decision |
| 11–15 = 0 | `#$F800 == 0` | End of expression (terminate without polarity inversion) |

The handler reads words in a loop, applying the encoded operator between each flag test result. The loop terminates when it encounters a word with bits 11–15 = 0 or bit 15 set.

##### Final decision

| Terminator | Expression result | Action |
|------------|-------------------|--------|
| `#$0xxx` (bit 15 clear) | TRUE (`$32 != 0`) | **Destroy** actor |
| `#$0xxx` (bit 15 clear) | FALSE (`$32 == 0`) | Continue script |
| `#$8xxx` (bit 15 set) | TRUE (`$32 != 0`) | Continue script |
| `#$8xxx` (bit 15 set) | FALSE (`$32 == 0`) | **Destroy** actor |

In practice, **bit 15 on the terminator is almost always set** (`#$8xxx`), meaning: "actor requires these flags to be set — destroy if the expression evaluates to false."

##### What it does

```asm
code_00BBA9 {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    STA $30
    JSR $&code_00DBEF     ; test first flag
    ROL                    ; carry → bit 0

  loc_00BBB6:              ; expression evaluation loop
    AND #$0001
    STA $32                ; accumulated result
    LDA $30
    BMI loc_00BC2F         ; bit 15 → terminator (inverted polarity)
    AND #$F800
    BEQ loc_00BC24         ; no operator bits → terminator (normal polarity)
    BIT #$4000
    BNE loc_00BBE2         ; OR operator
    BIT #$2000
    BNE loc_00BBF2         ; AND-NOT operator
                           ; default: AND — read next word, test, accumulate
    LDA [$2C]
    INC $2C
    INC $2C
    STA $30
    JSR $&code_00DBEF
    LDA $32
    ADC #$0000             ; carry + accumulated
    BNE loc_00BBB6
    BRA loc_00BC0A         ; skip remaining if result is 0

  ; ... OR / AND-NOT paths similar ...

  loc_00BC24:              ; end: normal polarity
    LDA $32
    BEQ loc_00BC1D         ; false → continue
    JSL $@code_04FD4E      ; true → destroy
    PLA  PLA  RTL

  loc_00BC2F:              ; end: inverted polarity
    LDA $32
    BNE loc_00BC1D         ; true → continue
    JSL $@code_04FD4E      ; false → destroy
    PLA  PLA  RTL

  loc_00BC1D:              ; continue script
    STZ $32
    LDA $2C
    STA $02, S
    RTI
}
```

##### Common patterns

**2-word AND** (most common — 100 of 108 sites):

```asm
    COP [74] ( #$1048, #$804A )
    ; Require flag $048 AND flag $04A — destroy if either is clear
```

**2-word OR** (4 sites):

```asm
    COP [74] ( #$4001, #$005B )
    ; Destroy if flag $001 OR flag $05B is set
```

##### Operand 1 high-nibble distribution

| Pattern | Count | Meaning |
|---------|------:|---------|
| `#$1xxx` | 100 | AND chain |
| `#$4xxx` | 4 | OR chain |
| `#$2xxx` | 4 | AND-NOT chain |

---

#### COP [75] — `gate_flag` (single-flag spawn gate)

- **Confidence:** high
- **Preferred name:** `gate_flag`
- **Aliases:** `spawn_gate_flag`, `destroy_if_flag`
- **Handler:** `code_00BC3A` @ chunk_008000.asm:8520–8540
- **Parameters:** `Word` (flag id with polarity bit)
- **Usage count:** 271

##### Operand encoding

| Bits | Meaning |
|------|---------|
| 0–14 | Flag id (passed to `code_00DBEF`) |
| 15 | Polarity: `0` = destroy if flag CLEAR; `1` = destroy if flag SET |

##### What it does

```asm
code_00BC3A {
    TYX
    LDA [$2C]
    BMI loc_00BC46         ; bit 15 set → inverted polarity
    JSR $&code_00DBEF      ; test flag
    BCS loc_00BC4B         ; flag set → continue
    BRA loc_00BC4E         ; flag clear → destroy

  loc_00BC46:              ; inverted path
    JSR $&code_00DBEF
    BCS loc_00BC4E         ; flag set → destroy
                           ; flag clear → continue

  loc_00BC4B:
    JMP $&code_009F00      ; skip operand, continue script

  loc_00BC4E:
    JSL $@code_04FD4E      ; destroy actor
    PLA  PLA  RTL
}
```

| Polarity | Flag state | Action |
|----------|-----------|--------|
| bit 15 = 0 | CLEAR | **Destroy** (actor requires this flag) |
| bit 15 = 0 | SET | Continue |
| bit 15 = 1 | SET | **Destroy** (actor disappears once flag is set) |
| bit 15 = 1 | CLEAR | Continue |

##### Polarity distribution

| Pattern | Count | Meaning |
|---------|------:|---------|
| `#$8xxx` (bit 15 set) | 230 | Destroy when flag IS set — actor disappears after event |
| `#$0xxx` (bit 15 clear) | 41 | Destroy when flag is CLEAR — actor appears after event |

##### Why / how used

The most common pattern: an NPC that should only appear before a story event:

```asm
  code_07A689:
    COP [75] ( #$81BB )       ; destroy if flag $1BB is set
    COP [44]                   ; solid_on
    COP [22] ( &code_interact ); set interact handler
    ...                        ; idle loop
```

An actor that should only appear AFTER a story event:

```asm
    COP [75] ( #$01BA )       ; destroy if flag $1BA is NOT set
    ...
```

Multiple gates can be chained:

```asm
    COP [75] ( #$01BA )       ; require flag $1BA
    COP [75] ( #$81BB )       ; exclude flag $1BB
    ; Actor exists only when $1BA is set AND $1BB is clear
```

---

#### COP [76] — `gate_map` (map-id spawn gate)

- **Confidence:** high
- **Preferred name:** `gate_map`
- **Aliases:** `spawn_gate_map`, `destroy_if_map`
- **Handler:** `code_00BC55` @ chunk_008000.asm:8542–8569
- **Parameters:** `Word` (map id with polarity bit)
- **Usage count:** 6

##### Operand encoding

| Bits | Meaning |
|------|---------|
| 0–14 | Map id (compared against `$05A8`) |
| 15 | Polarity: `0` = destroy if ON this map; `1` = destroy if NOT on this map |

##### What it does

```asm
code_00BC55 {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    BIT #$8000
    BNE loc_00BC75         ; bit 15 set → inverted polarity
    AND #$7FFF
    CMP $05A8              ; compare with current map
    BEQ loc_00BC6E         ; match → destroy
    LDA $2C
    STA $02, S
    RTI                    ; no match → continue

  loc_00BC6E:
    JSL $@code_04FD4E      ; destroy actor
    PLA  PLA  RTL

  loc_00BC75:              ; inverted path
    AND #$7FFF
    CMP $05A8
    BNE loc_00BC6E         ; no match → destroy
    LDA $2C
    STA $02, S
    RTI                    ; match → continue
}
```

| Polarity | Map match | Action |
|----------|----------|--------|
| bit 15 = 0 | ON this map | **Destroy** (actor excluded from this map) |
| bit 15 = 0 | Different map | Continue |
| bit 15 = 1 | NOT on this map | **Destroy** (actor only exists on this map) |
| bit 15 = 1 | On this map | Continue |

##### Why / how used

Used by system/player actors that appear across multiple maps but need map-specific behavior:

```asm
    COP [76] ( #$0162 )       ; destroy if on map $162
    COP [76] ( #$0163 )       ; destroy if on map $163
```

The player host actor (`actor_0BD8A1`) uses two `[76]` calls to exclude itself from specific maps. `actor_09E10B` (Napoleon companion) uses it similarly.

Only one call site uses bit 15: `actor_0CC7BF` with `COP [76] ( #$8198 )` — the actor only exists on map `$198`.

## Relationship to other families

```
[75] gate_flag ←→ [6E] npc_spawn_gate
  [75] tests any flag from operand
  [6E] tests hardcoded flag #$000F (scene-reset)

[74] gate_flag_expr ←→ [0C] branch_if_flags
  [74] destroys on expression fail (spawn-time)
  [0C] branches to code address (runtime)

[75] gate_flag ←→ [0B] branch_if_flag
  [75] destroys or continues (spawn-time)
  [0B] branches to code address (runtime)
```
