# COP family: Currency (GP)

_Deep-audited ops: `[5C]`, `[5D]`, `[5E]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

Add, spend, and test **Gold Points (GP)** — the game's currency stored as a **5-digit BCD** number in `$06E6`/`$06E8`. Displayed in menus as `[NUM:5,06E6]GP`. Adjacent op `[5B]` (focus-id branch) is from the tracked_ids family.

## Shared state

- `$06E6` — GP counter, low 4 BCD digits (word)
- `$06E8` — GP counter, high BCD digit (only low nibble meaningful)
- `code_08EE75` — BCD add to `$06E6`/`$06E8`; saturates at 99999
- `code_08EE99` — BCD subtract from `$06E6`/`$06E8`; restores on underflow (SEC = fail)

### BCD encoding

Operands and the counter itself use **binary-coded decimal**. `#$5000` means 5000 GP, not hex 0x5000. The CPU enters BCD mode (`SED`) before arithmetic and exits (`CLD`) after.

### Parallel EXP counter

`$06DE`/`$06E0` hold EXP in the same BCD format, with parallel helpers `code_08EE51` (add EXP) and `code_08EEBD` (level calc). COP `[0D]` (`give_reward`) touches EXP; `[5C]`/`[5D]` are GP-only.

## Family notes

- `[5C]` always continues — no branch, no failure path.
- `[5D]` **branches on failure** (insufficient funds → `&Code`); success falls through.
- `[5D]` with operand `#$FFFF` is a special sentinel: zeroes GP entirely, always succeeds.
- `[5E]` **branches on success** (can afford → `&Code`); insufficient falls through. **Non-destructive** — subtracts then adds back.
- All observed BCD amounts: `#$0001` (1), `#$0010` (10), `#$0050` (50), `#$0100` (100), `#$0500` (500), `#$1000` (1000), `#$2000` (2000), `#$3000` (3000), `#$5000` (5000).

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `5C` | `add_gp` | 7 | high | Word (BCD) | `code_00B533` |
| `5D` | `spend_gp` | 7 | high | Word (BCD), &Code | `code_00B543` |
| `5E` | `branch_if_can_afford` | 4 | high | Word (BCD), &Code | `code_00B566` |

**Family call-site total:** 18

## Opcodes

#### COP [5C] — `add_gp` (award gold points)

- **Confidence:** high (handler + `code_08EE75` + menu string `[NUM:5,06E6]GP` confirmed)
- **Preferred name:** `add_gp`
- **Aliases:** `give_money`, `award_gold`
- **Handler:** `code_00B533` @ `extracted/system/chunk_008000.asm:7455-7464`
- **Parameters:** `Word` amount (BCD-encoded)
- **Usage count:** 7

##### What it does

```asm
code_00B533 {
    TYX
    LDA [$2C]              ; read BCD amount
    INC $2C
    INC $2C
    JSL $@code_08EE75      ; BCD add → $06E6/$06E8
    LDA $2C
    STA $02, S
    RTI                    ; always continue
}
```

`code_08EE75` (`extracted/system/chunk_08D15C.asm:3129-3147`):

1. `SED; CLC; ADC $06E6` — BCD add low digits.
2. Carry into `$06E8`.
3. Saturate at 99999 if overflow (`$06E8 BIT #$FFF0 ≠ 0`).
4. `CLD; RTL`.

##### All 7 call sites

| Amount | File | Context |
|-------:|------|---------|
| 5000 | `unorganized/actor_09CE8F.asm:67` | Research funds quest |
| 5000 | `unorganized/map_16D/actor_089F38.asm:191` | Quest reward |
| 3000 | `ocean/southern_house/actor_0CA0C4.asm:47` | NPC reward |
| 2000 | `system/actor_0C8FF5.asm:47` | Quest reward |
| 1000 | `seaside_cave/cave_lair/actor_06A5B3.asm:96` | Boss reward |
| 1000 | `unorganized/map_D9/actor_05DF59.asm:144` | Quest reward |
| 500 | `unorganized/map_100/actor_0ACA83.asm:180` | Small quest reward |

##### Typical usage

```asm
    COP [1F] ( &string_01D9DB )       ; clear text
    COP [5C] ( #$1000 )               ; award 1000 GP
    COP [1D] ( &string_… )            ; reward dialog
```

| Item | Value |
|------|-------|
| Suggested alias | `add_gp #amount` |
| Max | 99999 GP (saturates) |
| Always continues | no branch |

- **WRAM:** `$06E6`, `$06E8`
- **JSL:** `code_08EE75`

#### COP [5D] — `spend_gp` (deduct gold points; branch if insufficient)

- **Confidence:** high (handler + `code_08EE99` + dialog strings confirmed)
- **Preferred name:** `spend_gp`
- **Aliases:** `deduct_gp`, `branch_if_cant_afford`, `buy`
- **Handler:** `code_00B543` @ `extracted/system/chunk_008000.asm:7466-7487`
- **Parameters:** `Word` amount (BCD-encoded), `&Code` on_insufficient
- **Usage count:** 7

##### What it does

