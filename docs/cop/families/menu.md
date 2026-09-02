# COP family: Menu

_Deep-audited ops: `[65]`, `[66]`, `[67]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

Open full-screen **menu / UI** screens and perform **save operations** from actor scripts. Menu ops mask pads and clear interaction flags during execution. `[67]` writes save data to SRAM.

## Shared pattern

All menu ops follow the same structure:
1. Save `$06` (actor flags) via `PEI`
2. Clear `#$8800` in `$06` (disable interaction bits)
3. Set `$056E = #$000F` (mask all pad input)
4. `JSL` to the menu subroutine
5. Restore `$06`
6. Continue script

## Shared state

| Address | Width | Role |
|---------|------:|------|
| `$06` | 2 bytes | Actor flags (interaction bits `#$8800` cleared during menu) |
| `$056E` | 2 bytes | Pad input inhibit mask (set to `#$000F` = all buttons masked) |

## Family notes

- `[65]` and `[66]` share the exact same handler wrapper (save `$06`, clear `#$8800`, pad mask `#$000F`, JSL, restore). The only difference is the JSL target: `[65]` → `code_04BF87` (status menu), `[66]` → `code_04C305` (robot config menu).
- `code_04BF87` is a large status/save/diary menu that references `$0672` (active character), `$0B7E`/`$0B7A` (inventory pointers), and level/EXP display.
- `code_04C305` is the robot program/equipment configuration screen. It uses `$0BA2` (bitmask selecting which robot: `#$0080`/`#$8000`/`#$0040`/`#$4000`) and indexes into `$422A`–`$426A` (16-byte per-robot data blocks).
- All 4 `[65]` call sites are in system-level code: the diary/boot menu actor and the player controller. All 3 `[66]` call sites are also in the player controller.
- `[67]` plays SFX `#$28` then calls `code_0AF2E4` which block-copies game state to SRAM (`$30xxxx`). All 3 sites are save-point actors.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `65` | `open_status_menu` | 4 | high | (none) | `code_00B6FD` |
| `66` | `open_robot_config_menu` | 3 | high | (none) | `code_00B717` |
| `67` | `save_game` | 3 | high | (none) | `code_00B731` |

**Family call-site total:** 10

## Opcodes

#### COP [65] — `open_status_menu` (status / diary / save screen)

- **Confidence:** high (handler traced; `code_04BF87` confirmed as menu routine)
- **Preferred name:** `open_status_menu`
- **Aliases:** `show_diary_menu`, `status_screen`
- **Handler:** `code_00B6FD` @ `extracted/system/chunk_008000.asm:7722-7734`
- **Parameters:** (none)
- **Usage count:** 4

##### What it does

```asm
code_00B6FD {
    TYX
    PEI ($06)              ; save flags
    LDA #$8800
    TRB $06                ; clear interaction bits
    LDA #$000F
    STA $056E              ; mask all pad input
    JSL $@code_04BF87      ; status/diary menu
    PLA
    STA $06                ; restore flags
    LDA $2C
    STA $02, S
    RTI                    ; continue
}
```

##### `code_04BF87` — status menu subroutine

Sets up palette/config (`$0EE8`/`$0EEA`), spawns a menu sub-actor via `code_008223`/`code_008277`, and runs the inventory/save/status menu loop. Uses `$0672` (active character index) for stat display.

##### All 4 call sites

| File | Context |
|------|---------|
| `boot/diary_menu/actor_04B29E.asm:78` | Game boot diary/save screen |
| `system/chunk_0B8000.asm:3905` | Player controller menu path 1 |
| `system/chunk_0B8000.asm:3912` | Player controller menu path 2 |
| `system/chunk_0B8000.asm:3919` | Player controller menu path 3 |

All chunk_0B8000 sites: `JSL code_0BF569` → `COP [AE]` → `COP [65]` → `JMP`.

- **WRAM:** `$06`, `$056E`, `$0672`, `$0B72`, `$0B7A`, `$0B7E`, `$0EE8`, `$0EEA`
- **JSL:** `code_04BF87`

#### COP [66] — `open_robot_config_menu` (robot program / equipment screen)

- **Confidence:** high (handler traced; same wrapper as `[65]` but calls `code_04C305` — robot config menu)
- **Preferred name:** `open_robot_config_menu`
- **Aliases:** `open_program_menu`, `robot_equip`
- **Handler:** `code_00B717` @ `extracted/system/chunk_008000.asm:7735-7748`
- **Parameters:** (none)
- **Usage count:** 3

##### What it does

```asm
code_00B717 {
    TYX
    PEI ($06)               ; save $06
    LDA #$8800
    TRB $06                 ; clear interaction bits
    LDA #$000F
    STA $056E               ; mask all pad input
    JSL $@code_04C305        ; → robot config menu
    PLA
    STA $06                 ; restore $06
    LDA $2C  STA $02,S  RTI ; continue
}
```

##### `code_04C305` — robot config menu

1. Save `$0B7E`, `$0B7A`; set direct page to `$0000`; data bank to `$7E`
2. Initialize color-wash table (`$0EE8`/`$0EEA`)
3. Compute slot: `$0BA2 × 4 + $0B7A → $0BA4` → `$0BA4 × 16 + #$422A → $0B7E`
4. Zero 16 bytes at slot address — clears robot program/equipment data
5. Enter interactive menu loop (`code_04C371`)
6. On exit: restore `$0B7A`, `$0B7E`

##### All 3 call sites

All in `system/chunk_0B8000.asm` (player controller), preceded by `COP [CC]` + `COP [AE]`:

| Location | COP [AE] target |
|---|---|
| `chunk_0B8000.asm:5095` | `@code_0BBF40` |
| `chunk_0B8000.asm:5325` | `@code_0BBFA6` |
| `chunk_0B8000.asm:5450` | `@code_0BC00C` |

- **WRAM:** `$06`, `$056E`, `$0BA2`, `$0BA4`, `$0B7A`, `$0B7E`, `$0EE8`, `$0EEA`
- **JSL:** `code_04C305`

#### COP [67] — `save_game` (write save data to SRAM)

- **Confidence:** high (handler traced; `code_0AF2E4` = full save with MVN to `$30xxxx`)
- **Preferred name:** `save_game`
- **Handler:** `code_00B731` @ `extracted/system/chunk_008000.asm:7750-7760`
- **Parameters:** (none)
- **Usage count:** 3

##### What it does

```asm
code_00B731 {
    TYX
    SEP #$20
    LDA #$28
    STA $0878              ; save SFX
    REP #$20
    JSL $@code_0AF2E4      ; save routine
    LDA $2C  STA $02,S  RTI
}
```

##### `code_0AF2E4` — save routine

Stores map id, player position, and facing into `$0600`–`$0606`. Block-copies (`MVN`) actor table and WRAM to SRAM at `$30xxxx`. Calls `code_0AF438` for SRAM commit.

##### All 3 call sites

| File | Context |
|------|---------|
| `system/actor_0C8000.asm:200` | Save-point NPC (option 1) |
| `system/actor_0C8000.asm:338` | Save-point NPC (option 2) |
| `unorganized/map_1B1/actor_0CDC5A.asm:69` | End-game save |

- **WRAM:** `$0878`, `$05A8`, `$0BAA`, `$0BA6`, `$0BA8`, `$0600`–`$0606`
- **SRAM:** `$30xxxx`
- **JSL:** `code_0AF2E4`
