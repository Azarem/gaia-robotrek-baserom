# COP family: Event flags

_Deep-audited ops: `[08]`, `[0A]`, `[0B]`, `[0C]`, `[0D]`, `[1B]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Read/write the story bitfield at `$0730+` via `code_00DBEF` (test) and `code_00DBBD` (set/clear). Includes wait, single/multi branch, rewards, and the map-adjacent `[1B]` reset helper. This is the largest family by call-site count in `$00`–`$4F`.

## Shared state

- `$0730+` — event flag bytes
- Flag word: bits 0–10 = index; bit15 = polarity (**opcode-dependent**)
- `[08]` bit15 sense is **inverted** vs `[0B]` — same literal means different things
- `[1B]` always `STZ $0553` after an optional DBBD write
- `[0C]` packs a small expression language (AND/OR/NOT chaining) into successive words

## Family notes

- `[1B]` follows `[1A]` by opcode number only — it is a **flag** op, not map load.
- Authoring pitfall: `#$0001` = wait-until-**set** for `[08]`, but branch-if-**clear** for `[0B]`.
- `[0D]` `give_reward` writes `$05EE` and may also touch flags — two modes in one opcode.
- See **Shared reference** below for the full bitfield cheat sheet and DBBD/DBEF listings.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `08` | `wait_flag` | 65 | high | u16 | `code_00A1BC` |
| `0A` | `set_flag` | 1077 | high | u16 | `code_00A1F4` |
| `0B` | `branch_if_flag` | 863 | high | u16, ptr16 code | `code_00A203` |
| `0C` | `branch_if_flags` | 214 | high | u16…, ptr16 code | `code_00A220` |
| `0D` | `give_reward` | 40 | high | u16 | `code_00A2AB` |
| `1B` | `apply_flag_reset` | 4 | high | Word | `code_00A580` |

**Family call-site total:** 2263

## Shared reference

#### Event flag word encoding (`$0730` bitfield)

Ops `[08]`–`[0D]` (and others) pass a **flag word** through `code_00DBEF` (test) / `code_00DBBD` (set/clear):

| Bits | Mask | Meaning |
|------|------|---------|
| 0–10 | `$07FF` | Flag index → byte `$0730 + (index>>3)`, bit `(index&7)` |
| 15 | `$8000` | **Polarity — opcode-dependent** (do not treat all flag ops alike): **`[0A]` / DBBD:** `1` = **set** bit, `0` = **clear** bit. **`[0B]` / `[0C]` tests:** `1` = true when flag **is set**, `0` = true when **clear**. **`[08]` `wait_flag` is inverted vs `[0B]`:** bit15 clear = wait until **set**; bit15 set = wait until **clear**. |
| 14 / 13 / … | `$4000` / `$2000` / `$F800` | Used by `[0C]` expression chaining (see below); also by `[0D]` reward mode |

**Authoring cheat sheet:**

| Want | `set_flag` `[0A]` | `branch_if_flag` `[0B]` | `wait_flag` `[08]` |
|------|-------------------|------------------------|--------------------|
| Flag N on | `#$8000\|N` | `#$8000\|N` → branch if set | `#$N` → wait until set |
| Flag N off | `#$N` | `#$N` → branch if clear | `#$8000\|N` → wait until clear |

> **Pitfall:** the same literal `#$0001` means “wait until set” for `[08]` but “branch if clear” for `[0B]`. Always check the opcode, not only bit15.

Examples from source: `COP [0A] ( #$8001 )` set story bit 1; `COP [0A] ( #$0001 )` clear it; `COP [0B] ( #$8001, &path )` if set goto path; `COP [08] ( #$0004 )` spin until bit 4 is set.

Shared helpers (used by `[08]`/`[0A]`/`[0B]`/`[0C]`/`[0D]`):

