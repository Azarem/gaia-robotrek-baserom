# COP family: Input / pad

_Deep-audited ops: `[33]`, `[34]`, `[35]`, `[36]`, `[37]`, `[38]`, `[39]`, `[3A]`, `[3B]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Pad inhibit masks, handler vector install/dispatch, and wait/branch on live pad bits. Covers the full input stack used by cutscenes and menus.

## Shared state

- `$056E` — inhibit mask (`[34]` set / `[33]` clear)
- `$0560` / `$0562` — live / post-mask pad
- `$056A` — ack / consume mask (`[39]`)
- `$0574`–`$058B` — 12 pad-handler vectors
- `$0572` — bits eligible for `[37]` dispatch

## Family notes

- Subgroups: inhibit `[33]`/`[34]`; dispatch `[35]`–`[37]`; wait/branch `[38]`–`[3B]`.
- `[35]` was formerly misnamed `branch_random` — it is **not** RNG.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `33` | `unmask_input` | 278 | high | Word | `code_00ACCF` |
| `34` | `mask_input` | 337 | high | Word | `code_00ACDE` |
| `35` | `bind_pad_handler` | 44 | high | Byte, &Code | `code_00ACF0` |
| `36` | `install_pad_profile` | 108 | high | &unk21 | `code_00AD07` |
| `37` | `dispatch_pad` | 6 | high | &Code | `code_00AD17` |
| `38` | `wait_pad` | 3 | high | Word | `code_00AE01` |
| `39` | `wait_pad_ack` | 5 | high | Word | `code_00AE1D` |
| `3A` | `branch_if_pad` | 12 | high | Word, &Code | `code_00AE3C` |
| `3B` | `branch_if_pad_clear` | 45 | high | Word, &Code | `code_00AE50` |

**Family call-site total:** 838

## Opcodes

#### COP [33] — `unmask_input` (clear pad inhibit bits)

- **Confidence:** high
- **Preferred name:** `unmask_input`
- **Aliases:** `enable_input`, `clear_input_mask`, `clear_game_flags_056E`
- **Handler:** `code_00ACCF` @ `extracted/system/chunk_008000.asm:6227-6236`
- **Parameters:** `Word` bitmask
- **Usage count:** 278

##### What it does

```asm
code_00ACCF {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    TRB $056E              ; clear inhibit bits → those pads allowed again
    LDA $2C
    STA $02, S
    RTI
}
```

Does **not** touch `$0560`. Re-enabling takes effect on the next input poll (which `TRB`s `$056E` out of live pad state).

#### COP [34] — `mask_input` (set pad inhibit bits)

- **Confidence:** high
- **Preferred name:** `mask_input`
- **Aliases:** `disable_input`, `lock_controls`, `set_game_flags_056E`
- **Handler:** `code_00ACDE` @ `extracted/system/chunk_008000.asm:6238-6248`
- **Parameters:** `Word` bitmask
- **Usage count:** 337

##### What it does

```asm
code_00ACDE {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    TSB $056E              ; arm inhibit bits
    TRB $0560              ; also clear them from live pad *this* frame
    LDA $2C
    STA $02, S
    RTI
}
```

##### How `$056E` / `$0560` work

Each frame the pad driver (`chunk_048000.asm` ~`code_04802B`) builds `$0560` from raw `$0566` + button remaps, then:

```asm
LDA $056A
TRB $0560
LDA $056E                  ; ★ inhibit mask
TRB $0560                  ; strip masked buttons
LDA $0560
STA $0562                  ; published filtered pad
```

Consumers of “unmasked presses” use `(~$056E) & $0560` (e.g. menu `actor_0B80B9`, `COP [37]`). Player walk (`actor_0BD8F4`) also `BIT $056E` with `#$0F00` to refuse control while those bits are locked.

So:

| Op | Effect |
|----|--------|
| `[34] #mask` | **Block** those buttons (mask + immediate clear) |
| `[33] #mask` | **Allow** those buttons again |

##### Bitmasks in source (only 3 values!)

