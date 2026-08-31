# COP family: Dialog / choice

_Deep-audited ops: `[1C]`, `[1D]`, `[1E]`, `[1F]`, `[20]`, `[21]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Show dialog strings and present choice menus — the second-largest family by usage. Variants differ by bank, yield policy, and whether music-busy (`$0872≠0`) stalls the script before text starts.

## Shared state

- `$0610` / `$05F2` — dialog mode / saved mode
- `$0ECE` — dialog-busy latch; `[1D]`/`[20]` yield
- `$05AE` — textbox active
- `$0872` — music request; dialog yields while ≠0
- `$0EEC` — last choice index for `[1C]`/`[1E]`

## Family notes

- `[21]` is a far-string dialog op — not a write-byte stub.
- Choice menus take `&&Code` lists selected via `$0EEC`.
- `[1D]` is the default cooperative show; `[1F]` skips the busy wait for cutscene timing.
- `[20]` forces bank `$88` for shared one-liners; `[21]` takes an explicit bank+pointer.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `1C` | `choice_menu` | 60 | high | Word, &&Code | `code_00A597` |
| `1D` | `show_dialog` | 1754 | high | &String | `code_00A5D3` |
| `1E` | `choice_menu_no_bank` | 1 | high | Word, &&Code | `code_00A616` |
| `1F` | `show_dialog_now` | 213 | high | &String | `code_00A63F` |
| `20` | `show_dialog_bank8` | 16 | high | &String | `code_00A660` |
| `21` | `show_dialog_far` | 5 | high | Byte bank, &String | `code_00A6A3` |

**Family call-site total:** 2049

## Opcodes

#### COP [1C] — `choice_menu` (multi-choice → branch into handler list)

- **Confidence:** high
- **Preferred name:** `choice_menu`
- **Aliases:** `menu_choice`, `branch_choice`, `yes_no_menu`
- **Handler:** `code_00A597` @ `extracted/system/chunk_008000.asm:5111-5142`
- **Parameters:** `Word` (menu layout), `&&Code` (pointer table of `&Code` handlers)
- **Usage count:** 60

##### What it does

1. `TRB #$8800` on `$06` — suppress player control during menu.
2. `PLB ← $2A` — resolve `&&Code` in **script bank**.
3. `JSL code_049B79(Word)` — run choice UI; returns with **`$0EEC` = selected index** (0-based).
4. `Y ← &&Code + ($0EEC × 2)`; load `&Code` from table; **`RTI` into that handler**.
5. `STZ $0ECE,Y` (`Y = $0ED6`) — clear dialog-busy for this slot.

Miss/cancel paths are inside `049B79`; on confirm the chosen script path runs as a near call.

**Layout word** (consumed by `code_049B79` / `code_049C95`):

| Nibble | Role |
|--------|------|
| Low (`Word & $000F`) | Column / horizontal cursor bound |
| High (`Word >> 12` … actually high byte nibble: `(Word >> 4) & $F` in stack decode) | Row / vertical bound |

Practical authoring values:

| Word | Typical use |
|------|-------------|
| `#$0202` | 2×2 grid (most common Yes/No / dual-choice) |
| `#$0004` | Single row, up to 5 entries (`code_list` with 5 `&Code`) |
| `#$0102` | Nested follow-up menu (2-wide) |

```asm
; Handler (complete)
code_00A597 {
    TYX
    PEI ($06)
    PHB
    LDA #$8800
    TRB $06
    SEP #$20
    LDA $2A
    PHA
    PLB                     ; script bank for &&Code
    REP #$20
    LDA [$2C]
    INC $2C
    INC $2C
    JSL $&code_049B79       ; A = layout word; sets $0EEC
    ASL $0EEC               ; index × 2
    LDA [$2C]
    INC $2C
    INC $2C
    CLC
    ADC $0EEC
    TAY
    LDA $0000, Y            ; &Code from list
    PLB
    PLY
    STY $06
    STA $02, S              ; RTI → chosen handler
    LDY $0ED6
    LDA #$0000
    STA $0ECE, Y            ; clear dialog busy
    RTI
}
```

##### Why / how used