```asm
; code_00DBBD — set or clear one $0730 bit from flag word in A
code_00DBBD {
    PHX
    STA $0000
    AND #$0007
    TAX                     ; bit-in-byte
    LDA $0000
    AND #$07FF
    LSR : LSR : LSR
    TAY                     ; byte index
    SEP #$20
    LDA $0001
    BPL clear_bit           ; bit15 of word clear → clear
    LDA $@byte_00DC1E, X
    ORA $0730, Y            ; set
    BRA store
  clear_bit:
    LDA $@byte_00DC1E, X
    EOR #$FF
    AND $0730, Y            ; clear
  store:
    STA $0730, Y
    PLX
    REP #$20
    RTS
}

; code_00DBEF — test one $0730 bit; C=1 if set, C=0 if clear
code_00DBEF {
    ; same index decode as DBBD…
    SEP #$20
    LDA $@byte_00DC1E, X
    AND $0730, Y
    SEC
    BNE done
    CLC                     ; bit was clear
  done:
    PLX
    REP #$20
    RTS
}

; code_009F00 — skip 2 bytes (one Word) past current $2C
; code_009F07 — skip 4 bytes (Word + &Code) past current $2C
```

## Opcodes

#### COP [08] — `wait_flag` (yield until flag condition)

- **Confidence:** high
- **Preferred name:** `wait_flag`
- **Aliases:** `wait_until_flag`, `await_flag`
- **Handler:** `code_00A1BC` @ `extracted/system/chunk_008000.asm:4472-4495`
- **Parameters:** `Word` (flag word)
- **Usage count:** 65

##### What it does

Peeks the flag word at `[$2C]` (does **not** advance until success). Sense = bit15:

| Operand | Wait while… | Proceed when… |
|---------|-------------|----------------|
| `#$0004` (bit15 clear) | flag **clear** | flag **set** |
| `#$8004` (bit15 set) | flag **set** | flag **clear** |

```asm
; Handler (complete)
code_00A1BC {
    TYX
    LDA [$2C]              ; peek Word — do NOT advance yet
    BMI wait_until_clear   ; bit15 set → inverted sense

    JSR $&code_00DBEF      ; wait-until-SET
    BCC do_yield           ; still clear → yield
    BRA done               ; now set → fall through

  wait_until_clear:
    JSR $&code_00DBEF
    BCC done               ; now clear → fall through
    ; else still set → yield

  do_yield:
    LDA $2C
    DEC
    DEC
    STA $28                ; rewind onto the Word operand
    PLA
    PLA
    RTL                    ; end tick; next entry re-hits this COP [08]

  done:
    JMP $&code_009F00      ; skip Word, continue at next opcode
}
```

So the same `COP [08]` instruction is **re-executed** every tick until the condition holds, then the operand is skipped and the script proceeds.

##### Why / how used

Cutscene / multi-actor sync: one actor sets a flag (`[0A]`), another **blocks** until it sees it.

```asm
COP [0A] ( #$8001 )     ; actor A: signal
...
COP [08] ( #$0001 )     ; actor B: wait until bit 1 set
COP [0C] ( #$2078, #$0077, &next )
```

Top operands: `#$0001`–`#$0006` (plain = wait-until-**set**), plus scene-specific `#$0338`, `#$8321`, etc.

| Item | Value |
|------|-------|
| Suggested alias | `wait_flag #word` |
| Does not | Branch elsewhere — only stalls then falls through |

- **JSR:** `code_00DBEF`
- **Source examples:**
  - `hacker_fortress/crystal_dream/actor_0CEA4F.asm:23` — `COP [08] ( #$0004 )`
  - `prinkys_mansion/mansion_tower2_center/actor_06B52E.asm:77` — wait then `[0C]`
  - `prinkys_mansion/mansion_underground_storage/actor_06CCE2.asm:10` — `#$0338`

#### COP [0A] — `set_flag` (set or clear one event bit)