| Value | Count `[33]` / `[34]` | Meaning |
|-------|----------------------:|---------|
| `#$FF50` | 223 / 259 | Standard cutscene lock — blocks most action/dir bits; leaves `#$00AF` clear |
| `#$FFF0` | 54 / 77 | Stricter lock — only low nibble `#$000F` remains unmasked |
| `#$0F40` | 1 / 1 | Rare narrow mask |

`#$FF50` bits **masked** (blocked): `$0010,$0040,$0100–$8000`  
`#$FF50` bits **left free**: `$0001–$0008,$0020,$0080`

##### Canonical cutscene pattern

```asm
    COP [34] ( #$FF50 )          ; lock player controls
    COP [1D] ( &string_… )       ; dialog / walk / teleport …
    COP [33] ( #$FF50 )          ; restore controls
```

Examples: enter scene with `[34]`, exit/despawn with `[33]` (`fathers_yard/actor_07863A`); talk cutscenes bracket dialog the same way (`map_D9/actor_05DF59`, native village).

| Item | Value |
|------|-------|
| Suggested aliases | `mask_input #$FF50` / `unmask_input #$FF50` |
| Pair | Almost always matched `[34]`…`[33]` with the **same** mask |
| Related | `[37]` / menu input loops read unmasked `$0560` |

##### Family summary (`[33]`–`[34]`)

| Op | Name | Role |
|----|------|------|
| `[33]` | `unmask_input` | `TRB $056E` — re-enable pad bits |
| `[34]` | `mask_input` | `TSB $056E` + `TRB $0560` — lock pad bits now |

- **Source examples:**
  - `fathers_house/fathers_yard/actor_07863A.asm:14,65` — lock at start, unlock before `[B2]`
  - `fathers_house/fathers_house/actor_078ACB.asm:43` — lock before dialog
  - `unorganized/map_D9/actor_05DF59.asm:44,74` — lock for scene, unlock after
  - `native_village/native_village/actor_07B7D4.asm:30,65` — unlock then later relock
  - `fathers_house/farmers_house/actor_07A382.asm:53` — `#$FFF0` variant

#### COP [35] — `bind_pad_handler` (patch one `$0574` vector)

- **Confidence:** high
- **Preferred name:** `bind_pad_handler`
- **Aliases:** `set_pad_vector`, `bind_button`, `branch_random` (old misnomer — **not** RNG)
- **Handler:** `code_00ACF0` @ `extracted/system/chunk_008000.asm:6250-6263`
- **Parameters:** `Byte` slot_offset, `&Code` handler (or `#$0000` to clear)
- **Usage count:** 44

##### What it does

```asm
code_00ACF0 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    TAY                       ; byte = word offset into $0574
    LDA [$2C]
    INC $2C
    INC $2C
    STA $0574, Y              ; install / clear one handler
    LDA $2C
    STA $02, S
    RTI
}
```

`$0574` holds **12 word vectors** (offsets `#00,#02,…,#16`). `[35]` patches exactly one. `#$0000` clears the slot (dispatch treats 0 as “no handler”).

##### Slot → pad bit

Same layout `[37]` / `[36]` use (bit starts at `$8000`, `LSR` per slot):

| Byte | Bit | Common use |
|-----:|----:|------------|
| `#00` | `$8000` | Confirm / primary (14 binds) |
| `#08` | `$0800` | |
| `#0A` | `$0400` | |
| `#0C` | `$0200` | (5) |
| `#0E` | `$0100` | (5) |
| `#10` | `$0080` | Cancel / secondary (16 — most common) |

##### How it is used

UI code installs or swaps handlers after a profile is loaded — e.g. menu lists bind `#10` (cancel) and `#00` (ok) to different routines per screen:

```asm
; chunk_038000 — attach OK/Cancel for a list UI
COP [35] ( #10, &code_03C0BE )
COP [35] ( #00, &code_03C0F5 )
```

Also used to **clear**: `COP [35] ( #0C, #$0000 )`.

| Item | Value |
|------|-------|
| Suggested alias | `bind_pad_handler #slot, &handler` |
| Does **not** | Touch `$056E` / `$0572` (unlike `[36]`) |

