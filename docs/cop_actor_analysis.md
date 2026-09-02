# Robotrek COP Scripting & Actor Analysis

_Working document for continued COP analysis. **COP `$00`–`$A1` deep audits** live in [`docs/cop/`](cop/index.md) (overview + 39 family pages). This file keeps actor/header stats, the full opcode roster, and **`$A2+` stubs** for opcodes not yet deep-audited._

## Documentation layout

| Doc | Role |
|-----|------|
| [`docs/cop/index.md`](cop/index.md) | System overview, memory map, dispatch, `$00`–`$7F` stats |
| [`docs/cop/families/`](cop/families/) | Deep-audited opcode families (`$00`–`$A1`, 39 docs) |
| **This file** | Actor types, full roster, `$A2+` workspace (stubs) |

## Overview

Robotrek scene logic is driven by **actors**: small scripted objects with a 5-byte header and a body of 65816 code that invokes the **COP** instruction. Dispatch: `code_009EE8` → `code_list_009F10` in `extracted/system/chunk_008000.asm`. Operand layouts: `us/copdef.json`. Scene spawns: `extracted/system/script_meta_028000.asm`.

- Actor definitions found: **866**
- COP opcodes in copdef.json: **231**
- Jump-table slots: **251**
- Deep-audited range: **`$00`–`$A1`** → see [`docs/cop/`](cop/index.md) (39 family docs)
- Pending deep audit: **`$A2+`** (stubs below; confidence medium/low until verified)

## Memory map & dispatch