- **Confidence:** high
- **Preferred name:** `set_flag`
- **Aliases:** `flag_write`, `set_event`
- **Handler:** `code_00A1F4` @ `extracted/system/chunk_008000.asm:4514-4523`
- **Parameters:** `Word` (flag word)
- **Usage count:** **1077** (most-used COP)

##### What it does

```asm
; Handler (complete)
code_00A1F4 {
    TYX
    LDA [$2C]              ; flag word
    INC $2C
    INC $2C
    JSR $&code_00DBBD      ; bit15=1 → set; bit15=0 → clear
    LDA $2C
    STA $02, S             ; continue after operand
    RTI
}
```

DBBD: if Word bit15 set → **ORA** bit into `$0730`; else → **AND** mask to clear.

##### Why / how used

Progression everywhere: after dialog, warps, pickups, cutscene beats.

| Operand | Effect | Sites (approx) |
|---------|--------|----------------|
| `#$8000` / `#$8001` / `#$8002`… | Set low story bits | very common |
| `#$0001` / `#$0321`… | Clear corresponding bits | pair with set |
| `#$8321` / `#$832D`… | Set high-index scene flags | credits / diaries |

```asm
COP [1D] ( &string_XXXX )
COP [0A] ( #$8001 )          ; mark “talked / done”
COP [0B] ( #$8001, &already ) ; later visits
```

Note credits pattern: set with `#$832D`, test clear-sense with `#$032D` on `[0B]` for the opposite branch.

| Item | Value |
|------|-------|
| Suggested alias | `set_flag #word` |

- **JSR:** `code_00DBBD`
- **Source examples:**
  - `fathers_house/chicken_farm/actor_07A575.asm:9` — `#$83D5`
  - `credits/credits_heroes/actor_04C903.asm:43,51` — set `#$832D` / clear `#$032D`
  - `prinkys_mansion/actor_06C227.asm:24` — `#$0072` clear after gate

#### COP [0B] — `branch_if_flag` (conditional near jump)

- **Confidence:** high
- **Preferred name:** `branch_if_flag`
- **Aliases:** `if_flag`, `beq_flag`
- **Handler:** `code_00A203` @ `extracted/system/chunk_008000.asm:4525-4546`
- **Parameters:** `Word`, `&Code`
- **Usage count:** 863

##### What it does

```asm
; Handler (complete)
code_00A203 {
    TYX
    LDA [$2C]              ; flag word (peek; $2C still on Word)
    BMI branch_if_set      ; bit15 set → take &Code when flag SET

    JSR $&code_00DBEF      ; branch-if-CLEAR sense
    BCS skip               ; flag set → fall through (skip &Code)
    BRA take               ; flag clear → jump

  branch_if_set:
    JSR $&code_00DBEF
    BCS take               ; flag set → jump
    ; else flag clear → skip

  skip:
    JMP $&code_009F07      ; $2C += 4 (Word + &Code), continue

  take:
    INC $2C
    INC $2C                ; skip Word
    LDA [$2C]
    STA $02, S             ; RTI → &Code
    RTI
}
```

So **`#$8000|N` = branch if flag N is set** (the usual “already did this?” path). **`#$N` = branch if flag N is clear.**

##### Why / how used

NPC state machines and one-shot gates — often chained:

```asm
COP [0B] ( #$818D, &on_talk )
COP [0C] ( #$1034, #$0087, &alt )
; fallthrough default
```

Mayor/NPC script (`actor_05DF59`) is a long ladder of `[0B]` per story flag.

Top first-args: `#$8001` (85), `#$8002` (36), `#$8005` (28), …

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_flag #word, &label` |

- **JSR:** `code_00DBEF`
- **Source examples:**
  - `boot/diary_menu/actor_04B29E.asm:54` — `#$8320`
  - `unorganized/map_D9/actor_05DF59.asm` — many `#$80xx` talk gates
  - `prinkys_mansion/actor_06C227.asm:23` — `#$0072` with `[00]` FX

#### COP [0C] — `branch_if_flags` (compound flag expression)