Branching NPC dialog trees: show text with `[1D]`, present choices with `[1C]`, each option is a small `&Code` stub (more `[1D]`, flags, or another `[1C]`).

```asm
COP [1D] ( &string_question )
COP [1C] ( #$0202, &code_list_options )
; fallthrough if cancelled…

code_list_options [
  &option_yes   ;0
  &option_no    ;1
  &option_yes   ;2  ; duplicate slot / unused
]
```

- **JSL:** `code_049B79`
- **Source examples:**
  - `fathers_house/fathers_house/actor_078ACB.asm:104-147` — nested `#$0202` / `#$0004` / `#$0102` tree
  - `system/actor_05F238.asm` — repeated `#$0202`
  - `seaside_cave/cave_transport/actor_0691F9.asm` — `#$0202`

#### COP [1D] — `show_dialog` (standard text, cooperative)

- **Confidence:** high
- **Preferred name:** `show_dialog`
- **Aliases:** `text`, `dialog`, `message`
- **Handler:** `code_00A5D3` @ `extracted/system/chunk_008000.asm:5144-5183`
- **Parameters:** `&String` — same-bank text (`copdef`: `["&String"]`)
- **Usage count:** **1754** (second-most-used COP after `[0A]`)

##### What it does

Shows a text box via `JSL code_049288`. **Yields** if the dialog engine is already busy:

| Check | Meaning |
|-------|---------|
| `$0ECE ≠ 0` | Dialog slot busy |
| `$05AE ≠ 0` | Textbox active |
| `$0872 ≠ 0` | Music load in progress (also blocks text) |

On busy: `$28 ← address of string operand`, `RTL` (retry next tick).  
On free: save `$0610 → $05F2`, `TRB #$8800` on `$06`, **`PLB ← $2A`**, parse string, continue.

Strings use the engine’s token language (`[DEF]`, `[TPL:n]`, `[NAM:0]`, `[PAL:n]`, `[FIN]`, `[NXT]`, `[PAU:xx]`, …).

```asm
; Handler (complete)
code_00A5D3 {
    TYX
    LDA $0ECE
    BNE busy
    LDA $05AE
    BNE busy
    LDA $0872
    BNE busy
    LDA $0610
    STA $05F2
    PEI ($06)
    PHB
    LDA #$8800
    TRB $06
    SEP #$20
    LDA $2A
    PHA
    PLB                     ; string in script bank
    REP #$20
    LDA [$2C]
    INC $2C
    INC $2C
    TAY
    JSL $&code_049288
    PLB
    PLA
    STA $06
    LDA $2C
    STA $02, S
    RTI

  busy:
    LDA $2C
    DEC
    DEC
    STA $28                 ; rewind onto &String
    PLA
    PLA
    RTL
}
```

##### Why / how used

Default NPC/cutscene line — nearly every `#49`/`#68` actor. Often chains of `[1D]` for multi-page text; pairs with `[1C]` for choices, `[0A]`/`[0D]` after lines.

- **JSL:** `code_049288`
- **Source examples:**
  - Ubiquitous — e.g. `prinkys_mansion/actor_06D47A.asm:25+`, boot prologues, `tunnel_entrance/actor_05F686.asm`

#### COP [1E] — `choice_menu_no_bank` (choice UI without script-bank setup)

- **Confidence:** high
- **Preferred name:** `choice_menu_no_bank`
- **Aliases:** `choice_menu_word` (legacy), `choice_menu_inline`
- **Handler:** `code_00A616` @ `extracted/system/chunk_008000.asm:5185-5206`
- **Parameters:** `Word`, `&&Code`
- **Usage count:** 1

##### What it does

Same dispatch as `[1C]` after `code_049B79`, but:

- **No** `PLB ← $2A` (uses caller’s current data bank / `$06`).
- **No** `$0ECE` clear.
- **No** extra `$06`/`PHB` save beyond `PEI ($06)`.

For when the caller **already switched banks** (e.g. menu code at `actor_0C8000.asm` with `PLB #$8C` before `[1F]`).