The script/actor memory map, `$7F` offset frequency table, global WRAM notes, and COP dispatcher walkthrough are maintained in [`docs/cop/index.md`](cop/index.md#memory-map-script--actor-relevant) (Memory map + COP dispatch sections).

When `$A2+` analysis discovers new addresses or corrects roles, update the index memory map (and the relevant family page if the address is shared with `$00`–`$A1`).

## Actor types

### On-disk actor record (`us/structs.json` → `actor`)

```
actor < Byte, Byte, Byte, Byte, Byte, Code >
```

Parsed headers: **866**. Field distributions:

#### Field 0

| Value | Count |
|-------|-------|
| `#00` | 760 |
| `#01` | 41 |
| `#02` | 20 |
| `#03` | 13 |
| `#10` | 5 |
| `#0E` | 4 |
| `#06` | 3 |
| `#08` | 3 |
| `#09` | 3 |
| `#0C` | 2 |
| `#0F` | 2 |
| `#04` | 2 |
| `#15` | 1 |
| `#05` | 1 |
| `#21` | 1 |

#### Field 1

| Value | Count |
|-------|-------|
| `#00` | 863 |
| `#30` | 2 |
| `#10` | 1 |

#### Field 2

| Value | Count |
|-------|-------|
| `#49` | 355 |
| `#69` | 165 |
| `#68` | 143 |
| `#48` | 98 |
| `#42` | 56 |
| `#60` | 19 |
| `#4A` | 11 |
| `#4C` | 9 |
| `#44` | 4 |
| `#6A` | 3 |
| `#40` | 1 |
| `#7A` | 1 |
| `#41` | 1 |

#### Field 3

| Value | Count |
|-------|-------|
| `#00` | 709 |
| `#80` | 85 |
| `#20` | 61 |
| `#24` | 10 |
| `#A0` | 1 |

#### Field 4

| Value | Count |
|-------|-------|
| `#00` | 745 |
| `#01` | 99 |
| `#20` | 13 |
| `#02` | 4 |
| `#10` | 3 |
| `#08` | 2 |

### Inferred field meanings

| Field | Likely meaning | Why |
|-------|----------------|-----|
| 0 | Spawn subtype / facing seed | Usually `#00`; non-zero on some interactables |
| 1 | Secondary subtype | Usually `#00` |
| 2 | Sprite / behavior class id | Wide distribution (`#44` scene player, `#68` controllers, `#49` NPCs, `#69` objects, …) |
| 3 | Flags | **Primary type bit:** `85` actors use `#80`, `709` use `#00`, `72` other |
| 4 | Extra param | Usually `#00` |
| body | 65816 + COP script | Entry at first instruction after header |

### Behavior class (header field 2)

| Class | Count | Inferred role | Typical COP mix |
|-------|-------|---------------|-----------------|
| `#49` | 355 | **NPC / townsfolk** | `[44]` solid, `[22]` action script, `[80]/`/`[97]` anim, `[1D]` dialog, `[0B]` flags |
| `#69` | 165 | **Object / trigger / interactable** | `[22]`/`[CB]`, dialog, often `f4≠0` subtype |
| `#68` | 143 | **Scene director / cutscene controller** | `[AA]`/`[AE]` spawn children, `[18]` `request_map`, `[D0]` delays |
| `#48` | 98 | **Animated puppet / prop sprite** | `[80]`–`[98]` animation loops |
| `#42` | 56 | **Enemy / battle actor** | `[E1]`/`[EB]`/`[EC]`/`[E8]` combat family + walk |
| `#60` | 19 | **UI / menu / prologue manager** | `[AC]`/`[AA]` spawn, `[C8]`/`[32]` UI setup |
| `#4A` | 11 | **Door / warp / portal** | Heavy `[73]` + flag gates |
| `#4C` | 9 | **Named character sprite** | `[C9]` + anim |
| `#44` | 4 | **Player / party host** | `[36]` unk21 install, `[AA]` helpers, `$0EEE` |
| `#40` | 1 | **Boot / logo** | Special boot sequence |

### Flag field (header field 3)

| Value | Count | Notes |
|-------|-------|-------|
| `#00` | 709 | Default |
| `#80` | 85 | Common “special/interact” bit (often talkable NPCs & objects) |
| `#20` / `#24` | 61 / 10 | Mostly `#42` enemy actors (`#24`) |
| `#A0` | 1 | Rare combo of `$80|$20` |

### Behavioral / role types (composition)

| Role | Distinguishing traits | Example |
|------|----------------------|---------|
| Scene player / camera host | Class `#44`, `COP [AA]` helpers, `COP [36]` unk21, toggles `$06`, `STX $0EEE` | `actor_0BD8A1` |
| Walking NPC | Class `#49`, solid + action script + anim + dialog | `actor_07A382` |
| Trigger / examine object | Class `#69`, thin scripts, flag gates | `actor_0783A6` |
| Cutscene director | Class `#68`, spawns children, `request_map` `[18]` | `actor_04EE8B` |
| Enemy | Class `#42`, combat COP `$E*` range | `chunk_02E9AA` actors |
| Door/warp | Class `#4A`, `COP [73]` | mansion foyer actors |
| System helper | Shared via many script_meta scenes | `actor_04B763`, `actor_04B3D8` |

### Scene spawn entry types (`script_meta` / `structs.json`)

Each scene list (`unk1_XXXXXX`) is a sequence of discriminated records (suggested renames in parentheses):

| Kind | Disc. | Payload | Role |
|------|-------|---------|------|
| `unk1` (`spawn_full`) | `0x00` | `u8×5, @actor, @unk11` | Full spawn: params + actor + spritemap/hitbox (`unk11`) |
| `unk2` (`spawn_simple`) | `0xFE` | `u8, @actor` | Lightweight spawn (param + actor only) |
| `unk3` (`spawn_xy`) | `0xFD` | `u8, u8, u8, @actor` | Positioned spawn (X, Y, slot/id + actor) |
| `unkFC` (`spawn_full_alt`) | `0xFC` | same width as unk1 | Rare full-spawn variant |
| delimiter | `0xFF` | — | End of scene actor list |

Counts across script_meta blocks:

| Kind | Count |
|------|-------|
| `unk1` | 1252 |
| `unk3` | 855 |
| `unk2` | 481 |
| `unkFC` | 2 |

Examples:

- **unk1**:
  - `unk1 < #00, #07, #08, #00, #00, @actor_0BD8A1, @spritemap_0E8000 >   ;00`
  - `unk1 < #00, #07, #08, #00, #00, @actor_0BD8A1, @spritemap_0E8000 >   ;00`
  - `unk1 < #00, #03, #1B, #00, #00, @actor_0BD8A1, @spritemap_0E8000 >   ;00`
- **unk2**:
  - `unk2 < #00, @actor_0BEFFE >   ;01`
  - `unk2 < #00, @actor_04B763 >   ;05`
  - `unk2 < #00, @actor_0BEFFE >   ;01`
- **unk3**:
  - `unk3 < #04, #0E, #00, @actor_04B3FE >   ;02`
  - `unk3 < #1E, #1D, #00, @actor_04B3FE >   ;03`
  - `unk3 < #00, #01, #00, @actor_04B422 >   ;04`
- **unkFC**:
  - `unkFC < #01, #32, #09, #06, #82, @actor_06AA7D, @unk11_02E914 >   ;05`
  - `unkFC < #01, #1B, #05, #0E, #82, @actor_06AB39, @unk11_02E914 >   ;06`

Related: `unk11` bundles spritemap (`part0`), sprite group bits (`part1`/`part2`), and collision/box (`part3`/`part4`).

## COP `$00`–`$A1` (moved to family docs)

High-detail handler walkthroughs, call-site audits, encoding cheat sheets, and family notes for `$00`–`$A1` live in per-family documents. Start at the [COP overview](cop/index.md).

| Family | Ops | Doc |
|--------|-----|-----|
| **Control flow** | `00`–`07` `09` `27` | [control_flow.md](cop/families/control_flow.md) |
| **Event flags** | `08` `0A`–`0D` `1B` | [event_flags.md](cop/families/event_flags.md) |
| **Proximity** | `0E`–`16` | [proximity.md](cop/families/proximity.md) |
| **Map / placement** | `17`–`1A` | [map_placement.md](cop/families/map_placement.md) |
| **Dialog / choice** | `1C`–`21` | [dialog.md](cop/families/dialog.md) |
| **Interact hooks** | `22` `23` | [interact.md](cop/families/interact.md) |
| **BG tile attributes** | `24` | [bg_tile_attrs.md](cop/families/bg_tile_attrs.md) |
| **Switch tables** | `25` `26` | [switch.md](cop/families/switch.md) |
| **Wander / step profile** | `28`–`2A` | [wander.md](cop/families/wander.md) |
| **Party follow** | `2B`–`2E` | [party_follow.md](cop/families/party_follow.md) |
| **Chase / herd** | `2F` `30` | [chase.md](cop/families/chase.md) |
| **RNG** | `31` | [rng.md](cop/families/rng.md) |
| **UI focus** | `32` | [ui_focus.md](cop/families/ui_focus.md) |
| **Input / pad** | `33`–`3B` | [input.md](cop/families/input.md) |
| **Audio (music + SFX)** | `3C`–`43` | [audio.md](cop/families/audio.md) |
| **Collision / solid** | `44`–`49` | [collision.md](cop/families/collision.md) |
| **Metatile id + scan** | `4A`–`50` | [metatiles.md](cop/families/metatiles.md) |
| **Movement / walk** | `51`–`55` | [movement.md](cop/families/movement.md) |
| **Tracked IDs** | `56`–`58` `5A` `5B` | [tracked_ids.md](cop/families/tracked_ids.md) |
| **Focus / Interact Binding** | `59` | [focus_interact.md](cop/families/focus_interact.md) |
| **Currency (GP)** | `5C`–`5E` | [currency.md](cop/families/currency.md) |
| **Shop** | `5F` | [shop.md](cop/families/shop.md) |
| **Progression (EXP / Level)** | `60` `61` | [progression.md](cop/families/progression.md) |
| **Party Check** | `62` | [party_check.md](cop/families/party_check.md) |
| **Interact Wait** | `63` `64` | [interact_wait.md](cop/families/interact_wait.md) |
| **Menu / Save** | `65`–`67` | [menu.md](cop/families/menu.md) |
| **Camera** | `68`–`6D` | [camera.md](cop/families/camera.md) |
| **NPC Lifecycle** | `6E`–`70` | [npc_lifecycle.md](cop/families/npc_lifecycle.md) |
| **Combat / Encounter** | `71`–`73` | [combat.md](cop/families/combat.md) |
| **Spawn Gate** | `74`–`76` | [spawn_gate.md](cop/families/spawn_gate.md) |
| **BCD Counter** | `77`–`78` | [bcd_counter.md](cop/families/bcd_counter.md) |
| **Spawn Effect** | `79` | [spawn_effect.md](cop/families/spawn_effect.md) |
| **Proximity 3-Way** | `7A`–`7B` | [proximity_3way.md](cop/families/proximity_3way.md) |
| **Companion Sprite** | `7C`–`7D` | [companion_sprite.md](cop/families/companion_sprite.md) |
| **Focus / Interact** (updated) | `59`, `7E` | [focus_interact.md](cop/families/focus_interact.md) |
| **Unused Ops** | `7F` | [unused_ops.md](cop/families/unused_ops.md) |
| **Animation Setup** | `80`–`8C` | [anim_setup.md](cop/families/anim_setup.md) |
| **Child Sprite Spawn** | `8D`–`90` | [child_sprite.md](cop/families/child_sprite.md) |
| **Render Configuration** | `91`–`96` `9D`–`A1` | [render_config.md](cop/families/render_config.md) |
| **Animation Wait / Tick** | `97`–`9C` | [anim_wait.md](cop/families/anim_wait.md) |

False neighbors and usage rankings: see [Instruction families](cop/index.md#instruction-families-00a1) in the overview.

## Script functions (COP opcodes)

Quick roster of **all** COP slots. For `$00`–`$A1` deep semantics, use the [family docs](cop/families/) — this table is for lookup and for tracking `$A2+` confidence/usage.

Operand legend: `u8`/`u16` immediate; `ptr16` bank-local; `ptr24` long; `code-list` pointer to address table.

Confidence: **high** = handler fully reasoned; **medium** = strong signals; **low** = layout-only heuristic.

| Op | Suggested name | Conf. | Parameters | Handler | Uses |
|----|----------------|-------|------------|---------|------|
| `00` | `gosub` | high | ptr16 code | `code_00A106` | 143 |
| `01` | `return` | high | (none) | `code_00A116` | 114 |
| `02` | `return_main` | high | (none) | `code_00A12A` | 14 |
| `03` | `gosub_far` | high | ptr24 code | `code_00A131` | 68 |
| `04` | `return_far` | high | (none) | `code_00A154` | 35 |
| `05` | `repeat_begin` | high | u16 | `code_00A174` | 233 |
| `06` | `repeat_yield` | high | (none) | `code_00A188` | 219 |
| `07` | `repeat_continue` | high | (none) | `code_00A1A2` | 19 |
| `08` | `wait_flag` | high | u16 | `code_00A1BC` | 65 |
| `09` | `goto_far` | high | ptr24 code | `code_00A1D9` | 25 |
| `0A` | `set_flag` | high | u16 | `code_00A1F4` | 1077 |
| `0B` | `branch_if_flag` | high | u16, ptr16 code | `code_00A203` | 863 |
| `0C` | `branch_if_flags` | high | u16…, ptr16 code | `code_00A220` | 214 |
| `0D` | `give_reward` | high | u16 | `code_00A2AB` | 40 |
| `0E` | `branch_if_in_rect` | high | Byte, Word, Word, &Code | `code_00A301` | 47 |
| `0F` | `branch_if_near` | high | Byte×5, &Code | `code_00A357` | 61 |
| `10` | `branch_if_at_xy_facing` | high | Byte, Byte, Byte, &Code | `code_00A3D3` | 145 |
| `11` | `branch_if_rel_xy_facing` | high | Byte, Byte, Byte, &Code | `code_00A401` | 32 |
| `12` | `branch_if_x_facing` | high | Byte, Byte, &Code | `code_00A422` | 5 |
| `13` | `branch_if_y_facing` | high | Byte, Byte, &Code | `code_00A458` | 18 |
| `14` | `branch_if_rel_x_facing` | high | (not in copdef; unused) | `code_00A446` | 0 |
| `15` | `branch_if_rel_y_facing` | high | (not in copdef; unused) | `code_00A47C` | 0 |
| `16` | `branch_if_actor_at_xy` | high | Byte×4, &Code (not in copdef; unused) | `code_00A48E` | 0 |
| `17` | `teleport_xy_facing` | high | Byte, Byte, Byte | `code_00A4CE` | 127 |
| `18` | `request_map` | high | Word, Byte×4 | `code_00A4F6` | 127 |
| `19` | `queue_map_alt` | high | Word, Byte×4 | `code_00A52B` | 1 |
| `1A` | `branch_if_map` | high | Word, &Code | `code_00A55A` | 107 |
| `1B` | `apply_flag_reset` | high | Word | `code_00A580` | 4 |
| `1C` | `choice_menu` | high | Word, &&Code | `code_00A597` | 60 |
| `1D` | `show_dialog` | high | &String | `code_00A5D3` | 1754 |
| `1E` | `choice_menu_no_bank` | high | Word, &&Code | `code_00A616` | 1 |
| `1F` | `show_dialog_now` | high | &String | `code_00A63F` | 213 |
| `20` | `show_dialog_bank8` | high | &String | `code_00A660` | 16 |
| `21` | `show_dialog_far` | high | Byte bank, &String | `code_00A6A3` | 5 |
| `22` | `set_interact` | high | &Code | `code_00A6D3` | 560 |
| `23` | `set_interact_alt` | high | &Code | `code_00A6E3` | 3 |
| `24` | `paint_tile_attrs` | high | Byte, Word, Byte | `code_00A6F3` | 60 |
| `25` | `switch_param` | high | Byte, Byte, &Code… | `code_00A733` | 14 |
| `26` | `switch_counter` | high | Byte, Byte, &Code… | `code_00A762` | 5 |
| `27` | `queue_player_script` | high | Byte, &Code | `code_00A793` | 167 |
| `28` | `wander_rect` | high | Byte×4 | `code_00A7D0` | 77 |
| `29` | `wander_rect_anim` | high | Byte×6 | `code_00A7B5` | 8 |
| `2A` | `set_move_profile` | high | Byte | `code_00A876` | 14 |
| `2B` | `snap_to_player_if_flag` | high | Word, &Code | `code_00A887` | 9 |
| `2C` | `claim_follower_slot` | high | (none) | `code_00A8BD` | 24 |
| `2D` | `follower_step` | high | Byte, Word | `code_00A95E` | 12 |
| `2E` | `follower_step_anim` | high | Byte×3, Word (+ packed epilogue) | `code_00AA9E` | 12 |
| `2F` | `chase_step` | high | (none) | `code_00AAD6` | 2 |
| `30` | `chase_step_anim` | high | Byte, Byte | `code_00AABA` | 1 |
| `31` | `rng_tick` | high | (none) | `code_00ACB0` | 89 |
| `32` | `set_focus_id` | high | Byte | `code_00ACBA` | 146 |
| `33` | `unmask_input` | high | Word | `code_00ACCF` | 278 |
| `34` | `mask_input` | high | Word | `code_00ACDE` | 337 |
| `35` | `bind_pad_handler` | high | Byte, &Code | `code_00ACF0` | 44 |
| `36` | `install_pad_profile` | high | &unk21 | `code_00AD07` | 108 |
| `37` | `dispatch_pad` | high | &Code | `code_00AD17` | 6 |
| `38` | `wait_pad` | high | Word | `code_00AE01` | 3 |
| `39` | `wait_pad_ack` | high | Word | `code_00AE1D` | 5 |
| `3A` | `branch_if_pad` | high | Word, &Code | `code_00AE3C` | 12 |
| `3B` | `branch_if_pad_clear` | high | Word, &Code | `code_00AE50` | 45 |
| `3C` | `play_music` | high | Byte | `code_00AE64` | 37 |
| `3D` | `play_music_fade` | high | Byte | `code_00AE91` | 7 |
| `3E` | `restore_music` | high | Byte | `code_00AEBE` | 31 |
| `3F` | `apu_write_0` | high | Byte (not in copdef) | `code_00AEF7` | 0 |
| `40` | `apu_write_1` | high | Byte (not in copdef) | `code_00AF0B` | 0 |
| `41` | `queue_sfx_3` | high | u8 | `code_00AF1F` | 277 |
| `42` | `queue_sfx_2` | high | u8 | `code_00AF33` | 98 |
| `43` | `queue_sfx_word` | high | Word (not in copdef; unused) | `code_00AF47` | 0 |
| `44` | `solid_on` | high | (none) | `code_00AF56` | 453 |
| `45` | `solid_off` | high | (none) | `code_00AF67` | 213 |
| `46` | `solid_on_at` | high | Byte, Byte (signed cells) | `code_00AF78` | 145 |
| `47` | `solid_off_at` | high | Byte, Byte (signed cells) | `code_00AF91` | 82 |
| `48` | `sample_tile_at` | high | Byte, Byte (signed cells) | `code_00AFAA` | 3 |
| `49` | `probe_blocked` | high | (none) | `code_00AFC3` | 9 |
| `4A` | `branch_if_tile` | high | Byte, &Code | `code_00AFD4` | 11 |
| `4B` | `branch_if_tile_at` | high | Byte, Byte, Byte, &Code | `code_00B008` | 19 |
| `4C` | `set_tile` | high | Byte, Byte, Byte | `code_00B044` | 24 |
| `4D` | `set_tile_at` | high | Byte, Word (packs dy+tile) | `code_00B05F` | 84 |
| `4E` | `draw_tile_at` | high | Byte, Byte, Byte | `code_00B0A7` | 6 |
| `4F` | `refresh_tile_at` | high | Byte, Byte (not in copdef; unused) | `code_00B0B1` | 0 |
| `50` | `redraw_tile_rows` | high | Byte×6 | `code_00B109` | 128 |
| `51` | `step_begin` | high | (none) | `code_00B19D` | 662 |
| `52` | `step_end` | high | (none) | `code_00B20E` | 662 |
| `53` | `walk_to_x` | high | Byte, Byte, Byte | `code_00B27B` | 202 |
| `54` | `walk_to_y` | high | Byte, Byte, Byte | `code_00B2EC` | 281 |
| `55` | `walk_seeks` | high | Byte×4 | `code_00B341` | 44 |
| `56` | `claim_id` | high | Byte, &Code | `code_00B45D` | 31 |
| `57` | `release_id` | high | Byte | `code_00B476` | 25 |
| `58` | `branch_if_slots_below` | high | Byte, &Code | `code_00B49B` | 6 |
| `59` | `set_focus_bind` | high | Word, Word / Word, &Code | `code_00B4B9` | 12 |
| `5A` | `branch_if_id_claimed` | high | Byte, &Code | `code_00B4F0` | 8 |
| `5B` | `branch_if_focus_id` | high | Byte, &Code | `code_00B51E` | 73 |
| `5C` | `add_gp` | high | Word (BCD) | `code_00B533` | 7 |
| `5D` | `spend_gp` | high | Word (BCD), &Code | `code_00B543` | 7 |
| `5E` | `branch_if_can_afford` | high | Word (BCD), &Code | `code_00B566` | 4 |
| `5F` | `load_shop_inventory` | high | Byte×5, Byte, Byte | `code_00B57F` | 7 |
| `60` | `award_exp` | high | Word (unused) | `code_00B5D2` | 0 |
| `61` | `branch_if_level_ge` | high | Byte, &Code | `code_00B61C` | 35 |
| `62` | `branch_if_companions` | high | Word, &Code | `code_00B633` | 233 |
| `63` | `wait_facing` | high | &Code | `code_00B670` | 311 |
| `64` | `wait_facing_anim` | high | Byte, &Code | `code_00B664` | 23 |
| `65` | `open_status_menu` | high | (none) | `code_00B6FD` | 4 |
| `66` | `open_robot_config_menu` | high | (none) | `code_00B717` | 3 |
| `67` | `save_game` | high | (none) | `code_00B731` | 3 |
| `68` | `camera_scroll` | high | Byte, Byte, Byte, Byte | `code_00B744` | 44 |
| `69` | `camera_return` | high | Byte | `code_00B7C2` | 10 |
| `6A` | `screen_shake` | high | Byte×10 | `code_00B807` | 15 |
| `6B` | `camera_scroll_await` | high | Word, Byte×6 | `code_00B906` | 2 |
| `6C` | `spawn_screen_effect` | high | Byte | `code_00B9D2` | 6 |
| `6D` | `camera_y_shake` | high | (none) | `code_00BA04` | 45 |
| `6E` | `npc_spawn_gate` | high | (none) | `code_00BA36` | 15 |
| `6F` | `npc_idle_guard` | high | (none) | `code_00BA4B` | 14 |
| `70` | `npc_busy_wait` | high | Byte (not in copdef) | `code_00BA82` | 0 |
| `71` | `combat_solid_gate` | high | (none) | `code_00BAA3` | 13 |
| `72` | `combat_result_poll` | high | Byte | `code_00BAC2` | 31 |
| `73` | `encounter_gate` | high | Word, Word, @Code, @Code | `code_00BB02` | 44 |
| `74` | `gate_flag_expr` | high | Word, Word(+) | `code_00BBA9` | 108 |
| `75` | `gate_flag` | high | Word | `code_00BC3A` | 271 |
| `76` | `gate_map` | high | Word | `code_00BC55` | 6 |
| `77` | `branch_if_counter` | high | Byte, Word, &Code | `code_00BC82` | 11 |
| `78` | `set_counter` | high | Byte, Word | `code_00BCB2` | 8 |
| `79` | `spawn_effect` | high | Byte ×5 | `code_00BD0B` | 7 |
| `7A` | `branch_x_3way` | high | Word, &Code, &Code, &Code | `code_00BD5F` | 7 |
| `7B` | `branch_y_3way` | high | Word, &Code, &Code, &Code | `code_00BD8A` | 2 |
| `7C` | `companion_sprite_reset` | high | (none) | `code_00BDB5` | 21 |
| `7D` | `companion_sprite_set` | high | Byte | `code_00BDEE` | 2 |
| `7E` | `resume_deferred_interact` | high | (none) | `code_00B4DA` | 5 |
| `7F` | `unused_crash` | high | — | `#$FFFF` | 0 |
| `80` | `set_anim` | high | u8 | `code_00BE3E` | 1247 |
| `81` | `set_anim_vx` | high | u8, u8 | `code_00BE53` | 78 |
| `82` | `set_anim_vy` | high | u8, u8 | `code_00BE74` | 57 |
| `83` | `set_anim_vxy` | high | u8, u8, u8 | `code_00BE95` | 8 |
| `84` | `set_anim_spd` | high | u8, u8 | `code_00BEC2` | 354 |
| `85` | `set_anim_spd_vx` | high | u8, u8, u8 | `code_00BEE0` | 149 |
| `86` | `set_anim_spd_vy` | high | u8, u8, u8 | `code_00BF0A` | 220 |
| `87` | `set_anim_spd_vxy` | high | u8, u8, u8, u8 | `code_00BF34` | 2 |
| `88` | `set_anim_step` | high | u8 | `code_00BF6A` | 2 |
| `89` | `set_anim_facing` | high | u8 | `code_00BF8E` | 60 |
| `8A` | `set_anim_spd_facing` | high | u8, u8 | `code_00BF85` | 2 |
| `8B` | `set_anim_sprmap` | high | u8, u8 | `code_00BFAD` | 33 |
| `8C` | `set_anim_accel` | high | u8, u8, u8 | `code_00BFD2` | 8 |
| `8D` | `spawn_child_guarded` | high | u8, u8 | `code_00BFFB` | 5 |
| `8E` | `spawn_child_guarded_w` | high | u8, u8, u8 | `code_00C062` | 10 |
| `8F` | `spawn_child` | high | u8, u8 | `code_00C09C` | 40 |
| `90` | `spawn_child_w` | high | u8, u8, u8 | `code_00C0FD` | 5 |
| `91` | `set_sprmap_render` | high | u8, Address | `code_00C138` | 55 |
| `92` | `set_sprmap_render_spd` | high | u8, u8, u16, u8 | `code_00C12F` | 7 |
| `93` | `spawn_render_actor` | high | u8, u8, Address | `code_00C179` | 20 |
| `94` | `spawn_render_actor_spd` | high | u8, u8, u8, Address | `code_00C170` | 12 |
| `95` | `set_bitmap_overlay` | high | u8, u8 | `code_00C1DA` | 5 |
| `96` | `set_bitmap_overlay_spd` | high | u8, u8, u8 | `code_00C1D1` | 0 |
| `97` | `wait_anim_done` | high | (none) | `code_00C21F` | 2076 |
| `98` | `wait_anim_frames` | high | (none) | `code_00C232` | 931 |
| `99` | `wait_anim_clear_sprmap` | high | (none) | `code_00C249` | 33 |
| `9A` | `anim_until_interact_destroy` | high | (none) | `code_00C261` | 46 |
| `9B` | `anim_step_tick` | high | (none) | `code_00C27A` | 2 |
| `9C` | `child_wait` | high | (none) | `code_00C2A3` | 53 |
| `9D` | `copy_oam_block` | high | u8 | `code_00C2B1` | 6 |
| `9E` | `sprmap_render_wait` | high | (none) | `code_00C2E4` | 75 |
| `9F` | `sprmap_render_wait_multi` | high | (none) | `code_00C305` | 19 |
| `A0` | `bitmap_render_wait` | high | (none) | `code_00C32A` | 5 |
| `A1` | `bitmap_render_wait_multi` | high | (not in copdef) | `code_00C339` | 0 |
| `A2` | `spawn_or_run_actor` | medium | ptr24 code, u16 | `code_00C34C` | 22 |
| `A3` | `spawn_or_run_actor` | medium | ptr24 code | `code_00C396` | 2 |
| `A4` | `no_operand` | low | (not in copdef) | `code_00C3BC` | 0 |
| `A5` | `spawn_or_run_actor` | medium | ptr24 code, u16, u16 | `code_00C3EB` | 3 |
| `A6` | `no_operand` | low | (not in copdef) | `code_00C436` | 0 |
| `A7` | `no_operand` | low | (not in copdef) | `code_00C48A` | 0 |
| `A8` | `no_operand` | low | (not in copdef) | `code_00C4C2` | 0 |
| `A9` | `spawn_or_run_actor` | medium | ptr24 code, u16 | `code_00C503` | 14 |
| `AA` | `spawn_child_actor` | high | ptr24 code | `code_00C54A` | 206 |
| `AB` | `spawn_child_word` | medium | ptr24 code, u16 | `code_00C570` | 43 |
| `AC` | `spawn_child_word2` | medium | ptr24 code, u16 | `code_00C59F` | 138 |
| `AD` | `spawn_child_xy` | high | ptr24 code, u16, u16 | `code_00C5CE` | 247 |
| `AE` | `spawn_child_xy_param` | medium | ptr24 code, u16, u16, u16 | `code_00C619` | 110 |
| `AF` | `spawn_child_words` | medium | ptr24 code, u16, u16 | `code_00C66D` | 24 |
| `B0` | `spawn_child_3words` | medium | ptr24 code, u16, u16, u16 | `code_00C6A5` | 4 |
| `B1` | `spawn_child_3words_alt` | medium | ptr24 code, u16, u16, u16 | `code_00C6E6` | 33 |
| `B2` | `update_sprite` | high | (none) | `code_00C73A` | 533 |
| `B3` | `no_operand` | low | (none) | `code_00C744` | 6 |
| `B4` | `byte_op` | low | u8 | `code_00C74E` | 10 |
| `B5` | `no_operand` | low | (not in copdef) | `code_00C762` | 0 |
| `B6` | `no_operand` | low | (not in copdef) | `code_00C776` | 0 |
| `B7` | `word_op` | low | u16 | `code_00C798` | 24 |
| `B8` | `word_op` | low | u16 | `code_00C7B3` | 27 |
| `B9` | `cop_b9` | low | u16, u16 | `code_00C7C4` | 21 |
| `BA` | `no_operand` | low | (none) | `code_00C7EA` | 2 |
| `BB` | `no_operand` | low | (none) | `code_00C803` | 2 |
| `BC` | `no_operand` | low | (none) | `code_00C81C` | 2 |
| `BD` | `no_operand` | low | (none) | `code_00C835` | 4 |
| `BE` | `cop_be` | low | u8, ptr16 code | `code_00C84E` | 2 |
| `BF` | `cop_bf` | low | u8, ptr16 code | `code_00C8CD` | 2 |
| `C0` | `byte_op` | low | u8 | `code_00C94C` | 1 |
| `C1` | `cop_c1` | low | u8, ptr16 code | `code_00C9C1` | 3 |
| `C2` | `cop_c2` | low | u8, ptr16 code | `code_00C9E2` | 3 |
| `C3` | `cop_c3` | low | u8, ptr16 code | `code_00C9FB` | 3 |
| `C4` | `cop_c4` | low | u8, ptr16 code | `code_00CA1C` | 3 |
| `C5` | `byte_op` | low | u8 | `code_00CA39` | 54 |
| `C6` | `byte_op` | low | u8 | `code_00CA52` | 33 |
| `C7` | `byte_op` | low | u8 | `code_00CA6B` | 24 |
| `C8` | `cop_c8` | low | ptr24 binary, u8 | `code_00CA84` | 73 |
| `C9` | `cop_c9` | low | address24 | `code_00CABB` | 24 |
| `CA` | `byte_op` | low | u8 | `code_00CADB` | 51 |
| `CB` | `continue_next_tick` | high | (none) | `code_00CB38` | 744 |
| `CC` | `yield_next_tick` | high | (none) | `code_00CB44` | 393 |
| `CD` | `spawn_or_run_actor` | medium | ptr24 code, u16 | `code_00CB50` | 6 |
| `CE` | `spawn_or_run_actor` | medium | ptr24 code | `code_00CB6D` | 7 |
| `CF` | `goto_far` | high | ptr24 code | `code_00CB84` | 151 |
| `D0` | `delay_frames` | high | u16 | `code_00CB9D` | 762 |
| `D1` | `cop_d1` | low | u8, u8, u8 | `code_00CBB1` | 34 |
| `D2` | `cop_d2` | low | u8, u8, u8, u8 | `code_00CBEC` | 12 |
| `D3` | `cop_d3` | low | u8, u8, u8, u8 | `code_00CC31` | 21 |
| `D4` | `yield_halt` | low | (none) | `code_00CC76` | 2 |
| `D5` | `cop_d5` | low | u8, address24 | `code_00CC8A` | 26 |
| `D6` | `cop_d6` | low | u8, u8, address24 | `code_00CCB9` | 2 |
| `D7` | `no_operand` | low | (none) | `code_00CCF1` | 1 |
| `D8` | `no_operand` | low | (none) | `code_00CD6F` | 58 |
| `D9` | `byte_op` | low | u8 | `code_00CED6` | 3 |
| `DA` | `cop_da` | low | u8, u16 | `code_00CEF0` | 33 |
| `DB` | `cop_db` | low | u8, u16 | `code_00CFF6` | 42 |
| `DC` | `yield_halt` | low | (none) | `code_00D091` | 42 |
| `DD` | `no_operand` | low | (none) | `code_00D17F` | 24 |
| `DE` | `no_operand` | low | (not in copdef) | `code_00D196` | 0 |
| `DF` | `no_operand` | low | (none) | `code_00D1AD` | 21 |
| `E0` | `no_operand` | low | (none) | `code_00D1C2` | 20 |
| `E1` | `no_operand` | low | (none) | `code_00D1D7` | 103 |
| `E2` | `no_operand` | low | (not in copdef) | `code_00D241` | 0 |
| `E3` | `cop_e3` | low | ptr16 code, ptr16 code, ptr16 code | `code_00D2B9` | 57 |
| `E4` | `jump_or_call` | low | ptr16 code | `code_00D344` | 17 |
| `E5` | `jump_or_call` | low | ptr16 code | `code_00D360` | 17 |
| `E6` | `cop_e6` | low | u8, ptr16 code | `code_00D3A4` | 20 |
| `E7` | `cop_e7` | low | u8, ptr16 code | `code_00D3C8` | 19 |
| `E8` | `cop_e8` | low | u16, ptr16 code | `code_00D3E4` | 90 |
| `E9` | `no_operand` | low | (not in copdef) | `code_00D474` | 0 |
| `EA` | `cop_ea` | low | u8, ptr16 code | `code_00D4BA` | 17 |
| `EB` | `cop_eb` | low | u8, ptr16 code | `code_00D538` | 91 |
| `EC` | `yield_halt` | low | (none) | `code_00D5B3` | 91 |
| `ED` | `jump_or_call` | low | ptr16 code | `code_00D5DC` | 67 |
| `EE` | `cop_ee` | low | ptr16 code | `code_00D651` | 67 |
| `EF` | `yield_halt` | low | (none) | `code_00D68D` | 67 |
| `F0` | `no_operand` | low | (none) | `code_00D77E` | 67 |
| `F1` | `cop_f1` | low | u8, ptr16 code, ptr16 code, ptr16 code | `code_00D7D7` | 15 |
| `F2` | `cop_f2` | low | u8, u8, u8 | `code_00D807` | 8 |
| `F3` | `cop_f3` | low | u8, u8, u8, u8 | `code_00D861` | 27 |
| `F4` | `cop_f4` | low | u16, u16, u8 | `code_00D8B7` | 81 |
| `F5` | `cop_f5` | low | u8, u16, u16, ptr16 code | `code_00D8EF` | 4 |
| `F6` | `byte_op` | low | u8 | `code_00D9D0` | 4 |
| `F7` | `no_operand` | low | (none) | `code_00DACE` | 6 |
| `F8` | `cop_f8` | low | u16, u16 | `code_00DB08` | 4 |
| `F9` | `cop_f9` | low | u16, u16 | `code_00DB22` | 8 |
| `FA` | `byte_op` | low | u8 | `code_00DB86` | 25 |

## Opcode reference (`$A2+`)

COP `$00`–`$A1` deep-audit write-ups live in the [family docs](cop/families/). See the roster table above for names and the family index for links. The sections below are **stubs for `$A2+`** awaiting deep analysis.

### COP [A2] — `spawn_or_run_actor`

- **Confidence:** medium
- **Handler:** `code_00C34C` @ chunk_008000.asm:9602-9639
- **Parameters:** ptr24 code, u16
- **Notes:** Far code pointer — typically actor spawn / subroutine install. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 22 times in extracted ASM
- **WRAM touched:** `$0006`, `$0024`, `$0028`, `$002A`, `$01`, `$02`, `$03`, `$0EF4`, `$26`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E587`
- **JSL:** `code_0481EE`
- **Usage count:** 22
- **Source examples:**
  - `native_village/native_inn/actor_07BD34.asm:26` — `COP [A2] ( @code_04BB57, #$2800 )`
  - `native_village/native_inn/actor_07BD34.asm:27` — `COP [A2] ( @code_07BD71, #$2800 )`
  - `native_village/native_inn/actor_07BD34.asm:46` — `COP [A2] ( @code_07BDB4, #$2800 )`
  - `native_village/native_inn/actor_07BD34.asm:47` — `COP [A2] ( @code_04BB57, #$2800 )`
  - `prinkys_mansion/mansion_breaker_room/actor_06F004.asm:33` — `COP [A2] ( @code_06F4A1, #$0800 )`

### COP [A3] — `spawn_or_run_actor`

- **Confidence:** medium
- **Handler:** `code_00C396` @ chunk_008000.asm:9641-9661
- **Parameters:** ptr24 code
- **Notes:** Far code pointer — typically actor spawn / subroutine install. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 2 times in extracted ASM
- **WRAM touched:** `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E535`
- **Usage count:** 2
- **Source examples:**
  - `system/actor_0BD8F4.asm:30` — `COP [A3] ( @code_0BDCE0 )`
  - `system/chunk_038000.asm:3789` — `COP [A3] ( @code_03BFCA )`

### COP [A4] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00C3BC` @ chunk_008000.asm:9663-9687
- **Parameters:** _not listed in copdef.json_
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc
- **WRAM touched:** `$0006`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E535`
- **Usage count:** 0

### COP [A5] — `spawn_or_run_actor`

- **Confidence:** medium
- **Handler:** `code_00C3EB` @ chunk_008000.asm:9689-9729
- **Parameters:** ptr24 code, u16, u16
- **Notes:** Far code pointer — typically actor spawn / subroutine install. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 3 times in extracted ASM
- **WRAM touched:** `$0000`, `$0002`, `$000A`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E535`
- **Usage count:** 3
- **Source examples:**
  - `system/chunk_038000.asm:13974` — `COP [A5] ( @code_03F049, #$0010, #$0000 )`
  - `system/chunk_0B8000.asm:11525` — `COP [A5] ( @code_0BEA93, #$00A0, #$FF00 )`
  - `system/chunk_0B8000.asm:11541` — `COP [A5] ( @code_0BEB64, #$0000, #$FF00 )`

### COP [A6] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00C436` @ chunk_008000.asm:9731-9775
- **Parameters:** _not listed in copdef.json_
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc
- **WRAM touched:** `$0000`, `$0002`, `$0006`, `$000A`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E535`
- **Usage count:** 0

### COP [A7] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00C48A` @ chunk_008000.asm:9777-9805
- **Parameters:** _not listed in copdef.json_
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc
- **WRAM touched:** `$0000`, `$0002`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E535`
- **Usage count:** 0

### COP [A8] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00C4C2` @ chunk_008000.asm:9807-9839
- **Parameters:** _not listed in copdef.json_
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc
- **WRAM touched:** `$0000`, `$0002`, `$0006`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E535`
- **Usage count:** 0

### COP [A9] — `spawn_or_run_actor`

- **Confidence:** medium
- **Handler:** `code_00C503` @ chunk_008000.asm:9841-9877
- **Parameters:** ptr24 code, u16
- **Notes:** Far code pointer — typically actor spawn / subroutine install. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 14 times in extracted ASM
- **WRAM touched:** `$0006`, `$0026`, `$0028`, `$002A`, `$01`, `$02`, `$03`, `$0EF6`, `$24`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E587`
- **JSL:** `code_0481EE`
- **Usage count:** 14
- **Source examples:**
  - `hacker_fortress/tetron_room/actor_04DB88.asm:25` — `COP [A9] ( @code_04DBCC, #$2800 )`
  - `system/actor_0BD8F4.asm:344` — `COP [A9] ( @code_0BDC80, #$2800 )`
  - `system/actor_0BD8F4.asm:368` — `COP [A9] ( @code_0BDC6F, #$2000 )`
  - `system/actor_0BD8F4.asm:395` — `COP [A9] ( @code_0BDC97, #$2800 )`
  - `system/chunk_008000.asm:15944` — `COP [A9] ( @code_03BC0A, #$2001 )`

### COP [AA] — `spawn_child_actor`

- **Confidence:** high
- **Handler:** `code_00C54A` @ chunk_008000.asm:9879-9899
- **Parameters:** ptr24 code
- **Description:** Spawn child actor running `@Code`; link parent in `$7F0022`.
- **Notes:** Named from handler reverse-engineering in chunk_008000.asm. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 206 times in extracted ASM
- **WRAM touched:** `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E55E`
- **Usage count:** 206
- **Source examples:**
  - `boot/boot_logo/actor_04B187.asm:21` — `COP [AA] ( @code_04B25F )`
  - `boot/boot_logo/actor_04B187.asm:22` — `COP [AA] ( @code_04B280 )`
  - `boot/prologue_androids/actor_04EA2D.asm:24` — `COP [AA] ( @code_0BDE9F )`
  - `boot/prologue_hackers/actor_04E8B2.asm:12` — `COP [AA] ( @code_04E8EA )`
  - `boot/prologue_hackers/actor_04E8B2.asm:13` — `COP [AA] ( @code_0BDE9F )`

<details><summary>Handler excerpt</summary>

```asm
code_00C54A {
    TYX 
    PHX 
    JSR $&code_00E55E
    TYX 
    LDA [$2C]
    INC $2C
    INC $2C
    STA $0028, X
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $002A, X
    LDA $01, S
    STA $7F0022, X
    TXY 
    PLX 
    LDA $2C
    STA $02, S
    RTI 
}
```

</details>

### COP [AB] — `spawn_child_word`

- **Confidence:** medium
- **Handler:** `code_00C570` @ chunk_008000.asm:9901-9925
- **Parameters:** ptr24 code, u16
- **Notes:** Named from handler patterns; verify edge cases. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 43 times in extracted ASM
- **WRAM touched:** `$0022`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E55E`
- **Usage count:** 43
- **Source examples:**
  - `system/chunk_02E9AA.asm:813` — `COP [AB] ( @code_02F1C1, #$0004 )`
  - `system/chunk_02E9AA.asm:817` — `COP [AB] ( @code_02F1C1, #$0002 )`
  - `system/chunk_02E9AA.asm:821` — `COP [AB] ( @code_02F1C1, #$0000 )`
  - `system/chunk_02E9AA.asm:1538` — `COP [AB] ( @code_02F737, #$0000 )`
  - `system/chunk_02E9AA.asm:1543` — `COP [AB] ( @code_02F737, #$0002 )`

### COP [AC] — `spawn_child_word2`

- **Confidence:** medium
- **Handler:** `code_00C59F` @ chunk_008000.asm:9927-9951
- **Parameters:** ptr24 code, u16
- **Notes:** Named from handler patterns; verify edge cases. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 138 times in extracted ASM
- **WRAM touched:** `$0006`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E55E`
- **Usage count:** 138
- **Source examples:**
  - `boot/diary_menu/actor_04B29E.asm:36` — `COP [AC] ( @code_0B836B, #$A000 )`
  - `boot/prologue_androids/actor_04EA2D.asm:22` — `COP [AC] ( @code_04EA7A, #$2800 )`
  - `boot/prologue_androids/actor_04EA2D.asm:23` — `COP [AC] ( @code_04EA8A, #$2800 )`
  - `credits/credits_inventors/actor_04D524.asm:11` — `COP [AC] ( @code_04D562, #$2800 )`
  - `credits/credits_shaman/actor_04D308.asm:66` — `COP [AC] ( @code_04D39D, #$0800 )`

### COP [AD] — `spawn_child_xy`

- **Confidence:** high
- **Handler:** `code_00C5CE` @ chunk_008000.asm:9953-9993
- **Parameters:** ptr24 code, u16, u16
- **Description:** Spawn child at relative/absolute X/Y.
- **Notes:** Named from handler reverse-engineering in chunk_008000.asm. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 247 times in extracted ASM
- **WRAM touched:** `$0000`, `$0002`, `$000A`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E55E`
- **Usage count:** 247
- **Source examples:**
  - `system/chunk_02E9AA.asm:343` — `COP [AD] ( @code_02ED4C, #$FFD0, #$0000 )`
  - `system/chunk_02E9AA.asm:355` — `COP [AD] ( @code_02ED65, #$0030, #$0000 )`
  - `system/chunk_02E9AA.asm:441` — `COP [AD] ( @code_02ED9B, #$0000, #$FFE0 )`
  - `system/chunk_02E9AA.asm:442` — `COP [AD] ( @code_02ED9B, #$0000, #$0020 )`
  - `system/chunk_02E9AA.asm:594` — `COP [AD] ( @code_02EF58, #$FFF8, #$0000 )`

<details><summary>Handler excerpt</summary>

```asm
code_00C5CE {
    TYX 
    PHX 
    JSR $&code_00E55E
    TYX 
    LDA [$2C]
    INC $2C
    INC $2C
    STA $0028, X
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $002A, X
    LDA $000A, X
    ASL 
    ASL 
    LDA [$2C]
    INC $2C
    INC $2C
    BCC loc_00C5F8
    EOR #$FFFF
    INC 

  loc_00C5F8:
  ; ...
```

</details>

### COP [AE] — `spawn_child_xy_param`

- **Confidence:** medium
- **Handler:** `code_00C619` @ chunk_008000.asm:9995-10039
- **Parameters:** ptr24 code, u16, u16, u16
- **Notes:** Named from handler patterns; verify edge cases. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 110 times in extracted ASM
- **WRAM touched:** `$0000`, `$0002`, `$0006`, `$000A`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E55E`
- **Usage count:** 110
- **Source examples:**
  - `boot/diary_menu/actor_04B29E.asm:78` — `COP [AE] ( @code_04B3BD, #$0024, #$0066, #$8000 )`
  - `boot/prologue_inventor/actor_04EE8B.asm:20` — `COP [AE] ( @code_04EF03, #$FFD0, #$FFE0, #$0800 )`
  - `boot/prologue_inventor/actor_04EE8B.asm:21` — `COP [AE] ( @code_04EF2E, #$FFB0, #$0000, #$0800 )`
  - `boot/prologue_inventor/actor_04EE8B.asm:22` — `COP [AE] ( @code_04EF2E, #$FFB0, #$0020, #$0800 )`
  - `credits/credits_chickens/actor_04D745.asm:40` — `COP [AE] ( @code_04D80D, #$0010, #$0000, #$0800 )`

### COP [AF] — `spawn_child_words`

- **Confidence:** medium
- **Handler:** `code_00C66D` @ chunk_008000.asm:10041-10069
- **Parameters:** ptr24 code, u16, u16
- **Notes:** Named from handler patterns; verify edge cases. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 24 times in extracted ASM
- **WRAM touched:** `$0000`, `$0002`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E55E`
- **Usage count:** 24
- **Source examples:**
  - `boot/prologue_inventor/actor_04EE8B.asm:23` — `COP [AF] ( @code_04F310, #$02B8, #$0130 )`
  - `boot/prologue_inventor/actor_04EE8B.asm:24` — `COP [AF] ( @code_04F310, #$02C8, #$0130 )`
  - `boot/prologue_inventor/actor_04EE8B.asm:25` — `COP [AF] ( @code_04F310, #$02D8, #$0130 )`
  - `boot/prologue_inventor/actor_04EE8B.asm:26` — `COP [AF] ( @code_04F310, #$0218, #$01C0 )`
  - `boot/prologue_inventor/actor_04EE8B.asm:27` — `COP [AF] ( @code_04F310, #$0228, #$01D0 )`

### COP [B0] — `spawn_child_3words`

- **Confidence:** medium
- **Handler:** `code_00C6A5` @ chunk_008000.asm:10071-10103
- **Parameters:** ptr24 code, u16, u16, u16
- **Notes:** Named from handler patterns; verify edge cases. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 4 times in extracted ASM
- **WRAM touched:** `$0000`, `$0002`, `$0006`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E55E`
- **Usage count:** 4
- **Source examples:**
  - `prinkys_mansion/mansion_tower2_center/actor_06B52E.asm:31` — `COP [B0] ( @code_06B547, #$0188, #$0150, #$0800 )`
  - `unorganized/map_1C0/actor_04EF36.asm:24` — `COP [B0] ( @code_04F34F, #$00A8, #$00B0, #$0800 )`
  - `unorganized/map_1C0/actor_04EF36.asm:25` — `COP [B0] ( @code_04F381, #$00B8, #$00B0, #$0800 )`
  - `unorganized/map_1C0/actor_04EF36.asm:26` — `COP [B0] ( @code_04F3B3, #$00C8, #$00B0, #$0800 )`

### COP [B1] — `spawn_child_3words_alt`

- **Confidence:** medium
- **Handler:** `code_00C6E6` @ chunk_008000.asm:10105-10149
- **Parameters:** ptr24 code, u16, u16, u16
- **Notes:** Named from handler patterns; verify edge cases. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 33 times in extracted ASM
- **WRAM touched:** `$0000`, `$0002`, `$000A`, `$0022`, `$0028`, `$002A`, `$01`, `$02`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSR:** `code_00E55E`
- **Usage count:** 33
- **Source examples:**
  - `system/chunk_02E9AA.asm:55` — `COP [B1] ( @code_02EAAB, #$0008, #$0000, #$0001 )`
  - `system/chunk_02E9AA.asm:65` — `COP [B1] ( @code_02EAAB, #$0008, #$0000, #$0002 )`
  - `system/chunk_02E9AA.asm:75` — `COP [B1] ( @code_02EAAB, #$0008, #$0000, #$0003 )`
  - `system/chunk_02E9AA.asm:81` — `COP [B1] ( @code_02EB0A, #$0008, #$FFE0, #$0006 )`
  - `system/chunk_02E9AA.asm:84` — `COP [B1] ( @code_02EB0A, #$0008, #$FFE0, #$0008 )`

### COP [B2] — `update_sprite`

- **Confidence:** high
- **Handler:** `code_00C73A` @ chunk_008000.asm:10151-10157
- **Parameters:** (none)
- **Description:** Force sprite/OAM update (`code_04FD4E`).
- **Notes:** Named from handler reverse-engineering in chunk_008000.asm. Behaviors: sets_return_pc. Seen 533 times in extracted ASM
- **WRAM touched:** `$02`, `$2C`
- **JSL:** `code_04FD4E`
- **Usage count:** 533
- **Source examples:**
  - `boot/boot_logo/actor_04B187.asm:69` — `COP [B2]`
  - `boot/boot_logo/actor_04B187.asm:83` — `COP [B2]`
  - `boot/diary_menu/actor_04B29E.asm:44` — `COP [B2]`
  - `boot/diary_menu/actor_04B29E.asm:127` — `COP [B2]`
  - `boot/prologue_androids/actor_04EA2D.asm:66` — `COP [B2]`

<details><summary>Handler excerpt</summary>

```asm
code_00C73A {
    TYX 
    JSL $@code_04FD4E
    LDA $2C
    STA $02, S
    RTI 
}
```

</details>

### COP [B3] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00C744` @ chunk_008000.asm:10159-10165
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc. Seen 6 times in extracted ASM
- **WRAM touched:** `$02`, `$2C`
- **JSL:** `code_04FD85`
- **Usage count:** 6
- **Source examples:**
  - `system/chunk_02E9AA.asm:137` — `COP [B3]`
  - `system/chunk_02E9AA.asm:1193` — `COP [B3]`
  - `system/chunk_02E9AA.asm:1204` — `COP [B3]`
  - `system/chunk_038000.asm:6299` — `COP [B3]`
  - `system/chunk_038000.asm:12768` — `COP [B3]`

### COP [B4] — `byte_op`

- **Confidence:** low
- **Handler:** `code_00C74E` @ chunk_008000.asm:10167-10179
- **Parameters:** u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 10 times in extracted ASM
- **WRAM touched:** `$02`, `$1C`, `$2C`
- **Usage count:** 10
- **Source examples:**
  - `system/actor_04BA77.asm:31` — `COP [B4] ( #00 )`
  - `system/actor_04BA77.asm:35` — `COP [B4] ( #15 )`
  - `system/actor_04BA77.asm:40` — `COP [B4] ( #00 )`
  - `system/actor_04BA77.asm:44` — `COP [B4] ( #16 )`
  - `system/chunk_038000.asm:5146` — `COP [B4] ( #02 )`

### COP [B5] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00C762` @ chunk_008000.asm:10181-10193
- **Parameters:** _not listed in copdef.json_
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc
- **WRAM touched:** `$02`, `$1E`, `$2C`
- **Usage count:** 0

### COP [B6] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00C776` @ chunk_008000.asm:10195-10214
- **Parameters:** _not listed in copdef.json_
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc
- **WRAM touched:** `$02`, `$1C`, `$1E`, `$2C`
- **Usage count:** 0

### COP [B7] — `word_op`

- **Confidence:** low
- **Handler:** `code_00C798` @ chunk_008000.asm:10216-10235
- **Parameters:** u16
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 24 times in extracted ASM
- **WRAM touched:** `$00`, `$02`, `$0A`, `$2C`
- **Usage count:** 24
- **Source examples:**
  - `boot/boot_logo/actor_04B187.asm:14` — `COP [B7] ( #$FFF8 )`
  - `boot/title_screen/actor_04E651.asm:41` — `COP [B7] ( #$FFE0 )`
  - `credits/credits_heroes/actor_04CEAC.asm:10` — `COP [B7] ( #$FF60 )`
  - `credits/credits_heroes/actor_04CEE3.asm:8` — `COP [B7] ( #$0008 )`
  - `credits/credits_heroes/actor_04CEE3.asm:12` — `COP [B7] ( #$00A0 )`

### COP [B8] — `word_op`

- **Confidence:** low
- **Handler:** `code_00C7B3` @ chunk_008000.asm:10237-10248
- **Parameters:** u16
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 27 times in extracted ASM
- **WRAM touched:** `$02`, `$2C`
- **Usage count:** 27
- **Source examples:**
  - `boot/prologue_androids/actor_04ED40.asm:8` — `COP [B8] ( #$FFF8 )`
  - `boot/title_screen/actor_04E537.asm:10` — `COP [B8] ( #$FFF8 )`
  - `hacker_fortress/tetron_room/actor_04DB88.asm:12` — `COP [B8] ( #$0008 )`
  - `seaside_cave/cave_headquarters/actor_06A2A4.asm:18` — `COP [B8] ( #$0006 )`
  - `system/actor_07BDBC.asm:10` — `COP [B8] ( #$FFF8 )`

### COP [B9] — `cop_b9`

- **Confidence:** low
- **Handler:** `code_00C7C4` @ chunk_008000.asm:10250-10275
- **Parameters:** u16, u16
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 21 times in extracted ASM
- **WRAM touched:** `$00`, `$02`, `$0A`, `$2C`
- **Usage count:** 21
- **Source examples:**
  - `boot/prologue_hackers/actor_04EC3F.asm:11` — `COP [B9] ( #$FFE8, #$0004 )`
  - `boot/prologue_hackers/actor_04EC5E.asm:11` — `COP [B9] ( #$FFE8, #$0004 )`
  - `boot/prologue_hackers/actor_04EC9B.asm:8` — `COP [B9] ( #$FFE8, #$0004 )`
  - `boot/prologue_hackers/actor_04ECC8.asm:11` — `COP [B9] ( #$0008, #$0004 )`
  - `boot/prologue_hackers/actor_04ECF9.asm:9` — `COP [B9] ( #$0008, #$0004 )`

### COP [BA] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00C7EA` @ chunk_008000.asm:10277-10291
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc. Seen 2 times in extracted ASM
- **WRAM touched:** `$00`, `$02`, `$2C`, `$34`, `$36`
- **JSR:** `code_00DF84`
- **Usage count:** 2
- **Source examples:**
  - `system/actor_0BD8F4.asm:143` — `COP [BA]`
  - `unorganized/actor_09D35D.asm:32` — `COP [BA]`

### COP [BB] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00C803` @ chunk_008000.asm:10293-10307
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc. Seen 2 times in extracted ASM
- **WRAM touched:** `$00`, `$02`, `$2C`, `$34`, `$36`
- **JSR:** `code_00E045`
- **Usage count:** 2
- **Source examples:**
  - `system/actor_0BD8F4.asm:206` — `COP [BB]`
  - `unorganized/actor_09D35D.asm:19` — `COP [BB]`

### COP [BC] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00C81C` @ chunk_008000.asm:10309-10323
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc. Seen 2 times in extracted ASM
- **WRAM touched:** `$00`, `$02`, `$2C`, `$34`, `$36`
- **JSR:** `code_00DDF4`
- **Usage count:** 2
- **Source examples:**
  - `system/actor_0BD8F4.asm:252` — `COP [BC]`
  - `unorganized/actor_09D35D.asm:50` — `COP [BC]`

### COP [BD] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00C835` @ chunk_008000.asm:10325-10339
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc. Seen 4 times in extracted ASM
- **WRAM touched:** `$00`, `$02`, `$2C`, `$34`, `$36`
- **JSR:** `code_00DEB5`
- **Usage count:** 4
- **Source examples:**
  - `system/actor_0BD8F4.asm:296` — `COP [BD]`
  - `unorganized/actor_08A981.asm:44` — `COP [BD]`
  - `unorganized/actor_09D35D.asm:63` — `COP [BD]`
  - `unorganized/map_F2/actor_089DFB.asm:32` — `COP [BD]`

### COP [BE] — `cop_be`

- **Confidence:** low
- **Handler:** `code_00C84E` @ chunk_008000.asm:10341-10403
- **Parameters:** u8, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 2 times in extracted ASM
- **WRAM touched:** `$0004`, `$02`, `$0560`, `$09F8`, `$09FC`, `$09FE`, `$0A00`, `$0BAE`, `$12`, `$1C`, `$1E`, `$2C`, `$30`
- **Actor RAM:** `$7F000C`, `$7F101A`
- **JSR:** `code_00E3BA`, `code_00E4E1`
- **Usage count:** 2
- **Source examples:**
  - `system/actor_0BD8F4.asm:144` — `COP [BE] ( #FF, &code_0BD937 )`
  - `system/actor_0BD8F4.asm:207` — `COP [BE] ( #FF, &code_0BD937 )`

### COP [BF] — `cop_bf`

- **Confidence:** low
- **Handler:** `code_00C8CD` @ chunk_008000.asm:10405-10467
- **Parameters:** u8, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 2 times in extracted ASM
- **WRAM touched:** `$0004`, `$02`, `$0560`, `$09F8`, `$09FA`, `$09FE`, `$0A00`, `$0BAE`, `$12`, `$1C`, `$1E`, `$2C`, `$30`
- **Actor RAM:** `$7F000C`, `$7F101A`
- **JSR:** `code_00E3BA`, `code_00E4E1`
- **Usage count:** 2
- **Source examples:**
  - `system/actor_0BD8F4.asm:253` — `COP [BF] ( #FF, &code_0BD937 )`
  - `system/actor_0BD8F4.asm:297` — `COP [BF] ( #FF, &code_0BD937 )`

### COP [C0] — `byte_op`

- **Confidence:** low
- **Handler:** `code_00C94C` @ chunk_008000.asm:10469-10527
- **Parameters:** u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 1 times in extracted ASM
- **WRAM touched:** `$02`, `$04`, `$09F8`, `$09FA`, `$09FC`, `$09FE`, `$0A00`, `$0A10`, `$0BAE`, `$12`, `$1C`, `$1E`, `$2C`, `$30`
- **Actor RAM:** `$7F000C`, `$7F101A`
- **JSR:** `code_00E420`
- **Usage count:** 1
- **Source examples:**
  - `system/actor_0BD8F4.asm:55` — `COP [C0] ( #FF )`

### COP [C1] — `cop_c1`

- **Confidence:** low
- **Handler:** `code_00C9C1` @ chunk_008000.asm:10529-10549
- **Parameters:** u8, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc, skip_word_continue. Seen 3 times in extracted ASM
- **WRAM touched:** `$02`, `$0862`, `$2C`
- **Usage count:** 3
- **Source examples:**
  - `system/actor_0BD8F4.asm:859` — `COP [C1] ( #20, &code_0BDF7F )`
  - `system/actor_0BD8F4.asm:988` — `COP [C1] ( #10, &code_0BE0B9 )`
  - `system/actor_0BD8F4.asm:1083` — `COP [C1] ( #10, &code_0BE17E )`

### COP [C2] — `cop_c2`

- **Confidence:** low
- **Handler:** `code_00C9E2` @ chunk_008000.asm:10551-10567
- **Parameters:** u8, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc, skip_word_continue. Seen 3 times in extracted ASM
- **WRAM touched:** `$02`, `$0866`, `$2C`
- **Usage count:** 3
- **Source examples:**
  - `system/actor_0BD8F4.asm:850` — `COP [C2] ( #00, &code_0BDF7F )`
  - `system/actor_0BD8F4.asm:979` — `COP [C2] ( #10, &code_0BE0B9 )`
  - `system/actor_0BD8F4.asm:1074` — `COP [C2] ( #00, &code_0BE17E )`

### COP [C3] — `cop_c3`

- **Confidence:** low
- **Handler:** `code_00C9FB` @ chunk_008000.asm:10569-10589
- **Parameters:** u8, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc, skip_word_continue. Seen 3 times in extracted ASM
- **WRAM touched:** `$00`, `$02`, `$0860`, `$2C`
- **Usage count:** 3
- **Source examples:**
  - `system/actor_0BD8F4.asm:868` — `COP [C3] ( #00, &code_0BDF7F )`
  - `system/actor_0BD8F4.asm:997` — `COP [C3] ( #10, &code_0BE0B9 )`
  - `system/actor_0BD8F4.asm:1092` — `COP [C3] ( #00, &code_0BE17E )`

### COP [C4] — `cop_c4`

- **Confidence:** low
- **Handler:** `code_00CA1C` @ chunk_008000.asm:10591-10609
- **Parameters:** u8, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc, skip_word_continue. Seen 3 times in extracted ASM
- **WRAM touched:** `$00`, `$02`, `$0864`, `$2C`
- **Usage count:** 3
- **Source examples:**
  - `system/actor_0BD8F4.asm:877` — `COP [C4] ( #00, &code_0BDF7F )`
  - `system/actor_0BD8F4.asm:1006` — `COP [C4] ( #10, &code_0BE0B9 )`
  - `system/actor_0BD8F4.asm:1101` — `COP [C4] ( #00, &code_0BE17E )`

### COP [C5] — `byte_op`

- **Confidence:** low
- **Handler:** `code_00CA39` @ chunk_008000.asm:10611-10626
- **Parameters:** u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 54 times in extracted ASM
- **WRAM touched:** `$01`, `$02`, `$0A`, `$2C`
- **Usage count:** 54
- **Source examples:**
  - `credits/actor_04DAC5.asm:8` — `COP [C5] ( #30 )`
  - `credits/credits_cyberspace/actor_04D721.asm:8` — `COP [C5] ( #30 )`
  - `credits/credits_shaman/actor_04D308.asm:87` — `COP [C5] ( #30 )`
  - `prinkys_mansion/actor_06F702.asm:8` — `COP [C5] ( #30 )`
  - `prinkys_mansion/mansion_breezeway/actor_06F782.asm:8` — `COP [C5] ( #30 )`

### COP [C6] — `byte_op`

- **Confidence:** low
- **Handler:** `code_00CA52` @ chunk_008000.asm:10628-10643
- **Parameters:** u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 33 times in extracted ASM
- **WRAM touched:** `$01`, `$02`, `$0A`, `$2C`
- **Usage count:** 33
- **Source examples:**
  - `boot/diary_menu/actor_04B29E.asm:120` — `COP [C6] ( #0E )`
  - `boot/prologue_inventor/actor_04ED79.asm:35` — `COP [C6] ( #0E )`
  - `boot/title_screen/actor_04E537.asm:12` — `COP [C6] ( #00 )`
  - `native_village/native_inn/actor_07BAB4.asm:39` — `COP [C6] ( #08 )`
  - `native_village/native_village/actor_07B409.asm:40` — `COP [C6] ( #08 )`

### COP [C7] — `byte_op`

- **Confidence:** low
- **Handler:** `code_00CA6B` @ chunk_008000.asm:10645-10660
- **Parameters:** u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 24 times in extracted ASM
- **WRAM touched:** `$01`, `$02`, `$0A`, `$2C`
- **Usage count:** 24
- **Source examples:**
  - `boot/title_screen/actor_04E60C.asm:28` — `COP [C7] ( #00 )`
  - `credits/credits_chickens/actor_04D745.asm:113` — `COP [C7] ( #01 )`
  - `system/chunk_038000.asm:7242` — `COP [C7] ( #01 )`
  - `system/chunk_038000.asm:11686` — `COP [C7] ( #00 )`
  - `system/chunk_0B8000.asm:7150` — `COP [C7] ( #00 )`

### COP [C8] — `cop_c8`

- **Confidence:** low
- **Handler:** `code_00CA84` @ chunk_008000.asm:10662-10687
- **Parameters:** ptr24 binary, u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 73 times in extracted ASM
- **WRAM touched:** `$02`, `$2C`
- **Actor RAM:** `$7F0000`, `$7F0002`, `$7F000C`
- **JSL:** `code_04FC71`, `code_04FCE6`
- **Usage count:** 73
- **Source examples:**
  - `boot/diary_menu/actor_04B29E.asm:118` — `COP [C8] ( @spritemap_0E8000, #00 )`
  - `boot/title_screen/actor_04E5C1.asm:9` — `COP [C8] ( @spritemap_0F8000, #00 )`
  - `boot/title_screen/actor_04E60C.asm:27` — `COP [C8] ( @spritemap_128000, #00 )`
  - `credits/credits_chickens/actor_04D745.asm:108` — `COP [C8] ( @spritemap_12C000, #01 )`
  - `credits/credits_heroes/actor_04CEE3.asm:9` — `COP [C8] ( @spritemap_0F8000, #00 )`

### COP [C9] — `cop_c9`

- **Confidence:** low
- **Handler:** `code_00CABB` @ chunk_008000.asm:10689-10704
- **Parameters:** address24
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 24 times in extracted ASM
- **WRAM touched:** `$02`, `$08`, `$2C`
- **Actor RAM:** `$7F002E`, `$7F0030`
- **Usage count:** 24
- **Source examples:**
  - `boot/diary_menu/actor_04B29E.asm:119` — `COP [C9] ( $7FD000 )`
  - `boot/prologue_inventor/actor_04ED79.asm:10` — `COP [C9] ( $7FD000 )`
  - `boot/title_screen/actor_04E537.asm:11` — `COP [C9] ( $7FD000 )`
  - `credits/credits_fortress/actor_04DA33.asm:8` — `COP [C9] ( $7FD000 )`
  - `credits/credits_heroes/actor_04CEAC.asm:8` — `COP [C9] ( $7FD000 )`

### COP [CA] — `byte_op`

- **Confidence:** low
- **Handler:** `code_00CADB` @ chunk_008000.asm:10706-10757
- **Parameters:** u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, may_halt_rtl, reads_operands, sets_script_pc_$28. Seen 51 times in extracted ASM
- **WRAM touched:** `$0526`, `$0527`, `$06`, `$09BE`, `$28`, `$2C`
- **Actor RAM:** `$7F002E`, `$7F0030`
- **JSL:** `code_08E62D`
- **Usage count:** 51
- **Source examples:**
  - `system/chunk_02E9AA.asm:451` — `COP [CA] ( #0B )`
  - `system/chunk_02E9AA.asm:460` — `COP [CA] ( #03 )`
  - `system/chunk_02E9AA.asm:971` — `COP [CA] ( #0C )`
  - `system/chunk_02E9AA.asm:1201` — `COP [CA] ( #06 )`
  - `system/chunk_02E9AA.asm:1689` — `COP [CA] ( #06 )`

### COP [CB] — `continue_next_tick`

- **Confidence:** high
- **Handler:** `code_00CB38` @ chunk_008000.asm:10759-10767
- **Parameters:** (none)
- **Description:** Checkpoint: keep PC, continue next interpreter entry (no RTL).
- **Notes:** Named from handler reverse-engineering in chunk_008000.asm. Behaviors: sets_return_pc, sets_script_pc_$28. Seen 744 times in extracted ASM
- **WRAM touched:** `$02`, `$28`, `$2A`, `$2C`, `$2E`
- **Usage count:** 744
- **Source examples:**
  - `boot/actor_04E6E9.asm:12` — `COP [CB]`
  - `boot/boot_logo/actor_04B187.asm:23` — `COP [CB]`
  - `boot/boot_logo/actor_04B187.asm:34` — `COP [CB]`
  - `boot/boot_logo/actor_04B187.asm:51` — `COP [CB]`
  - `boot/diary_menu/actor_04B29E.asm:113` — `COP [CB]`

<details><summary>Handler excerpt</summary>

```asm
code_00CB38 {
    TYX 
    LDA $2E
    STA $2A
    LDA $2C
    STA $28
    STA $02, S
    RTI 
}
```

</details>

### COP [CC] — `yield_next_tick`

- **Confidence:** high
- **Handler:** `code_00CB44` @ chunk_008000.asm:10769-10778
- **Parameters:** (none)
- **Description:** Yield to next frame (PLA/PLA/RTL) keeping resume PC.
- **Notes:** Named from handler reverse-engineering in chunk_008000.asm. Behaviors: may_halt_rtl, sets_script_pc_$28. Seen 393 times in extracted ASM
- **WRAM touched:** `$28`, `$2A`, `$2C`, `$2E`
- **Usage count:** 393
- **Source examples:**
  - `boot/title_screen/actor_04E49A.asm:44` — `COP [CC]`
  - `boot/title_screen/actor_04E60C.asm:23` — `COP [CC]`
  - `credits/credits_ghosts/actor_04D12C.asm:12` — `COP [CC]`
  - `credits/credits_ghosts/actor_04D14A.asm:12` — `COP [CC]`
  - `credits/credits_ghosts/actor_04D16C.asm:12` — `COP [CC]`

<details><summary>Handler excerpt</summary>

```asm
code_00CB44 {
    TYX 
    LDA $2E
    STA $2A
    LDA $2C
    STA $28
    PLA 
    PLA 
    RTL 
}
```

</details>

### COP [CD] — `spawn_or_run_actor`

- **Confidence:** medium
- **Handler:** `code_00CB50` @ chunk_008000.asm:10780-10797
- **Parameters:** ptr24 code, u16
- **Notes:** Far code pointer — typically actor spawn / subroutine install. Behaviors: advances_script_ptr, may_halt_rtl, reads_operands, sets_script_pc_$28. Seen 6 times in extracted ASM
- **WRAM touched:** `$0E`, `$28`, `$2A`, `$2C`
- **Usage count:** 6
- **Source examples:**
  - `boot/prologue_inventor/actor_04EB34.asm:38` — `COP [CD] ( @code_04EB65, #$0002 )`
  - `boot/prologue_inventor/actor_04EB34.asm:59` — `COP [CD] ( @code_04EB92, #$0002 )`
  - `hacker_fortress/tetron_room/actor_04DB88.asm:89` — `COP [CD] ( @code_04DC05, #$0020 )`
  - `system/actor_04B881.asm:103` — `COP [CD] ( @code_04B92C, #$0005 )`
  - `system/actor_04BA77.asm:47` — `COP [CD] ( @code_04BA9F, #$0004 )`

### COP [CE] — `spawn_or_run_actor`

- **Confidence:** medium
- **Handler:** `code_00CB6D` @ chunk_008000.asm:10799-10813
- **Parameters:** ptr24 code
- **Notes:** Far code pointer — typically actor spawn / subroutine install. Behaviors: advances_script_ptr, may_halt_rtl, reads_operands, sets_script_pc_$28. Seen 7 times in extracted ASM
- **WRAM touched:** `$28`, `$2A`, `$2C`
- **Usage count:** 7
- **Source examples:**
  - `seaside_cave/cave_entrance/actor_06861D.asm:41` — `COP [CE] ( @code_068628 )`
  - `system/chunk_048000.asm:6015` — `COP [CE] ( @code_04BC56 )`
  - `system/chunk_0B8000.asm:28` — `COP [CE] ( @code_0B8391 )`
  - `system/chunk_0B8000.asm:202` — `COP [CE] ( @code_0B84A1 )`
  - `unorganized/map_14E/actor_09D95A.asm:31` — `COP [CE] ( @code_09D974 )`

### COP [CF] — `goto_far`

- **Confidence:** high
- **Handler:** `code_00CB84` @ chunk_008000.asm:10815-10829
- **Parameters:** ptr24 code
- **Description:** Goto far `@Code` (sets `$28/$2A`).
- **Notes:** Named from handler reverse-engineering in chunk_008000.asm. Behaviors: advances_script_ptr, reads_operands, sets_return_pc, sets_script_pc_$28. Seen 151 times in extracted ASM
- **WRAM touched:** `$02`, `$28`, `$2A`, `$2C`
- **Usage count:** 151
- **Source examples:**
  - `fathers_house/actor_07A684.asm:72` — `COP [CF] ( @code_07A6B8 )`
  - `fathers_house/chicken_farm/actor_07A575.asm:54` — `COP [CF] ( @code_07A598 )`
  - `fathers_house/chicken_farm/actor_07A575.asm:61` — `COP [CF] ( @code_07A598 )`
  - `fathers_house/farmers_house/actor_07A382.asm:54` — `COP [CF] ( @code_07A38D )`
  - `fathers_house/fathers_house/actor_078ACB.asm:77` — `COP [CF] ( @code_078AED )`

<details><summary>Handler excerpt</summary>

```asm
code_00CB84 {
    TYX 
    LDA [$2C]
    INC $2C
    INC $2C
    STA $28
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $2A
    STZ $0E
    LDA $2C
    STA $02, S
    RTI 
}
```

</details>

### COP [D0] — `delay_frames`

- **Confidence:** high
- **Handler:** `code_00CB9D` @ chunk_008000.asm:10831-10844
- **Parameters:** u16
- **Description:** Delay Word frames (stores `$0E`, yields).
- **Notes:** Named from handler reverse-engineering in chunk_008000.asm. Behaviors: advances_script_ptr, may_halt_rtl, reads_operands, sets_script_pc_$28. Seen 762 times in extracted ASM
- **WRAM touched:** `$0E`, `$28`, `$2A`, `$2C`, `$2E`
- **Usage count:** 762
- **Source examples:**
  - `boot/diary_menu/actor_04B29E.asm:26` — `COP [D0] ( #$0002 )`
  - `boot/diary_menu/actor_04B29E.asm:56` — `COP [D0] ( #$0002 )`
  - `boot/diary_menu/actor_04B29E.asm:88` — `COP [D0] ( #$0002 )`
  - `boot/prologue_androids/actor_04EA2D.asm:26` — `COP [D0] ( #$0010 )`
  - `boot/prologue_androids/actor_04EA2D.asm:28` — `COP [D0] ( #$00C8 )`

<details><summary>Handler excerpt</summary>

```asm
code_00CB9D {
    TYX 
    LDA [$2C]
    INC $2C
    INC $2C
    STA $0E
    LDA $2E
    STA $2A
    LDA $2C
    STA $28
    PLA 
    PLA 
    RTL 
}
```

</details>

### COP [D1] — `cop_d1`

- **Confidence:** low
- **Handler:** `code_00CBB1` @ chunk_008000.asm:10846-10877
- **Parameters:** u8, u8, u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, may_halt_rtl, reads_operands, sets_return_pc, sets_script_pc_$28. Seen 34 times in extracted ASM
- **WRAM touched:** `$02`, `$0BC0`, `$0BC2`, `$0BC4`, `$28`, `$2C`
- **Usage count:** 34
- **Source examples:**
  - `fathers_house/fathers_yard/actor_0783DB.asm:96` — `COP [D1] ( #00, #00, #01 )`
  - `native_village/native_inn/actor_07BD34.asm:28` — `COP [D1] ( #00, #00, #0A )`
  - `native_village/native_inn/actor_07BD34.asm:29` — `COP [D1] ( #1B, #00, #05 )`
  - `native_village/native_inn/actor_07BD34.asm:48` — `COP [D1] ( #1B, #00, #01 )`
  - `native_village/native_inn/actor_07BD34.asm:49` — `COP [D1] ( #00, #00, #0A )`

### COP [D2] — `cop_d2`

- **Confidence:** low
- **Handler:** `code_00CBEC` @ chunk_008000.asm:10879-10914
- **Parameters:** u8, u8, u8, u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, may_halt_rtl, reads_operands, sets_return_pc, sets_script_pc_$28. Seen 12 times in extracted ASM
- **WRAM touched:** `$02`, `$0BC0`, `$0BC2`, `$0BC4`, `$0BC6`, `$28`, `$2C`
- **JSR:** `code_00E398`
- **Usage count:** 12
- **Source examples:**
  - `fathers_house/fathers_house/actor_078A36.asm:47` — `COP [D2] ( #01, #01, #10, #02 )`
  - `fathers_house/fathers_yard/actor_0783DB.asm:39` — `COP [D2] ( #06, #02, #01, #02 )`
  - `fathers_house/fathers_yard/actor_0783DB.asm:62` — `COP [D2] ( #06, #02, #01, #02 )`
  - `fathers_house/fathers_yard/actor_0783DB.asm:81` — `COP [D2] ( #06, #02, #01, #02 )`
  - `native_village/elders_hut/actor_07D0D7.asm:35` — `COP [D2] ( #01, #01, #10, #01 )`

### COP [D3] — `cop_d3`

- **Confidence:** low
- **Handler:** `code_00CC31` @ chunk_008000.asm:10916-10951
- **Parameters:** u8, u8, u8, u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, may_halt_rtl, reads_operands, sets_return_pc, sets_script_pc_$28. Seen 21 times in extracted ASM
- **WRAM touched:** `$02`, `$0BC0`, `$0BC2`, `$0BC4`, `$0BC8`, `$28`, `$2C`
- **JSR:** `code_00E398`
- **Usage count:** 21
- **Source examples:**
  - `fathers_house/fathers_yard/actor_0783DB.asm:43` — `COP [D3] ( #05, #01, #01, #02 )`
  - `fathers_house/fathers_yard/actor_0783DB.asm:47` — `COP [D3] ( #05, #01, #01, #02 )`
  - `fathers_house/fathers_yard/actor_0783DB.asm:66` — `COP [D3] ( #05, #01, #01, #02 )`
  - `fathers_house/fathers_yard/actor_0783DB.asm:70` — `COP [D3] ( #05, #01, #01, #02 )`
  - `fathers_house/fathers_yard/actor_0783DB.asm:85` — `COP [D3] ( #05, #01, #01, #02 )`

### COP [D4] — `yield_halt`

- **Confidence:** low
- **Handler:** `code_00CC76` @ chunk_008000.asm:10953-10969
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: may_halt_rtl, sets_return_pc, sets_script_pc_$28. Seen 2 times in extracted ASM
- **WRAM touched:** `$02`, `$0BC0`, `$28`, `$2C`
- **Usage count:** 2
- **Source examples:**
  - `native_village/elders_hut/actor_07D0D7.asm:36` — `COP [D4]`
  - `unorganized/map_1A9/actor_0CD67A.asm:61` — `COP [D4]`

### COP [D5] — `cop_d5`

- **Confidence:** low
- **Handler:** `code_00CC8A` @ chunk_008000.asm:10971-10992
- **Parameters:** u8, address24
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc, sets_script_pc_$28. Seen 26 times in extracted ASM
- **WRAM touched:** `$02`, `$0A`, `$28`, `$2C`
- **Actor RAM:** `$7F0000`, `$7F0002`, `$7F000C`
- **Usage count:** 26
- **Source examples:**
  - `credits/credits_shaman/actor_04D308.asm:88` — `COP [D5] ( #05, @spritemap_128000 )`
  - `prinkys_mansion/mansion_towerB_lair/actor_06BAD7.asm:112` — `COP [D5] ( #05, @spritemap_128000 )`
  - `seaside_cave/cave_lower/actor_06AA7D.asm:37` — `COP [D5] ( #05, @spritemap_128000 )`
  - `system/chunk_038000.asm:3916` — `COP [D5] ( #00, @spritemap_12A000 )`
  - `system/chunk_038000.asm:3925` — `COP [D5] ( #01, @spritemap_12A000 )`

### COP [D6] — `cop_d6`

- **Confidence:** low
- **Handler:** `code_00CCB9` @ chunk_008000.asm:10994-11019
- **Parameters:** u8, u8, address24
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc, sets_script_pc_$28. Seen 2 times in extracted ASM
- **WRAM touched:** `$02`, `$0A`, `$12`, `$28`, `$2C`
- **Actor RAM:** `$7F0000`, `$7F0002`, `$7F000C`
- **Usage count:** 2
- **Source examples:**
  - `system/chunk_038000.asm:4828` — `COP [D6] ( #01, #03, @spritemap_128000 )`
  - `system/chunk_038000.asm:14830` — `COP [D6] ( #0F, #0A, @spritemap_128000 )`

### COP [D7] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00CCF1` @ chunk_008000.asm:11021-11079
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc, sets_script_pc_$28. Seen 1 times in extracted ASM
- **WRAM touched:** `$00`, `$02`, `$04`, `$05CA`, `$05CC`, `$05D8`, `$06`, `$0A`, `$28`, `$2A`, `$2C`
- **Actor RAM:** `$7F000C`, `$7F0028`, `$7F002C`, `$7F100C`, `$7F1030`, `$7F1032`, `$7F200E`, `$7F2010`
- **JSR:** `code_00CDFB`
- **JSL:** `code_03CD92`
- **Usage count:** 1
- **Source examples:**
  - `system/chunk_038000.asm:3716` — `COP [D7]`

### COP [D8] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00CD6F` @ chunk_008000.asm:11081-11142
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc, sets_script_pc_$28. Seen 58 times in extracted ASM
- **WRAM touched:** `$00`, `$02`, `$04`, `$05CA`, `$05CE`, `$05D8`, `$06`, `$28`, `$2A`, `$2C`
- **Actor RAM:** `$7F000C`, `$7F0028`, `$7F002C`, `$7F100C`, `$7F1030`, `$7F1032`, `$7F200E`, `$7F2010`
- **JSR:** `code_00CDFB`
- **JSL:** `code_03CD92`
- **Usage count:** 58
- **Source examples:**
  - `system/chunk_02E9AA.asm:18` — `COP [D8]`
  - `system/chunk_02E9AA.asm:252` — `COP [D8]`
  - `system/chunk_02E9AA.asm:535` — `COP [D8]`
  - `system/chunk_02E9AA.asm:741` — `COP [D8]`
  - `system/chunk_02E9AA.asm:992` — `COP [D8]`

### COP [D9] — `byte_op`

- **Confidence:** low
- **Handler:** `code_00CED6` @ chunk_008000.asm:11255-11268
- **Parameters:** u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_script_pc_$28. Seen 3 times in extracted ASM
- **WRAM touched:** `$28`, `$2C`
- **Actor RAM:** `$7F002C`, `$7F200E`
- **Usage count:** 3
- **Source examples:**
  - `system/chunk_02E9AA.asm:214` — `COP [D9] ( #0A )`
  - `system/chunk_038000.asm:10300` — `COP [D9] ( #09 )`
  - `system/chunk_038000.asm:11382` — `COP [D9] ( #01 )`

### COP [DA] — `cop_da`

- **Confidence:** low
- **Handler:** `code_00CEF0` @ chunk_008000.asm:11270-11361
- **Parameters:** u8, u16
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 33 times in extracted ASM
- **WRAM touched:** `$00`, `$0000`, `$0002`, `$02`, `$06`, `$0812`, `$0816`, `$0A`, `$0A02`, `$0B12`, `$22`, `$2C`, `$30`, `$34`, `$36`
- **Actor RAM:** `$7F0008`
- **Usage count:** 33
- **Source examples:**
  - `system/chunk_02E9AA.asm:712` — `COP [DA] ( #00, #$0000 )`
  - `system/chunk_02E9AA.asm:967` — `COP [DA] ( #03, #$0000 )`
  - `system/chunk_02E9AA.asm:1029` — `COP [DA] ( #02, #$FF00 )`
  - `system/chunk_02E9AA.asm:1030` — `COP [DA] ( #00, #$FFF8 )`
  - `system/chunk_02E9AA.asm:1682` — `COP [DA] ( #03, #$0000 )`

### COP [DB] — `cop_db`

- **Confidence:** low
- **Handler:** `code_00CFF6` @ chunk_008000.asm:11435-11518
- **Parameters:** u8, u16
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc, sets_script_pc_$28. Seen 42 times in extracted ASM
- **WRAM touched:** `$00`, `$02`, `$1C`, `$1E`, `$28`, `$2C`, `$30`, `$32`, `$34`, `$36`
- **Actor RAM:** `$7F000C`, `$7F0032`, `$7F0034`, `$7F0036`
- **Usage count:** 42
- **Source examples:**
  - `system/chunk_02E9AA.asm:186` — `COP [DB] ( #09, #$FF04 )`
  - `system/chunk_02E9AA.asm:669` — `COP [DB] ( #0A, #$FF04 )`
  - `system/chunk_02E9AA.asm:713` — `COP [DB] ( #08, #$FF04 )`
  - `system/chunk_02E9AA.asm:719` — `COP [DB] ( #08, #$FF04 )`
  - `system/chunk_02E9AA.asm:910` — `COP [DB] ( #09, #$FF02 )`

### COP [DC] — `yield_halt`

- **Confidence:** low
- **Handler:** `code_00D091` @ chunk_008000.asm:11520-11617
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: may_halt_rtl. Seen 42 times in extracted ASM
- **WRAM touched:** `$00`, `$0000`, `$02`, `$0E`, `$30`, `$32`, `$34`, `$36`
- **Actor RAM:** `$7F0032`, `$7F0033`, `$7F0034`, `$7F0035`
- **JSR:** `code_00D155`
- **JSL:** `code_04FC71`
- **Usage count:** 42
- **Source examples:**
  - `system/chunk_02E9AA.asm:187` — `COP [DC]`
  - `system/chunk_02E9AA.asm:670` — `COP [DC]`
  - `system/chunk_02E9AA.asm:714` — `COP [DC]`
  - `system/chunk_02E9AA.asm:720` — `COP [DC]`
  - `system/chunk_02E9AA.asm:911` — `COP [DC]`

### COP [DD] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00D17F` @ chunk_008000.asm:11665-11677
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc. Seen 24 times in extracted ASM
- **WRAM touched:** `$02`, `$0A`, `$2C`
- **JSL:** `code_04FC71`
- **Usage count:** 24
- **Source examples:**
  - `system/chunk_02E9AA.asm:231` — `COP [DD]`
  - `system/chunk_02E9AA.asm:617` — `COP [DD]`
  - `system/chunk_02E9AA.asm:631` — `COP [DD]`
  - `system/chunk_02E9AA.asm:886` — `COP [DD]`
  - `system/chunk_02E9AA.asm:1367` — `COP [DD]`

### COP [DE] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00D196` @ chunk_008000.asm:11679-11691
- **Parameters:** _not listed in copdef.json_
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc
- **WRAM touched:** `$02`, `$0A`, `$2C`
- **JSL:** `code_04FC71`
- **Usage count:** 0

### COP [DF] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00D1AD` @ chunk_008000.asm:11693-11704
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc. Seen 21 times in extracted ASM
- **WRAM touched:** `$02`, `$0A`, `$2C`
- **JSL:** `code_04FC71`
- **Usage count:** 21
- **Source examples:**
  - `boot/title_screen/actor_04E60C.asm:9` — `COP [DF]`
  - `system/chunk_038000.asm:3776` — `COP [DF]`
  - `system/chunk_038000.asm:4812` — `COP [DF]`
  - `system/chunk_038000.asm:5238` — `COP [DF]`
  - `system/chunk_038000.asm:5309` — `COP [DF]`

### COP [E0] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00D1C2` @ chunk_008000.asm:11706-11717
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc. Seen 20 times in extracted ASM
- **WRAM touched:** `$02`, `$0A`, `$2C`
- **JSL:** `code_04FC71`
- **Usage count:** 20
- **Source examples:**
  - `boot/title_screen/actor_04E5C1.asm:12` — `COP [E0]`
  - `credits/credits_heroes/actor_04CEE3.asm:10` — `COP [E0]`
  - `credits/credits_heroes/actor_04CF21.asm:8` — `COP [E0]`
  - `credits/credits_heroes/actor_04CF55.asm:8` — `COP [E0]`
  - `system/chunk_038000.asm:3763` — `COP [E0]`

### COP [E1] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00D1D7` @ chunk_008000.asm:11719-11780
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc. Seen 103 times in extracted ASM
- **WRAM touched:** `$00`, `$0000`, `$02`, `$06`, `$0A`, `$0A02`, `$0A04`, `$0A06`, `$0A08`, `$2C`
- **Actor RAM:** `$7F0008`
- **JSL:** `code_04FC71`
- **Usage count:** 103
- **Source examples:**
  - `system/chunk_02E9AA.asm:29` — `COP [E1]`
  - `system/chunk_02E9AA.asm:39` — `COP [E1]`
  - `system/chunk_02E9AA.asm:219` — `COP [E1]`
  - `system/chunk_02E9AA.asm:320` — `COP [E1]`
  - `system/chunk_02E9AA.asm:430` — `COP [E1]`

### COP [E2] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00D241` @ chunk_008000.asm:11782-11850
- **Parameters:** _not listed in copdef.json_
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: reads_operands, sets_return_pc
- **WRAM touched:** `$00`, `$0000`, `$02`, `$06`, `$0A02`, `$0A08`, `$2C`, `$30`, `$32`
- **Actor RAM:** `$7F0008`, `$7F000E`, `$7F0016`
- **Usage count:** 0

### COP [E3] — `cop_e3`

- **Confidence:** low
- **Handler:** `code_00D2B9` @ chunk_008000.asm:11852-11914
- **Parameters:** ptr16 code, ptr16 code, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: reads_operands, sets_return_pc. Seen 57 times in extracted ASM
- **WRAM touched:** `$02`, `$2C`, `$30`
- **Actor RAM:** `$7F0008`
- **JSR:** `code_00D31C`
- **Usage count:** 57
- **Source examples:**
  - `system/chunk_02E9AA.asm:1051` — `COP [E3] ( &code_02F2C7, &code_02F295, &code_02F2C7 )`
  - `system/chunk_02E9AA.asm:1092` — `COP [E3] ( &code_02F2DC, &code_02F2EC, &code_02F2E4 )`
  - `system/chunk_02E9AA.asm:1110` — `COP [E3] ( &code_02F2FA, &code_02F209, &code_02F30D )`
  - `system/chunk_02E9AA.asm:1264` — `COP [E3] ( &code_02F444, &code_02F454, &code_02F44C )`
  - `system/chunk_02E9AA.asm:1290` — `COP [E3] ( &code_02F46B, &code_02F47B, &code_02F473 )`

### COP [E4] — `jump_or_call`

- **Confidence:** low
- **Handler:** `code_00D344` @ chunk_008000.asm:11946-11967
- **Parameters:** ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: reads_operands, sets_return_pc. Seen 17 times in extracted ASM
- **WRAM touched:** `$02`, `$2C`, `$30`
- **Actor RAM:** `$7F0008`
- **JSR:** `code_00D37F`
- **Usage count:** 17
- **Source examples:**
  - `system/chunk_02E9AA.asm:282` — `COP [E4] ( &code_02EC1D )`
  - `system/chunk_02E9AA.asm:369` — `COP [E4] ( &code_02ED2C )`
  - `system/chunk_02E9AA.asm:1710` — `COP [E4] ( &code_02F788 )`
  - `system/chunk_038000.asm:9959` — `COP [E4] ( &code_03D0EF )`
  - `system/chunk_038000.asm:10025` — `COP [E4] ( &code_03D181 )`

### COP [E5] — `jump_or_call`

- **Confidence:** low
- **Handler:** `code_00D360` @ chunk_008000.asm:11969-11991
- **Parameters:** ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: reads_operands, sets_return_pc. Seen 17 times in extracted ASM
- **WRAM touched:** `$02`, `$2C`, `$30`
- **Actor RAM:** `$7F0008`
- **JSR:** `code_00D37F`
- **Usage count:** 17
- **Source examples:**
  - `system/chunk_02E9AA.asm:283` — `COP [E5] ( &code_02EC1D )`
  - `system/chunk_02E9AA.asm:370` — `COP [E5] ( &code_02ED2C )`
  - `system/chunk_02E9AA.asm:1711` — `COP [E5] ( &code_02F788 )`
  - `system/chunk_038000.asm:9960` — `COP [E5] ( &code_03D100 )`
  - `system/chunk_038000.asm:10046` — `COP [E5] ( &code_03D1A4 )`

### COP [E6] — `cop_e6`

- **Confidence:** low
- **Handler:** `code_00D3A4` @ chunk_008000.asm:12023-12045
- **Parameters:** u8, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 20 times in extracted ASM
- **WRAM touched:** `$02`, `$2C`
- **Actor RAM:** `$7F0006`
- **Usage count:** 20
- **Source examples:**
  - `system/chunk_038000.asm:9850` — `COP [E6] ( #05, &code_03CFD7 )`
  - `system/chunk_038000.asm:9934` — `COP [E6] ( #08, &code_03D0DB )`
  - `system/chunk_038000.asm:10222` — `COP [E6] ( #0D, &code_03D2EB )`
  - `system/chunk_038000.asm:10461` — `COP [E6] ( #10, &code_03D4A3 )`
  - `system/chunk_038000.asm:12442` — `COP [E6] ( #24, &code_03E3D8 )`

### COP [E7] — `cop_e7`

- **Confidence:** low
- **Handler:** `code_00D3C8` @ chunk_008000.asm:12047-12062
- **Parameters:** u8, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, may_halt_rtl, reads_operands, sets_script_pc_$28. Seen 19 times in extracted ASM
- **WRAM touched:** `$0E`, `$28`, `$2C`
- **Actor RAM:** `$7F100C`
- **Usage count:** 19
- **Source examples:**
  - `system/chunk_02E9AA.asm:435` — `COP [E7] ( #02, &code_02EBC1 )`
  - `system/chunk_02E9AA.asm:679` — `COP [E7] ( #01, &code_02EE05 )`
  - `system/chunk_038000.asm:10067` — `COP [E7] ( #01, &code_03D167 )`
  - `system/chunk_038000.asm:11115` — `COP [E7] ( #02, &code_03D92B )`
  - `system/chunk_038000.asm:11165` — `COP [E7] ( #02, &code_03D9B7 )`

### COP [E8] — `cop_e8`

- **Confidence:** low
- **Handler:** `code_00D3E4` @ chunk_008000.asm:12064-12149
- **Parameters:** u16, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: reads_operands, sets_return_pc. Seen 90 times in extracted ASM
- **WRAM touched:** `$00`, `$0000`, `$0006`, `$02`, `$06`, `$0A`, `$0A02`, `$0A08`, `$2C`, `$34`
- **Actor RAM:** `$7F0008`, `$7F000E`, `$7F0016`
- **Usage count:** 90
- **Source examples:**
  - `system/chunk_02E9AA.asm:40` — `COP [E8] ( #$0020, &code_02EA83 )`
  - `system/chunk_02E9AA.asm:225` — `COP [E8] ( #$0010, &code_02EBAA )`
  - `system/chunk_02E9AA.asm:230` — `COP [E8] ( #$0010, &code_02EBAA )`
  - `system/chunk_02E9AA.asm:329` — `COP [E8] ( #$0020, &code_02EC8D )`
  - `system/chunk_02E9AA.asm:386` — `COP [E8] ( #$0040, &code_02ECE8 )`

### COP [E9] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00D474` @ chunk_008000.asm:12151-12189
- **Parameters:** _not listed in copdef.json_
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming
- **WRAM touched:** `$00`, `$0006`, `$06`, `$0A`, `$0A02`, `$0A08`, `$34`
- **Actor RAM:** `$7F0008`, `$7F000E`, `$7F0016`
- **Usage count:** 0

### COP [EA] — `cop_ea`

- **Confidence:** low
- **Handler:** `code_00D4BA` @ chunk_008000.asm:12191-12264
- **Parameters:** u8, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 17 times in extracted ASM
- **WRAM touched:** `$00`, `$0010`, `$02`, `$0A`, `$2C`, `$30`, `$32`, `$34`, `$36`
- **JSR:** `code_00DC26`, `code_00DD06`, `code_00DDF4`, `code_00DEB5`
- **Usage count:** 17
- **Source examples:**
  - `system/chunk_02E9AA.asm:1368` — `COP [EA] ( #00, &code_02F50B )`
  - `system/chunk_038000.asm:6603` — `COP [EA] ( #00, &code_03B8D2 )`
  - `system/chunk_038000.asm:6641` — `COP [EA] ( #00, &code_03B8D2 )`
  - `system/chunk_038000.asm:11744` — `COP [EA] ( #00, &code_03DEBE )`
  - `system/chunk_038000.asm:11977` — `COP [EA] ( #00, &code_03E081 )`

### COP [EB] — `cop_eb`

- **Confidence:** low
- **Handler:** `code_00D538` @ chunk_008000.asm:12266-12335
- **Parameters:** u8, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 91 times in extracted ASM
- **WRAM touched:** `$00`, `$000A`, `$02`, `$0A`, `$0C`, `$1C`, `$2C`, `$34`, `$36`
- **Actor RAM:** `$7F0028`, `$7F002A`
- **JSR:** `code_00DDF4`, `code_00DEB5`, `code_00E462`, `code_00E4E1`
- **Usage count:** 91
- **Source examples:**
  - `system/chunk_02E9AA.asm:30` — `COP [EB] ( #03, &code_02E9D5 )`
  - `system/chunk_02E9AA.asm:93` — `COP [EB] ( #02, &code_02EA92 )`
  - `system/chunk_02E9AA.asm:104` — `COP [EB] ( #82, &code_02E9B4 )`
  - `system/chunk_02E9AA.asm:220` — `COP [EB] ( #04, &code_02EBA0 )`
  - `system/chunk_02E9AA.asm:321` — `COP [EB] ( #02, &code_02EC47 )`

### COP [EC] — `yield_halt`

- **Confidence:** low
- **Handler:** `code_00D5B3` @ chunk_008000.asm:12337-12361
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: may_halt_rtl, sets_return_pc, sets_script_pc_$28. Seen 91 times in extracted ASM
- **WRAM touched:** `$02`, `$28`, `$2C`
- **Actor RAM:** `$7F0028`, `$7F002A`
- **Usage count:** 91
- **Source examples:**
  - `system/chunk_02E9AA.asm:34` — `COP [EC]`
  - `system/chunk_02E9AA.asm:97` — `COP [EC]`
  - `system/chunk_02E9AA.asm:108` — `COP [EC]`
  - `system/chunk_02E9AA.asm:224` — `COP [EC]`
  - `system/chunk_02E9AA.asm:325` — `COP [EC]`

### COP [ED] — `jump_or_call`

- **Confidence:** low
- **Handler:** `code_00D5DC` @ chunk_008000.asm:12363-12433
- **Parameters:** ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, may_halt_rtl, reads_operands, sets_return_pc, sets_script_pc_$28. Seen 67 times in extracted ASM
- **WRAM touched:** `$0000`, `$0002`, `$0004`, `$0008`, `$02`, `$06`, `$0879`, `$0A02`, `$0AF6`, `$28`, `$2C`
- **Actor RAM:** `$7F0008`, `$7F2004`
- **JSL:** `code_04FE07`
- **Usage count:** 67
- **Source examples:**
  - `system/chunk_02E9AA.asm:309` — `COP [ED] ( &code_02EC38 )`
  - `system/chunk_02E9AA.asm:1055` — `COP [ED] ( &code_02F29D )`
  - `system/chunk_02E9AA.asm:1096` — `COP [ED] ( &code_02F2EC )`
  - `system/chunk_02E9AA.asm:1114` — `COP [ED] ( &code_02F209 )`
  - `system/chunk_02E9AA.asm:1126` — `COP [ED] ( &code_02F209 )`

### COP [EE] — `cop_ee`

- **Confidence:** low
- **Handler:** `code_00D651` @ chunk_008000.asm:12435-12466
- **Parameters:** ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Seen 67 times in extracted ASM
- **WRAM touched:** `$0000`, `$0002`, `$0004`, `$06`, `$0A02`
- **Actor RAM:** `$7F0008`
- **JSL:** `code_04FE07`
- **Usage count:** 67
- **Source examples:**
  - `system/chunk_02E9AA.asm:314` — `COP [EE] ( &code_02EC38 )`
  - `system/chunk_02E9AA.asm:1061` — `COP [EE] ( &code_02F2BA )`
  - `system/chunk_02E9AA.asm:1102` — `COP [EE] ( &code_02F2EC )`
  - `system/chunk_02E9AA.asm:1117` — `COP [EE] ( &code_02F209 )`
  - `system/chunk_02E9AA.asm:1123` — `COP [EE] ( &code_02F209 )`

### COP [EF] — `yield_halt`

- **Confidence:** low
- **Handler:** `code_00D68D` @ chunk_008000.asm:12468-12592
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: may_halt_rtl, sets_script_pc_$28. Seen 67 times in extracted ASM
- **WRAM touched:** `$00`, `$0000`, `$0002`, `$0004`, `$02`, `$06`, `$0A02`, `$0AC2`, `$0ACE`, `$0AF6`, `$0AF8`, `$0E`, `$0EE2`, `$28`, `$2C`, `$34`, `$36`
- **Actor RAM:** `$7F0008`
- **JSR:** `code_00E1AD`, `code_00E257`, `code_00E2D2`, `code_00E375`, `code_00E45F`
- **Usage count:** 67
- **Source examples:**
  - `system/chunk_02E9AA.asm:310` — `COP [EF]`
  - `system/chunk_02E9AA.asm:1056` — `COP [EF]`
  - `system/chunk_02E9AA.asm:1097` — `COP [EF]`
  - `system/chunk_02E9AA.asm:1115` — `COP [EF]`
  - `system/chunk_02E9AA.asm:1127` — `COP [EF]`

### COP [F0] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00D77E` @ chunk_008000.asm:12616-12664
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Seen 67 times in extracted ASM
- **WRAM touched:** `$00`, `$0000`, `$0002`, `$0004`, `$02`, `$06`, `$0A02`, `$0AF6`, `$0AF8`, `$0EE2`, `$34`, `$36`
- **Actor RAM:** `$7F0008`
- **Usage count:** 67
- **Source examples:**
  - `system/chunk_02E9AA.asm:315` — `COP [F0]`
  - `system/chunk_02E9AA.asm:1062` — `COP [F0]`
  - `system/chunk_02E9AA.asm:1103` — `COP [F0]`
  - `system/chunk_02E9AA.asm:1118` — `COP [F0]`
  - `system/chunk_02E9AA.asm:1124` — `COP [F0]`

### COP [F1] — `cop_f1`

- **Confidence:** low
- **Handler:** `code_00D7D7` @ chunk_008000.asm:12666-12697
- **Parameters:** u8, ptr16 code, ptr16 code, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 15 times in extracted ASM
- **WRAM touched:** `$01`, `$02`, `$04`, `$06C5`, `$2C`
- **Usage count:** 15
- **Source examples:**
  - `system/chunk_038000.asm:4111` — `COP [F1] ( #02, &code_03A42A, &code_03A437, &code_03A444 )`
  - `system/chunk_038000.asm:4138` — `COP [F1] ( #01, &code_03A42A, &code_03A437, &code_03A444 )`
  - `system/chunk_038000.asm:4206` — `COP [F1] ( #02, &code_03A521, &code_03A52E, &code_03A53A )`
  - `system/chunk_038000.asm:4235` — `COP [F1] ( #01, &code_03A521, &code_03A52E, &code_03A53A )`
  - `system/chunk_038000.asm:4272` — `COP [F1] ( #02, &code_03A5BD, &code_03A5CA, &code_03A5D7 )`

### COP [F2] — `cop_f2`

- **Confidence:** low
- **Handler:** `code_00D807` @ chunk_008000.asm:12699-12744
- **Parameters:** u8, u8, u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc, sets_script_pc_$28. Seen 8 times in extracted ASM
- **WRAM touched:** `$02`, `$05F8`, `$06`, `$08`, `$0A`, `$1C`, `$28`, `$2C`
- **Actor RAM:** `$7F000C`, `$7F0022`
- **JSR:** `code_00E398`
- **JSL:** `code_08F34B`, `code_08F3EA`
- **Usage count:** 8
- **Source examples:**
  - `system/chunk_038000.asm:4162` — `COP [F2] ( #0B, #0F, #00 )`
  - `system/chunk_038000.asm:4168` — `COP [F2] ( #11, #0F, #00 )`
  - `system/chunk_038000.asm:4261` — `COP [F2] ( #0B, #0F, #01 )`
  - `system/chunk_038000.asm:4299` — `COP [F2] ( #11, #0F, #01 )`
  - `system/chunk_038000.asm:4363` — `COP [F2] ( #15, #0F, #00 )`

### COP [F3] — `cop_f3`

- **Confidence:** low
- **Handler:** `code_00D861` @ chunk_008000.asm:12746-12786
- **Parameters:** u8, u8, u8, u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc, sets_script_pc_$28. Seen 27 times in extracted ASM
- **WRAM touched:** `$02`, `$06`, `$08`, `$0879`, `$1C`, `$28`, `$2C`
- **Actor RAM:** `$7F000C`, `$7F0022`
- **JSR:** `code_00E398`
- **JSL:** `code_08F34B`, `code_08F3EA`
- **Usage count:** 27
- **Source examples:**
  - `system/chunk_02E9AA.asm:1162` — `COP [F3] ( #00, #09, #0F, #13 )`
  - `system/chunk_02E9AA.asm:1429` — `COP [F3] ( #01, #08, #07, #21 )`
  - `system/chunk_038000.asm:9799` — `COP [F3] ( #01, #09, #03, #0C )`
  - `system/chunk_038000.asm:10098` — `COP [F3] ( #01, #09, #07, #26 )`
  - `system/chunk_038000.asm:10179` — `COP [F3] ( #01, #09, #07, #26 )`

### COP [F4] — `cop_f4`

- **Confidence:** low
- **Handler:** `code_00D8B7` @ chunk_008000.asm:12788-12816
- **Parameters:** u16, u16, u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 81 times in extracted ASM
- **WRAM touched:** `$01`, `$02`, `$06`, `$08`, `$2C`
- **Actor RAM:** `$7F0022`
- **JSL:** `code_08F34B`, `code_08F3EA`
- **Usage count:** 81
- **Source examples:**
  - `system/chunk_02E9AA.asm:113` — `COP [F4] ( #$0020, #$2000, #02 )`
  - `system/chunk_02E9AA.asm:157` — `COP [F4] ( #$0030, #$2000, #01 )`
  - `system/chunk_02E9AA.asm:449` — `COP [F4] ( #$0020, #$0000, #00 )`
  - `system/chunk_02E9AA.asm:459` — `COP [F4] ( #$2020, #$2000, #01 )`
  - `system/chunk_02E9AA.asm:697` — `COP [F4] ( #$0020, #$2050, #01 )`

### COP [F5] — `cop_f5`

- **Confidence:** low
- **Handler:** `code_00D8EF` @ chunk_008000.asm:12818-12911
- **Parameters:** u8, u16, u16, ptr16 code
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 4 times in extracted ASM
- **WRAM touched:** `$0000`, `$0006`, `$0008`, `$02`, `$04`, `$05C8`, `$0A08`, `$0A18`, `$0A2C`, `$0A5C`, `$0EE2`, `$2C`
- **Actor RAM:** `$7F0006`, `$7F0008`, `$7F0022`, `$7F101A`, `$7F101C`
- **JSL:** `code_03C544`, `code_0BF2C1`
- **Usage count:** 4
- **Source examples:**
  - `system/chunk_02E9AA.asm:188` — `COP [F5] ( #FF, #$0000, #$0004, &code_02EB65 )`
  - `system/chunk_02E9AA.asm:490` — `COP [F5] ( #00, #$0031, #$0004, #$0000 )`
  - `system/chunk_038000.asm:9990` — `COP [F5] ( #00, #$0030, #$0002, #$0000 )`
  - `system/chunk_038000.asm:14590` — `COP [F5] ( #00, #$0030, #$0002, #$0000 )`

### COP [F6] — `byte_op`

- **Confidence:** low
- **Handler:** `code_00D9D0` @ chunk_008000.asm:12932-12953
- **Parameters:** u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 4 times in extracted ASM
- **WRAM touched:** `$02`, `$2C`, `$30`
- **Actor RAM:** `$7F000C`
- **JSR:** `code_00D9FC`
- **JSL:** `code_04FC71`, `code_04FCE6`
- **Usage count:** 4
- **Source examples:**
  - `system/chunk_02E9AA.asm:189` — `COP [F6] ( #0A )`
  - `system/chunk_02E9AA.asm:491` — `COP [F6] ( #00 )`
  - `system/chunk_038000.asm:9991` — `COP [F6] ( #87 )`
  - `system/chunk_038000.asm:14591` — `COP [F6] ( #81 )`

### COP [F7] — `no_operand`

- **Confidence:** low
- **Handler:** `code_00DACE` @ chunk_008000.asm:13069-13088
- **Parameters:** (none)
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: sets_return_pc. Seen 6 times in extracted ASM
- **WRAM touched:** `$000E`, `$001C`, `$001E`, `$02`, `$2C`
- **Actor RAM:** `$7F0020`, `$7F1026`, `$7F1028`, `$7F2002`, `$7F200A`, `$7F200E`, `$7F2012`, `$7F2014`, `$7F2016`, `$7F2018`
- **Usage count:** 6
- **Source examples:**
  - `system/chunk_038000.asm:3910` — `COP [F7]`
  - `system/chunk_038000.asm:6421` — `COP [F7]`
  - `system/chunk_038000.asm:6958` — `COP [F7]`
  - `system/chunk_038000.asm:6977` — `COP [F7]`
  - `system/chunk_038000.asm:6997` — `COP [F7]`

### COP [F8] — `cop_f8`

- **Confidence:** low
- **Handler:** `code_00DB08` @ chunk_008000.asm:13090-13103
- **Parameters:** u16, u16
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, reads_operands, sets_return_pc. Seen 4 times in extracted ASM
- **WRAM touched:** `$02`, `$2C`
- **Actor RAM:** `$7F0032`, `$7F0034`
- **Usage count:** 4
- **Source examples:**
  - `system/chunk_02E9AA.asm:144` — `COP [F8] ( #$0000, #$0000 )`
  - `system/chunk_02E9AA.asm:1211` — `COP [F8] ( #$7F00, #$0000 )`
  - `system/chunk_02E9AA.asm:1229` — `COP [F8] ( #$7F00, #$8000 )`
  - `system/chunk_038000.asm:14042` — `COP [F8] ( #$0000, #$0000 )`

### COP [F9] — `cop_f9`

- **Confidence:** low
- **Handler:** `code_00DB22` @ chunk_008000.asm:13105-13154
- **Parameters:** u16, u16
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, may_halt_rtl, reads_operands, sets_return_pc. Seen 8 times in extracted ASM
- **WRAM touched:** `$02`, `$2C`, `$30`, `$32`, `$33`, `$34`, `$35`, `$36`
- **Actor RAM:** `$7F0032`, `$7F0033`, `$7F0034`, `$7F0035`, `$7F0036`
- **JSL:** `code_03CE6D`
- **Usage count:** 8
- **Source examples:**
  - `system/chunk_02E9AA.asm:147` — `COP [F9] ( #$0800, #$0400 )`
  - `system/chunk_02E9AA.asm:152` — `COP [F9] ( #$0000, #$0800 )`
  - `system/chunk_02E9AA.asm:1215` — `COP [F9] ( #$0000, #$0200 )`
  - `system/chunk_02E9AA.asm:1220` — `COP [F9] ( #$0000, #$0100 )`
  - `system/chunk_02E9AA.asm:1233` — `COP [F9] ( #$0000, #$0200 )`

### COP [FA] — `byte_op`

- **Confidence:** low
- **Handler:** `code_00DB86` @ chunk_008000.asm:13156-13191
- **Parameters:** u8
- **Notes:** Heuristic from operand layout + handler memory touches; verify before renaming. Behaviors: advances_script_ptr, may_halt_rtl, reads_operands, sets_script_pc_$28. Seen 25 times in extracted ASM
- **WRAM touched:** `$0006`, `$0E`, `$28`, `$2A`, `$2C`, `$2E`, `$30`, `$32`
- **Actor RAM:** `$7F0022`
- **JSL:** `code_04FD85`
- **Usage count:** 25
- **Source examples:**
  - `system/chunk_038000.asm:6140` — `COP [FA] ( #18 )`
  - `system/chunk_038000.asm:6146` — `COP [FA] ( #17 )`
  - `system/chunk_038000.asm:6152` — `COP [FA] ( #16 )`
  - `system/chunk_038000.asm:6158` — `COP [FA] ( #15 )`
  - `system/chunk_038000.asm:6164` — `COP [FA] ( #14 )`

## How COP is used in source

Canonical `$00`–`$4F` patterns (gosub, flags, dialog, wander, follow, pad, audio, collision, metatiles, etc.) live in the family pages and in [Example sketches](cop/index.md#example-sketches) on the overview.

Typical NPC shape (ops may redirect into family docs):

```asm
actor_XXXXXX [
  actor < #00, #00, #49, #80, #00, {
    COP [74] ( #$1169, #$0087 )      ; init pair ($50+ — still here)
    COP [0B] ( #$818D, &on_talk )    ; branch_if_flag → event_flags
    COP [0C] ( #$1034, #$0087, &alt )
  } >
]

on_talk:
    COP [22] ( &idle_loop )          ; set_interact
    COP [1D] ( &string_XXXX )        ; show_dialog
    COP [0A] ( #$8014 )              ; set_flag
    RTL
```

Animation / step ops (`[51]`/`[52]` walk bracket, `[53]`/`[54]` axis packets, `[55]` seek) are documented under **Opcode reference (`$50+`)** above. Wander `[28]`/`[29]` uses the same `[51]`/`[98]`/`[52]` bracket.

## Top header combinations

| Header | Count |
|--------|-------|
| `actor < #00, #00, #49, #00, #00, {…} >` | 262 |
| `actor < #00, #00, #68, #00, #00, {…} >` | 128 |
| `actor < #00, #00, #69, #00, #01, {…} >` | 83 |
| `actor < #00, #00, #69, #80, #00, {…} >` | 62 |
| `actor < #00, #00, #48, #00, #00, {…} >` | 57 |
| `actor < #00, #00, #42, #20, #00, {…} >` | 46 |
| `actor < #01, #00, #49, #00, #00, {…} >` | 27 |
| `actor < #00, #00, #49, #80, #00, {…} >` | 22 |
| `actor < #00, #00, #60, #00, #00, {…} >` | 17 |
| `actor < #00, #00, #69, #00, #00, {…} >` | 11 |
| `actor < #00, #00, #4A, #00, #00, {…} >` | 11 |
| `actor < #00, #00, #48, #20, #00, {…} >` | 8 |
| `actor < #02, #00, #49, #00, #00, {…} >` | 8 |
| `actor < #00, #00, #42, #24, #00, {…} >` | 8 |
| `actor < #01, #00, #48, #00, #00, {…} >` | 7 |
| `actor < #00, #00, #4C, #00, #00, {…} >` | 6 |
| `actor < #00, #00, #49, #20, #00, {…} >` | 6 |
| `actor < #00, #00, #49, #00, #01, {…} >` | 6 |
| `actor < #03, #00, #49, #00, #00, {…} >` | 6 |
| `actor < #00, #00, #68, #00, #20, {…} >` | 4 |
| `actor < #00, #00, #44, #00, #00, {…} >` | 4 |
| `actor < #00, #00, #48, #00, #20, {…} >` | 4 |
| `actor < #01, #00, #68, #00, #00, {…} >` | 3 |
| `actor < #02, #00, #48, #00, #00, {…} >` | 3 |
| `actor < #00, #00, #6A, #00, #00, {…} >` | 3 |

## Regenerating

```bash
node --experimental-strip-types scripts/analyze_cop_system.ts
```

Artifacts: `docs/cop_actor_analysis.md` (this file; `$50+` workspace), `docs/cop/` (audited `$00`–`$57`), `scripts/cop_analysis.json`.

Do **not** re-run `scripts/split_cop_docs.py` to rebuild family bodies from this file — family pages are now the source of truth for `$00`–`$4F`.