- **Confidence:** high
- **Preferred name:** `branch_if_flags`
- **Aliases:** `branch_flags_expr`, `if_flags`
- **Handler:** `code_00A220` @ `extracted/system/chunk_008000.asm:4548-4631`
- **Parameters:** one or more `Word` terms, then `&Code` (variable length; `copdef.json` conditions)
- **Usage count:** 214 (≈209 with 2 terms + target; rare 3–4 term chains)

##### What it does

Evaluates a boolean expression over flag words into `$32`, then either jumps to `&Code` or skips the final pointer (`code_009F00`).

**Per-term high bits** (on top of flag index + `$8000` polarity):

| Bit | Role in chain |
|-----|----------------|
| `$4000` | **OR** next term into accumulator |
| `$2000` | **AND** next term (short-circuits if accum already 0) |
| other `$F800` | Continue expression (fetch/combine next; used e.g. `$1000` in `#$1040`) |
| none of `$F800` | **Last term** — finish; branch if `$32` matches sense |

```asm
; Handler (complete)
code_00A220 {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    STA $30                ; current term
    JSR $&code_00DBEF
    ROL                     ; C (flag set?) → bit0 of A

  combine:
    AND #$0001
    STA $32                ; accum bool (0/1)
    LDA $30
    BMI finish_inverted    ; terminal sense: branch if accum CLEAR
    AND #$F800
    BEQ finish_normal      ; no connector → last term
    BIT #$4000
    BNE do_or
    BIT #$2000
    BNE do_and

    ; other $F800 (e.g. $1000): fetch next, OR-into-carry style combine
    LDA [$2C]
    INC $2C
    INC $2C
    STA $30
    JSR $&code_00DBEF
    LDA $32
    ADC #$0000             ; keep 1 if either side set
    BNE combine
    BRA skip_rest_terms

  do_or:
    LDA [$2C]
    INC $2C
    INC $2C
    STA $30
    JSR $&code_00DBEF
    ROL
    ORA $32
    BRA combine

  do_and:
    LDA $32
    BEQ skip_and_terms     ; short-circuit: accum already 0
    LDA [$2C]
    INC $2C
    INC $2C
    STA $30
    JSR $&code_00DBEF
    LDA $32
    SBC #$0000             ; keep 1 only if both set
    BNE combine
    STZ $32
    ; fall into skip_rest_terms…

  skip_rest_terms:
    LDA $30
    BMI finish_inverted
    AND #$F800
    BEQ fallthrough        ; last term reached while false

  skip_and_terms:
    LDA [$2C]              ; discard remaining terms until terminal
    INC $2C
    INC $2C
    STA $30
    BRA skip_rest_terms

  fallthrough:
    STZ $32
    JMP $&code_009F00      ; skip &Code

  finish_normal:
    LDA $32
    BEQ fallthrough        ; accum 0 → skip
    LDA [$2C]
    STA $02, S             ; accum 1 → jump &Code
    RTI

  finish_inverted:
    LDA $32
    BNE fallthrough        ; accum 1 → skip
    LDA [$2C]
    STA $02, S             ; accum 0 → jump &Code
    RTI
}
```

Final sense: if the *current* `$30` term has bit15 (`BMI`), branch when accum **clear**; else branch when accum **set**.

Practical reading of common forms:

```asm
; two-term (typical): first has connector in $F800, second is terminal
COP [0C] ( #$1040, #$0027, &code_06A87E )
; ≈ (flag $40 …) combined with (flag $27); branch to handler if true

COP [0C] ( #$2001, #$0002, &code_05F6EF )
; $2000 = AND: flag1 AND flag2

; four-term AND chain (rare)
COP [0C] ( #$2177, #$2178, #$2179, #$017A, &code_06CE22 )
```

##### Why / how used