```asm
code_00A616 {
    TYX
    PEI ($06)
    LDA #$8800
    TRB $06
    LDA [$2C]
    INC $2C
    INC $2C
    JSL $&code_049B79
    ASL $0EEC
    LDA [$2C]
    INC $2C
    INC $2C
    CLC
    ADC $0EEC
    TAY
    LDA $0000, Y
    PLY
    STY $06
    STA $02, S
    RTI
}
```

- **Source examples:**
  - `system/actor_0C8000.asm:325` — after `[1F]`, `#$0202, &code_list_0C82F0`

#### COP [1F] — `show_dialog_now` (immediate text, no busy wait)

- **Confidence:** high
- **Preferred name:** `show_dialog_now`
- **Aliases:** `show_dialog_ext`, `dialog_immediate`
- **Handler:** `code_00A63F` @ `extracted/system/chunk_008000.asm:5208-5225`
- **Parameters:** `&String` (`copdef`: `&String$$` — same pointer type, different **call contract**)
- **Usage count:** 213

##### What it does

Always invokes `code_049288` **immediately** — **no** `$0ECE` / `$05AE` / `$0872` busy checks, **no** `$28` yield rewind.

- `TRB #$8800` on `$06`
- String from **current bank** (no `PLB ← $2A`)
- `$0610 → $05F2` saved

Used for system/UI strings (`string_01CE1F` inventory full, `string_01D9DB`, etc.) especially in **`chunk_0B8000`** player/world helpers and warp menus where the caller already manages bank and re-entrancy via `[04]`/`return_far`.

```asm
code_00A63F {
    TYX
    LDA $0610
    STA $05F2
    PEI ($06)
    LDA #$8800
    TRB $06
    LDA [$2C]
    INC $2C
    INC $2C
    TAY
    JSL $&code_049288
    PLA
    STA $06
    LDA $2C
    STA $02, S
    RTI
}
```

##### Why / how used

“System message” path: world map (`actor_0BEFFE`), credits transitions, menu branches that must fire even when called from far gosub callees ending in `[04]`.

| vs `[1D]` | Difference |
|-----------|------------|
| Busy wait | None |
| Bank | Caller’s current bank, not forced `$2A` |
| Typical caller | System actors, menu callees |

- **Source examples:**
  - `world/actor_0BEFFE.asm:60` — `string_01CE1F` (inventory full)
  - `system/chunk_0B8000.asm` — many menu strings
  - `ocean/southern_house/actor_0CA0C4.asm:46` — `string_01D9DB`

#### COP [20] — `show_dialog_bank8` (shared `$88` one-liners)

- **Confidence:** high
- **Preferred name:** `show_dialog_bank8`
- **Aliases:** `show_dialog_8`, `show_dialog_shared`
- **Handler:** `code_00A660` @ `extracted/system/chunk_008000.asm:5227-5266`
- **Parameters:** `&String` (`copdef`: `&String$8`)
- **Usage count:** 16

##### What it does

Same **busy-wait** trinity as `[1D]` (`$0ECE`, `$05AE`, `$0872` → yield via `$28`), but:

- **`PLB ← #$88`** — strings live in **`chunk_088000`** (shared bank `$88` library).
- All 16 sites reference `string_08E5xx` / `string_08E53F` etc.

```asm
; Handler (complete) — busy path same as [1D]
code_00A660 {
    TYX
    LDA $0ECE
    BNE busy
    LDA $05AE
    BNE busy
    LDA $0872
    BNE busy
    LDA $0610
    STA $05F2
    PEI ($06)
    PHB
    LDA #$8800
    TRB $06
    SEP #$20
    LDA #$88                ; shared string bank
    PHA
    PLB
    REP #$20
    LDA [$2C]
    INC $2C
    INC $2C
    TAY
    JSL $&code_049288
    PLB
    PLA
    STA $06
    LDA $2C
    STA $02, S
    RTI
  busy:
    ; … same rewind as [1D]
}
```

##### Why / how used

Reusable barks without duplicating strings per map bank: “It's locked…”, “Mice are cute.”, “…Ah! A mouse!” — actors include `?INCLUDE 'chunk_088000'`.

| String | Text (approx) |
|--------|----------------|
| `string_08E518` | “…Ah! A mouse! Wait!” |
| `string_08E52F` | “Mice are cute.” |
| `string_08E58A` | “It's locked…” |