- **Source examples:**
  - `system/chunk_0B8000.asm` — `#10, &code_0B8172` (×9)
  - `system/chunk_038000.asm:7654-7655` — `#10` / `#00` pair
  - `system/chunk_038000.asm` — `#0C/#0E, #$0000` clears

---

#### COP [36] — `install_pad_profile` (bulk-load unk21 → `$0574` + masks)

- **Confidence:** high
- **Preferred name:** `install_pad_profile`
- **Aliases:** `install_unk21_table`, `install_input_table`, `set_pad_table`
- **Handler:** `code_00AD07` @ `extracted/system/chunk_008000.asm:6265-6274` → `code_08F1A4`
- **Parameters:** `&unk21` — 12 slot entries + trailer word(s)
- **Usage count:** 108

##### What it does

```asm
code_00AD07 {
    TYX
    LDA [$2C]                 ; &unk21
    INC $2C
    INC $2C
    JSL $@code_08F1A4
    …
}
```

`code_08F1A4` (`chunk_088000.asm:3665`) walks 12 words with running bit `$8000→…→$0010`:

| Slot value | Effect |
|------------|--------|
| `0` / `unk25` (`#$FFFF`) | Clear `$0574` slot; **`TRB $056E`** (unmask that bit) |
| `1` / `unk26` | Clear slot; **`TSB $056E`** (mask / block that bit) |
| other / `unk24 &Code` | Store handler; **`TRB $056E`** (allow bit) |

Then loads trailer:

- Word → `$0572` (which bits `[37]` may dispatch)
- If `$0572` bit0 set: two more words → `$0EE8`, `$0EEA`

##### unk21 shape (from `us/structs.json` + extract)

```asm
unk21_0BB5C3 [
  unk21 < [
    unk25 <  >              ;00  $8000 — empty
    unk24 < &code_0BE86A >  ;01  $4000 — handler
    unk24 < &code_0BE22E >  ;02  $2000
    …
    unk24 < &code_0BE278 >  ;08  $0080 — interact
    …
  ], [
    unk22 < #$40F0 >        ; → $0572
  ] >
]
```

Player host (`actor_0BD8F4`) installs `unk21_0BB5C3` then polls with `[37]`. Menu roots use `unk21_0BB58F` (`$0572=#$0C00`). Overworld companion host uses `unk21_0BB5A9`.

| Item | Value |
|------|-------|
| Suggested alias | `install_pad_profile &unk21_…` |
| Side effects | Rewrites all 12 `$0574` slots + `$056E` bits + `$0572` |

- **Source examples:**
  - `system/actor_0BD8F4.asm:34` — `&unk21_0BB5C3` (player)
  - `system/actor_0BD8A1.asm:24` — `&unk21_0BB5A9`
  - `system/chunk_0B8000.asm:39` — `&unk21_0BB58F` (menus)

---

#### COP [37] — `dispatch_pad` (one-shot pad → handler, else fall through)

- **Confidence:** high
- **Preferred name:** `dispatch_pad`
- **Aliases:** `poll_pad`, `on_pad`, `loop_to` (old name — only the idle `&Code` is a loop head)
- **Handler:** `code_00AD17` @ `extracted/system/chunk_008000.asm:6276-6374`
- **Parameters:** `&Code` idle/fallback (stored in `$7F001A`)
- **Usage count:** 6 (all system player/host actors)

##### What it does

```asm
code_00AD17 {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    STA $7F001A, X            ; plant idle vector for [01] returns

    LDA $056E
    EOR #$FFFF
    AND $0560                 ; unmasked pressed bits
    BEQ no_input

    ; priority scan → Y = $0574 offset for first matching bit
    ; (order: $0080, $0040, $4000, $0800, …, $8000)
    AND $0572                 ; profile enable mask
    TSB $056A
    ; STA $0564 ← which bit fired
    LDA $0574, Y
    BEQ no_input
    STA $02, S                ; RTI → button handler
    ; also push script bank $2A
    RTI

  no_input:
    STZ $0564
    LDA $2C
    STA $02, S                ; fall through past [37]
    RTI
}
```