Scene entry / NPC line selection when **multiple** progress bits matter (village state, cave stages, multi-switch puzzles). Often several `[0C]` in a row as an if/else if ladder; first match wins.

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_flags #w0, #w1, …, &label` |
| Layout | Declared with conditionals in `us/copdef.json` |

- **Temps:** `$30` (current term), `$32` (accum bool)
- **Source examples:**
  - `seaside_cave/cave_storeroom/actor_06A82D.asm:9` — `#$1040,#$0027`
  - `fathers_house/fathers_yard/actor_0783DB.asm:14` — `#$1001,#$0002`
  - `prinkys_mansion/mansion_underground_storage/actor_06CDF2.asm:24` — 4-term AND
  - `native_village/native_village/actor_07BEFE.asm` — village state ladder

#### COP [0D] — `give_reward` (item/reward id → `$05EE` + flag side effects)

- **Confidence:** high
- **Preferred name:** `give_reward`
- **Aliases:** `award_item`, `set_reward`, `flag_reward`
- **Handler:** `code_00A2AB` @ `extracted/system/chunk_008000.asm:4633-4680`
- **Parameters:** `Word`
- **Usage count:** 40

##### What it does — two modes

```asm
; Handler (complete)
code_00A2AB {
    TYX
    LDA [$2C]
    BMI mode_wait          ; bit15 set → Mode B (wait/ack)

    ; --- Mode A: immediate ---
    STA $05EE              ; reward/item id
    LDA [$2C]
    INC $2C
    INC $2C
    CLC
    ADC #$0400
    ORA #$8000             ; force set polarity
    JSR $&code_00DBBD      ; set flag (id + $400)
    LDA $2C
    STA $02, S
    RTI

  mode_wait:
    ; --- Mode B: raise flag $0D, award, wait for clear-ack ---
    LDA #$000D
    JSR $&code_00DBEF
    BCS still_waiting      ; $0D still set → keep yielding (await clear)
    LDA $30
    BEQ first_entry
    JMP $&code_009F00      ; $30≠0 and $0D clear → ack done, skip Word

  first_entry:
    INC $30                ; latch: award initiated
    LDA #$800D
    JSR $&code_00DBBD      ; set flag $0D (signal to engine/UI)
    LDA [$2C]
    AND #$3FFF
    STA $05EE              ; id without $C000 bits
    LDA [$2C]
    BIT #$4000
    BEQ still_waiting
    AND #$BFFF             ; clear $4000
    CLC
    ADC #$0400
    JSR $&code_00DBBD      ; also set collected-flag (id+$400)

  still_waiting:
    LDA $2C
    DEC
    DEC
    STA $28                ; rewind onto Word; yield
    PLA
    PLA
    RTL
}
```

**Mode A — immediate (bit15 clear), e.g. `#$0056`:** write `$05EE`, set flag `id+$400`, continue.

**Mode B — wait/ack (bit15 set), e.g. `#$C001` = `$8000|$4000|$0001`:**

1. If flag `$0D` is **set** → yield (rewind onto Word via `$28`).
2. If flag `$0D` is **clear** and `$30≠0` → already awarded; skip Word and continue.
3. If flag `$0D` is **clear** and `$30=0` (first entry) → `INC $30`, **set** `$0D`, publish id to `$05EE`, optionally set `id+$400`, then yield.

So Mode B **raises** `$0D` itself, then waits for something else to **clear** it as acknowledgment. Scripts almost always `STZ $30` before Mode B.

##### Why / how used

After “you got X” dialog: publish reward id in `$05EE` for the engine/UI, set the corresponding collected-flag, and (Mode B) raise `$0D` then wait for the system to clear it as ack.

```asm
COP [1D] ( &string_07B27A )   ; “got item” text
STZ $30
COP [0D] ( #$C001 )           ; give_reward id 1; raise $0D, wait clear-ack
BRA idle
```

```asm
COP [1D] ( &string_06F0A0 )
STZ $30
COP [0D] ( #$0056 )           ; immediate: $05EE=0x56, set flag 0x456
COP [27] ( #04, #$0000 )
```

