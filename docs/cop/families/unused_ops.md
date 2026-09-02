# Unused Ops — COP `[7F]`

> Deep-audited ops: `[7F]`

## Overview

COP `[7F]` is the **only slot in the entire 251-entry COP jump table** (`code_list_009F10`) that does not point to a valid handler. Its entry is `#$FFFF`, which would cause the CPU to jump to `$00:FFFF` — the last byte of the SNES interrupt vector table — if executed. This would crash the game.

## Analysis

### Jump table entry

```
  code_list_009F10 [
    ...
    &code_00B4DA   ;7E      ← valid handler (resume_deferred_interact)
    #$FFFF         ;7F      ← INVALID — sole sentinel in 251 slots
    &code_00BE3E   ;80      ← valid handler (set_anim_id)
    ...
  ]
```

### COP dispatcher (`code_009EE8`)

```asm
code_009EE8 {
    REP #$20
    TXY
    LDA $04, S
    STA $2E                ; save bank byte
    LDA $02, S
    DEC
    STA $2C                ; set script pointer
    LDA [$2C]              ; read opcode byte
    INC $2C
    AND #$00FF             ; mask to 8 bits
    ASL                    ; × 2 (word-sized table entries)
    TAX
    JMP ($&code_list_009F10, X)   ; indexed indirect jump
}
```

There is **no bounds check, no sentinel detection, and no special-case for `$7F`**. The opcode byte is converted directly to a table offset. Any opcode from `$00` to `$FA` (the table has 251 entries = slots `$00`–`$FA`) reaches a valid handler — except `$7F`.

### What would happen

1. Dispatcher reads `#$7F` from the script stream
2. Computes table offset: `0x7F × 2 = 0xFE`
3. Reads the 16-bit value at `code_list_009F10 + 0xFE` = `#$FFFF`
4. Executes `JMP $FFFF` in bank 00
5. `$00:FFFF` is the high byte of the native-mode IRQ/BRK vector in the SNES memory map
6. The CPU begins executing data as code — **undefined behavior / crash**

### Why it exists

Slot `$7F` (`127`) sits at the boundary between the "low half" (`$00`–`$7E`) and "high half" (`$80`–`$FA`) of the opcode space. This suggests a deliberate reservation or removed feature:

- **copdef.json** skips it entirely (id 127 is absent; `[7E]` is id 126, `[80]` is id 128)
- **Jump table** uses `#$FFFF` as a sentinel — the only such entry among 251 slots
- **No call sites** exist anywhere in the extracted ROM
- Every other copdef-missing opcode (e.g., `[14]`–`[16]`, `[3F]`, `[40]`, `[43]`, `[4F]`, `[60]`, `[70]`) still has a valid handler in the jump table — they're merely missing from the disassembler definitions, not actually unused

The most likely explanation is that `$7F` was **intentionally reserved as a dead slot** — possibly as a boundary marker between two opcode ranges, or a slot that was allocated during development but never implemented.

### Cross-reference: other `#$FFFF` patterns

The `#$FFFF` sentinel appears frequently in **other** tables in the ROM (e.g., a data table at lines 2780–2799 with slots `$38`–`$4B` all set to `#$FFFF`). In those contexts it marks unused/padding entries. The COP jump table uses the same convention but applies it to exactly one slot.

## Opcode

---

#### COP [7F] — `unused_crash`

- **Confidence:** high
- **Preferred name:** `unused_crash`
- **Aliases:** `dead_slot`, `reserved_7f`
- **Handler:** none (`#$FFFF` sentinel → crashes if dispatched)
- **Parameters:** undefined (not in copdef.json)
- **Usage count:** 0
- **Behavior:** Jumps to `$00:FFFF` (interrupt vector area), crashes

## Usage statistics

| Op | Name | Sites | Files |
|----|------|------:|------:|
| `[7F]` | `unused_crash` | 0 | 0 |