- **Source examples:**
  - `system/chunk_088000.asm` — string definitions
  - `seaside_cave/cave_mouth/actor_068167.asm:37` — mouse bark
  - `system/actor_0BD8F4.asm` — locked-door lines
  - `prinkys_mansion/mansion_north_foyer/actor_06D014.asm:22`

#### COP [21] — `show_dialog_far` (explicit bank + string pointer)

- **Confidence:** high
- **Preferred name:** `show_dialog_far`
- **Aliases:** `show_dialog_bank`, `dialog_far`, `text_far` (legacy misname: `write_byte_to_addr`)
- **Handler:** `code_00A6A3` @ `extracted/system/chunk_008000.asm:5268-5294`
- **Parameters:** `Byte` bank, `&String` / `Word` pointer (`copdef`: `["Byte", "Word"]`; asm: `^label, &label`)
- **Usage count:** 5

##### What it does

Far-string dialog: switch data bank to the **operand bank**, then run the same textbox engine as `[1D]`/`[1F]`/`[20]`.

1. `$0610 → $05F2` (save dialog mode)
2. `PEI ($06)` / `PHB`
3. Read **bank byte** → `PLB`
4. `TRB #$8800` on `$06` (suppress player control)
5. Read **16-bit string pointer** → `Y`
6. `JSL code_049288` — parse/display
7. Restore bank / `$06`; continue

**No busy wait** (unlike `[1D]`/`[20]`) — same immediacy as `[1F]`, but bank comes from the operand instead of “current bank.”

```asm
; Handler (complete)
code_00A6A3 {
    TYX
    LDA $0610
    STA $05F2
    PEI ($06)
    PHB
    LDA [$2C]
    INC $2C
    AND #$00FF              ; bank byte (^string → bank of label)
    SEP #$20
    PHA
    PLB                     ; data bank = string bank
    REP #$20
    LDA #$8800
    TRB $06
    LDA [$2C]
    INC $2C
    INC $2C
    TAY                     ; &String
    JSL $&code_049288
    PLB
    PLA
    STA $06
    LDA $2C
    STA $02, S
    RTI
}
```

Assembler form always pairs the bank of a string with its pointer:

```asm
COP [21] ( ^string_XXXX, &string_XXXX )
;          ^ = bank byte of label
;          & = 16-bit offset in that bank
```

##### Why / how used

Show a string that lives in **another bank** than the calling actor (world map in `$0B` talking to `$88` labels; boot menu in `$0B` talking to `$01` strings) without permanently switching `$2A` or relying on the caller’s `PLB`.

| Site | Operands | Role |
|------|----------|------|
| `world/actor_0BEFFE` | `^/&string_08DABF` | World-map name HUD (`[TBL:…,05B2]`) |
| same | `string_08DAD1` / `08DAE3` | Map-name boxes at two Y positions (`[TBL:…,05A8]`) |
| `system/actor_0B80B9` | `string_01D75E` | Boot menu: “Start Game / Copy Log / Erase Log” |
| `system/actor_0C8000` | `string_01CE1F` | Menu branch: clear/dismiss token string (`[CA][DES]`) |

```asm
; world map: HUD label from bank $88 while actor runs elsewhere
COP [21] ( ^string_08DABF, &string_08DABF )
COP [CB]

; boot file menu header (bank $01 strings)
COP [21] ( ^string_01D75E, &string_01D75E )
```

| vs | Difference |
|----|------------|
| `[1D]` | Script bank + busy yield |
| `[1F]` | Immediate, but **current** bank only |
| `[20]` | Hardcoded bank `$88` + busy yield |
| `[21]` | **Any** bank via operand; immediate |

| Item | Value |
|------|-------|
| Suggested alias | `show_dialog_far ^bank_of_str, &str` |
| Engine | `code_049288` (same as other dialog COPs) |

- **JSL:** `code_049288`
- **Source examples:**
  - `world/actor_0BEFFE.asm:37,161,165` — map-name HUD strings in `$88`
  - `system/actor_0B80B9.asm:416` — `string_01D75E` file menu
  - `system/actor_0C8000.asm:348` — `string_01CE1F` then `[04]`