**Not a wait.** Each call either jumps to a bound handler or continues to the next instruction the same tick.

##### Canonical player loop

```asm
; actor_0BD8F4.asm
    COP [36] ( &unk21_0BB5C3 )     ; install profile
code_0BD91D:
    COP [CB]
    ; … blink $06 bit $2000, wait flag …
    STX $0EEE
    COP [37] ( &code_0BD91D )      ; dispatch or fall through
    JMP $&code_0BD937              ; player locomotion
```

Button handlers live in the unk21 / `[35]` tables (e.g. `code_0BE278` interact). `$7F001A` holds the poll label so a handler can `COP [01]` back into the loop.

| Item | Value |
|------|-------|
| Suggested alias | `dispatch_pad &idle_loop` |
| Requires | `$0574`/`$0572` filled (`[36]` and/or `[35]`) |
| Sites | `actor_0BD8F4` (×4 modes), `actor_0BD8A1`, `chunk_038000` |

- **Source examples:**
  - `system/actor_0BD8F4.asm:45` — `&code_0BD91D`
  - `system/actor_0BD8A1.asm:34` — `&code_0BD8DA`
  - `system/chunk_038000.asm:3733` — `&code_03A13E`

##### How they relate (shared table, different jobs)

These three are **not** a sequential family like `[33]`/`[34]`, but they share the pad-vector table:

| Op | Job |
|----|-----|
| `[36]` | Load a full profile (handlers + masks) from unk21 |
| `[35]` | Override / clear one handler slot |
| `[37]` | Poll once and RTI to a handler (or fall through) |

Typical pipeline: `[36]` once → loop with `[37]` → occasional `[35]` to rebind a button for a submenu.

#### COP [38] — `wait_pad` (yield until pad bits pressed)

- **Confidence:** high
- **Preferred name:** `wait_pad`
- **Aliases:** `wait_button`, `set_word` (old misnomer)
- **Handler:** `code_00AE01` @ `extracted/system/chunk_008000.asm:6376-6395`
- **Parameters:** `Word` pad mask
- **Usage count:** 3

##### What it does

```asm
code_00AE01 {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    AND $0560
    BEQ wait                  ; no masked bits down → yield
    LDA $2C
    STA $02, S                ; pressed → continue after [38]
    RTI

  wait:
    LDA $2C
    SEC
    SBC #$0004                ; rewind to COP opcode
    STA $28
    PLA
    PLA
    RTL                       ; yield; re-run [38] next frame
}
```

Scripts usually `STZ $0560` first so a held button from before the wait doesn’t instantly pass.

| Mask | Sites | Role |
|------|------:|------|
| `#$D0C0` | title / boot (2) | Wait for start-ish combo to leave title |
| `#$0F00` | player host (1) | Wait for face-button nibble after unmask |

```asm
; boot/title_screen/actor_04E49A.asm
STZ $0560
COP [38] ( #$D0C0 )
COP [18] ( #$0005, … )          ; then load next map
```

| Item | Value |
|------|-------|
| Suggested alias | `wait_pad #mask` |
| Ack | None — bits stay in `$0560` |

#### COP [39] — `wait_pad_ack` (wait + mark bits for consume)

- **Confidence:** high
- **Preferred name:** `wait_pad_ack`
- **Aliases:** `wait_button_consume`, `set_word_alt` (old misnomer)
- **Handler:** `code_00AE1D` @ `extracted/system/chunk_008000.asm:6397-6417`
- **Parameters:** `Word` pad mask
- **Usage count:** 5

##### What it does

Same yield/rewind loop as `[38]`, but on success:

```asm
AND $0560
BEQ wait
STA $056A                     ; ★ queue matched bits for poller ack
; continue
```

Pad driver (`chunk_048000`) later does `LDA $056A / TRB $0560`, so the press is **consumed** and won’t retrigger. Menu yes/no prompts use this, then inspect `$0560` the same tick:

```asm
; chunk_0B8000 — confirm dialog
STZ $0560
COP [39] ( #$8080 )             ; wait A and/or B-class bits
LDA $0560
BIT #$8000
BNE chose_primary
; else secondary / cancel path
```