| Operand class | Count | Meaning |
|---------------|------:|---------|
| `#$C0xx` | 38 | Mode B wait+award (`$C000` = `$8000\|$4000`) |
| `#$0050` / `#$0056` | 2 | Mode A immediate |

| Item | Value |
|------|-------|
| Suggested alias | `give_reward #word` |
| Side effects | `$05EE`, `$0730` flags, possibly `$30` |

- **JSR:** `code_00DBBD`, `code_00DBEF`
- **Source examples:**
  - `system/actor_07A7F5.asm:41` — `#$C001`
  - `prinkys_mansion/mansion_west_bedroom/actor_06F05E.asm:25` — `#$0056`
  - `rococo/cokers_house/actor_05C04D.asm:76` — `#$0050`

#### COP [1B] — `apply_flag_reset` (flag word via DBBD + clear `$0553`)

- **Confidence:** high
- **Preferred name:** `apply_flag_reset`
- **Aliases:** `set_flag_word` (legacy; usually **clears**), `flag_write_stz_0553`
- **Handler:** `code_00A580` @ `extracted/system/chunk_008000.asm:5095-5109`
- **Parameters:** `Word` (same encoding as `[0A]` / `code_00DBBD`)
- **Usage count:** 4

##### What it does

1. Read Word; if **≠ 0**, `JSR code_00DBBD` (bit15 set → set `$0730` bit; clear → clear bit — identical to `[0A]`).
2. **Always** `STZ $0553`.
3. Continue.

```asm
; Handler (complete)
code_00A580 {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    CMP #$0000
    BEQ no_flag
    JSR $&code_00DBBD       ; same set/clear as [0A]
  no_flag:
    STZ $0553               ; always
    LDA $2C
    STA $02, S
    RTI
}
```

`COP [1B] ( #$0000 )` would only clear `$0553` (no DBBD); **no** such call sites.

##### Why / how used

All four shipped uses pass **clear-polarity** words in `$037x` (bit15 clear):

| Site | Operand | Effect |
|------|---------|--------|
| `mansion_east_bedroom/actor_06DB91` | `#$0347` | clear flag `$347` + STZ `$0553` |
| `map_13E/actor_0AA86A` | `#$0379` | clear `$379` (after set `#$8188`) |
| `map_16D/actor_089F38` | `#$037E` | clear `$37E` (then `[0A] #$037E` again) |
| `map_1BB/actor_0CC4DD` | `#$0370` | clear `$370` on door-open path |

So in practice this is “clear a high story/item flag **and** reset `$0553`.” `$0553` is otherwise only **cleared** from a few system/actor paths (no reads found in the extract) — treat it as a sticky UI/quest latch that `[1B]` dismisses alongside the flag write.

> **Family:** flag ops (`[0A]`/`DBBD`), **not** map. Opcode sits after `[1A]` only by jump-table order.

```asm
; jewelry recovered — set talked flag, clear quest latch flag + $0553
COP [0A] ( #$8188 )
COP [1B] ( #$0379 )
COP [CF] ( @code_… )

; bedroom cutscene end
COP [0A] ( #$8001 )
COP [1B] ( #$0347 )
COP [D0] ( #$0078 )
```

| Item | Value |
|------|-------|
| Suggested alias | `apply_flag_reset #word` |
| vs `[0A]` | Same DBBD encoding, plus mandatory `STZ $0553`; skips DBBD if word is 0 |

- **JSR:** `code_00DBBD`
- **Source examples:**
  - `prinkys_mansion/mansion_east_bedroom/actor_06DB91.asm:40` — `#$0347`
  - `unorganized/map_13E/actor_0AA86A.asm:113` — `#$0379`
  - `unorganized/map_16D/actor_089F38.asm:159` — `#$037E`
  - `unorganized/map_1BB/actor_0CC4DD.asm:17` — `#$0370`