```asm
code_00B543 {
    TYX
    LDA [$2C]              ; read BCD amount
    INC $2C
    INC $2C
    CMP #$FFFF             ; sentinel?
    BEQ clear_all
    JSL $@code_08EE99      ; BCD subtract
    BCS insufficient       ; SEC = not enough
    JMP $&code_009F00      ; success → skip &Code
  insufficient:
    LDA [$2C]              ; fail → goto &Code
    STA $02, S
    RTI
  clear_all:
    STZ $06E6              ; #$FFFF → zero GP
    STZ $06E8
    JMP $&code_009F00
}
```

`code_08EE99` (`extracted/system/chunk_08D15C.asm:3149-3174`):

1. `SED; SEC; SBC` — BCD subtract.
2. If borrow → restore original, **SEC** (fail).
3. Otherwise store, **CLC** (success).

##### Branch polarity

- **Success:** deduct, fall through.
- **Failure:** restore GP, goto `&Code`.
- **`#$FFFF`:** zero GP entirely, always fall through.

##### All 7 call sites

| Amount | File | Context |
|-------:|------|---------|
| 5000 | `volcano_base/.../actor_09AC21.asm:115` | Research funds quest |
| 5000 | `unorganized/map_143/actor_0AB4CB.asm:44` | Payment |
| 500 | `unorganized/map_100/actor_0AD22C.asm:160` | "Hand over 500 GP" |
| 10 | `unorganized/map_139/actor_0A8C3E.asm:119` | Shop item |
| 100 | `unorganized/map_139/actor_0A8C3E.asm:126` | Shop item |
| 1000 | `unorganized/map_139/actor_0A8C3E.asm:133` | Shop item |
| clear | `volcano_base/.../actor_09AC21.asm:131` | Lose all GP |

##### Typical usage

```asm
    ; Shop purchase with fallback
    COP [5D] ( #$0010, &code_0A8D6B )    ; try spend 10 GP
    COP [1D] ( &string_0A8EA5 )           ; "You bought X"
    COP [78] ( #82, #$0010 )              ; give item
```

```asm
    ; Zero all money
    COP [5D] ( #$FFFF, &code_09AD2E )    ; clear GP
```

| Item | Value |
|------|-------|
| Suggested alias | `spend_gp #amount, &on_cant_afford` |
| Success | deduct, fall through |
| Failure | restore GP, goto `&Code` |
| `#$FFFF` | zero GP, fall through |

- **WRAM:** `$06E6`, `$06E8`
- **JSL:** `code_08EE99`

#### COP [5E] — `branch_if_can_afford` (non-destructive GP test)

- **Confidence:** high (handler + round-trip subtract/add + all 4 call sites verified)
- **Preferred name:** `branch_if_can_afford`
- **Aliases:** `test_gp`, `check_gp_nondestructive`
- **Handler:** `code_00B566` @ `extracted/system/chunk_008000.asm:7488-7502`
- **Parameters:** `Word` amount (BCD-encoded), `&Code` on_affordable
- **Usage count:** 4

##### What it does

```asm
code_00B566 {
    TYX
    LDA [$2C]              ; read BCD amount
    INC $2C
    INC $2C
    JSL $@code_08EE99      ; subtract from GP
    BCS not_enough         ; SEC = insufficient
    JSL $@code_08EE75      ; add back (net zero)
    LDA [$2C]              ; can afford → goto &Code
    STA $02, S
    RTI
  not_enough:
    JMP $&code_009F00      ; can't afford → fall through
}
```

Subtract-then-add round-trip: tests affordability without spending.

##### Branch polarity (inverted vs `[5D]`)

| | `[5D]` spend_gp | `[5E]` branch_if_can_afford |
|-|-----------------|----------------------------|
| Enough GP | deduct, fall through | no change, **goto `&Code`** |
| Not enough | goto `&Code` | fall through |
| Destructive? | yes | **no** |

##### All 4 call sites

| Amount | File | Context |
|-------:|------|---------|
| 100 | `system/actor_05A52E.asm:10` | Wealth tier — top (`#$0100` BCD) |
| 50 | `system/actor_05A52E.asm:11` | Wealth tier — mid (`#$0050` BCD) |
| 10 | `system/actor_05A52E.asm:12` | Wealth tier — low (`#$0010` BCD) |
| 1 | `volcano_base/.../actor_09AC21.asm:123` | Has any money? (`#$0001` BCD) |

##### Typical usage

```asm
    ; Cascading wealth tiers — sets flags based on GP range
    COP [5E] ( #$0100, &code_05A55B )    ; ≥ 100 GP? → set all flags
    COP [5E] ( #$0050, &code_05A557 )    ; ≥ 50 GP?  → set mid+low
    COP [5E] ( #$0010, &code_05A553 )    ; ≥ 10 GP?  → set low
    COP [0A] ( #$81C6 )                  ; else: base flag only
```

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_can_afford #amount, &on_affordable` |
| Affordable | goto `&Code` (GP unchanged) |
| Not affordable | fall through |

- **WRAM:** `$06E6`, `$06E8` (tested but restored)
- **JSL:** `code_08EE99`, `code_08EE75`