| Mask | Count | Notes |
|------|------:|-------|
| `#$8080` | 3 | Dual-button confirm |
| `#$C0C0` | 1 | Wider pair |
| `#$F0FF` | 1 | Almost any button (`chunk_038000`) |

| Item | Value |
|------|-------|
| Suggested alias | `wait_pad_ack #mask` |
| Diff vs `[38]` | Writes `$056A` so the press is cleared next poll |

#### COP [3A] — `branch_if_pad` (goto if mask bits pressed)

- **Confidence:** high
- **Preferred name:** `branch_if_pad`
- **Aliases:** `branch_if_button`, `branch_if_word` (old)
- **Handler:** `code_00AE3C` @ `extracted/system/chunk_008000.asm:6419-6432`
- **Parameters:** `Word` mask, `&Code` target
- **Usage count:** 12

##### What it does

```asm
code_00AE3C {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C
    BIT $0560
    BNE taken                 ; any mask bit set → branch
    JMP $&code_009F00         ; else skip &Code

  taken:
    LDA [$2C]
    STA $02, S
    RTI
}
```

Non-blocking. Used to **break out** of a wait/anim loop when a button is held:

```asm
; mansion_east_library — loop until cancel bit
loc_06E060:
    COP [3A] ( #$0800, &code_06E01A )   ; pressed → idle
    COP [80] ( #00 )
    COP [97]
    BRA loc_06E060
```

| Mask | Count | Notes |
|------|------:|-------|
| `#$0B00` | 6 | Multi-bit “any of these” |
| `#$0800` | 2 | |
| `#$0F00` / `#$0100` / `#$0200` | rest | |

#### COP [3B] — `branch_if_pad_clear` (goto if mask bits **not** pressed)

- **Confidence:** high
- **Preferred name:** `branch_if_pad_clear`
- **Aliases:** `branch_unless_pad`, `branch_if_button_up`, `branch_if_word_alt` (old)
- **Handler:** `code_00AE50` @ `extracted/system/chunk_008000.asm:6434-6447`
- **Parameters:** `Word` mask, `&Code` target
- **Usage count:** 45

##### What it does

Exact inverse of `[3A]`:

```asm
BIT $0560
BEQ taken                     ; no mask bits down → branch
JMP $&code_009F00             ; pressed → fall through
```

Canonical “press to talk” gate after facing/proximity already matched:

```asm
; fathers_house/actor_078ACB.asm
code_078AF8 {
    COP [80] ( #00 )
    COP [97]
    COP [3B] ( #$0400, &code_078AE0 )  ; not pressed → back to idle
    COP [1D] ( &string_079054 )        ; pressed → dialog
    …
}
```

| Mask | Count | Notes |
|------|------:|-------|
| `#$0800` | ~19 | Most common face/action bit |
| `#$0400` | ~18 | |
| `#$0B00` | ~2 | Combined |
| others | | `#$0100`, `#$0200`, `#$0080`, `#$0E80` |

##### Family summary (`[38]`–`[3B]`)

All four test **`$0560`** (live pad). Pair with `[33]`/`[34]` masks and `[36]`/`[37]` profiles.

| Op | Name | Blocking? | Condition |
|----|------|-----------|-----------|
| `[38]` | `wait_pad` | yield until true | mask ∩ pad ≠ 0 |
| `[39]` | `wait_pad_ack` | yield until true | same + `STA $056A` |
| `[3A]` | `branch_if_pad` | no | mask bits **set** → goto |
| `[3B]` | `branch_if_pad_clear` | no | mask bits **clear** → goto |

- **Source examples:**
  - `boot/title_screen/actor_04E49A.asm:15` — `[38] #$D0C0`
  - `system/actor_0BD8F4.asm:380` — `[38] #$0F00`
  - `system/chunk_0B8000.asm:4807` — `[39] #$8080`
  - `prinkys_mansion/mansion_east_library/actor_06DFA3.asm:58,76` — `[3B]` / `[3A]` pair
  - `fathers_house/fathers_house/actor_078ACB.asm:33` — `[3B] #$0400`
