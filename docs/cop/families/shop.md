# COP family: Shop

_Deep-audited ops: `[5F]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

Configure **shop inventory slots** (`$0B86`–`$0B92`) and signal the shop UI via event flag `#$000E`. The actual buy/sell transaction uses [currency](currency.md) ops `[5D]`/`[5E]`. Adjacent ops `[5E]` (GP test) and `[60]` (EXP) are unrelated.

## Shared state

- `$0B86`–`$0B8E` — 5 item/program slot IDs (byte each, stored as low byte of word)
- `$0B90` — mode byte (stored via `XBA` into high byte of word)
- `$0B92` — reserved (always `#00` in observed usage)
- Flag `#$000E` — set via `code_00DBBD` to signal shop inventory is loaded

### Menu display

Menu strings in `chunk_018000.asm` reference these addresses:
- `consolestring_01ED62`: `[NUM:2,0B86]  [NUM:2,0B88]  [NUM:2,0B8A]`
- `consolestring_01F4D0`: `CHANGE` screen with paired item names + quantities
- `consolestring_01EA8F`: `ITEM [NUM:4,0B86]` / `PROGRAM [NUM:4,0B88]`

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `5F` | `load_shop_inventory` | 7 | high | Byte×5, Byte, Byte | `code_00B57F` |

**Family call-site total:** 7

## Opcodes

#### COP [5F] — `load_shop_inventory` (configure shop item slots)

- **Confidence:** high (handler + menu strings + flag set confirmed)
- **Preferred name:** `load_shop_inventory`
- **Aliases:** `set_shop_items`, `configure_shop`
- **Handler:** `code_00B57F` @ `extracted/system/chunk_008000.asm:7504-7540`
- **Parameters:** `Byte`×5 (item IDs), `Byte` (mode), `Byte` (reserved)
- **Usage count:** 7

##### What it does

```asm
code_00B57F {
    TYX
    LDA [$2C]+  AND #$FF → $0B86    ; slot 1 id
    LDA [$2C]+  AND #$FF → $0B88    ; slot 2 id
    LDA [$2C]+  AND #$FF → $0B8A    ; slot 3 id
    LDA [$2C]+  AND #$FF → $0B8C    ; slot 4 id
    LDA [$2C]+  AND #$FF → $0B8E    ; slot 5 id
    LDA [$2C]+  AND #$FF  XBA
                          → $0B90    ; mode (high byte)
    LDA [$2C]+  AND #$FF → $0B92    ; reserved
    LDA #$800E
    JSR $&code_00DBBD              ; set flag #$0E
    ; continue
}
```

##### All 7 call sites

| Items | Mode | File | Context |
|-------|------|------|---------|
| `#74,#75,#76,#77,#78` | `#00` | `system/actor_05F238.asm:111` | Default shop |
| `#74,#75,#76,#77,#78` | `#FF` | `system/actor_05F238.asm:116` | Flag-gated variant |
| `#74,#75,#76,#77,#78` | `#01` | `system/actor_05F238.asm:122` | Post-flag variant |
| `#75,#76,#77,#6C,#6D` | `#00` | `system/actor_05F238.asm:127` | Different items |
| `#75,#76,#77,#70,#71` | `#01` | `system/actor_05F238.asm:132` | Late-game |
| `#74,#75,#76,#77,#69` | `#FF` | `unorganized/map_143/actor_0AB4CB.asm:89` | Special shop |
| `#68,#6B,#6C,#6E,#75` | `#01` | `unorganized/map_D5/actor_0C9AF9.asm:45` | Mouse merchant |

##### Typical usage

```asm
    ; system/actor_05F238.asm — map-gated shop config
    COP [1A] ( #$0170, &code_05F34C )    ; map check
    COP [0B] ( #$81BE, &code_05F328 )    ; flag check
    COP [5F] ( #74, #75, #76, #77, #78, #00, #00 )
    RTL
```

| Item | Value |
|------|-------|
| Suggested alias | `load_shop_inventory #i1,#i2,#i3,#i4,#i5,#mode,#rsv` |
| `$0B86`–`$0B8E` | 5 item slot IDs |
| `$0B90` | Mode byte (via `XBA`) |
| `$0B92` | Reserved |
| Flag `#$000E` | Set to signal shop ready |

- **WRAM:** `$0B86`–`$0B92`
- **JSR:** `code_00DBBD` (set flag `#$800E`)
