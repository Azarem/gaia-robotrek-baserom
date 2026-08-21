;This patch file adjusts various music loading processes, making them faster
;MSU support will be added eventually

?BANK 04

?INCLUDE 'chunk_048000'

!msu_flag                       07FA
!APUIO0                         2140

---------------------------------------

bgm_table [
  #00 #0D #0D #15 #03 #03 #03 #03 #03 #03 #02 #02 #03 #02 #02 #02  ;0F
  #06 #06 #06 #06 #FF #03 #03 #03 #03 #04 #04 #06 #04 #07 #07 #07  ;1F
  #07 #07 #07 #07 #07 #07 #07 #07 #07 #07 #11 #04 #04 #04 #04 #15  ;2F
  #1B #1B #02 #02 #02 #02 #02 #02 #02 #02 #02 #02 #04 #06 #06 #06  ;3F
  #06 #06 #06 #06 #06 #06 #06 #04 #FF #03 #FF #04 #08 #08 #08 #08  ;4F
  #08 #08 #08 #08 #08 #08 #08 #FF #FF #FF #04 #04 #04 #04 #04 #09  ;5F
  #09 #09 #09 #04 #09 #09 #04 #04 #04 #03 #03 #03 #03 #06 #06 #06  ;6F
  #06 #06 #06 #1D #04 #04 #FF #FF #02 #02 #02 #06 #02 #02 #02 #15  ;7F
  #FF #FF #0A #0A #FF #0A #0A #0A #0A #FF #0A #0A #14 #FF #FF #FF  ;8F
  #FF #02 #02 #02 #02 #05 #05 #02 #02 #02 #02 #02 #02 #04 #FF #FF  ;9F
  #06 #06 #06 #06 #06 #06 #06 #06 #06 #06 $FF #FF #04 #FF #FF #FF  ;AF
  #04 #0B #0B #0B #0B #0B #0B #0B #0B #0B #0B #0B #0B #0B #0B #04  ;BF
  #11 #FF #FF #02 #02 #04 #02 #02 #02 #02 #FF #FF #04 #04 #0C #0C  ;CF
  #0C #0C #0C #0C #0C #0C #0C #0C #0C #0C #0C #0C #02 #0F #04 #04  ;DF
  #04 #04 #04 #04 #0E #0E #16 #FF #FF #06 #FF #FF #FF #FF #FF #FF  ;EF
  #1B #FF #0F #0F #0F #0F #0F #1B #FF #13 #12 #1B #14 #1B #12 #FF  ;FF
]

bgm_track_map [
  #00 #01 #02 #03 #04 #05 #06 #07 #08 #09 #0A #0B #0C #0D #0E #0F
  #10 #11 #12 #13 #14 #15 #16 #17 #18 #19 #1A #1B #1C #1D #1E #1F
]

bgm_loop_map [
  #00 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01
  #01 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01 #01
]

---------------------------------------
;SPC init, check for MSU support

code_049104 {
    REP #$20

    LDA $2002
    CMP #$2D53
    BNE msu_unavailable
    LDA $2004
    CMP #$534D
    BNE msu_unavailable
    LDA $2006
    CMP #$3155
    BNE msu_unavailable

    SEP #$20
    LDA #01
    STA $msu_flag
    BRA init_complete

  msu_unavailable:
    SEP #$20
    STZ $msu_flag
    
  init_complete:
    LDX #$&spc_04A587
    STX $4E
    LDA #$^spc_04A587
    STA $50
    JSR $&code_049212
    RTL 
}

---------------------------------------
;Various music fixes for loading via map meta

  loc_048CA6:
    LDA $086E
    BNE bgm_check
    LDA #$FF
    STA $0870                   ;Force request of NULL when reset is loading
    STA $0874
    BRA bgm_halt               ;Always branch to halt when reset is loading

  bgm_check:
    LDA $0870
    CMP $0874
    BNE msu_check
    RTS                         ;Check against current track, if no change then quit

  msu_check:
    STA $0874
    LDA $msu_flag
    BNE msu_begin_load
    BRA bgm_halt

    ;LDA #$F2
    ;STA $APUIO0

  bgm_halt:
    LDA #$01
    JSL $@code_0480F2
    
  loc_048CB6:
    LDA #$F0
    STA $APUIO0

  loc_048CBB:
    ;LDA $APUIO0
    ;BNE loc_048CBB
    LDA #$02
    JSL $@code_0480F2
    LDA #$FF
    STA $APUIO0
    LDA #$02
    JSL $@code_0480F2
    
  bgm_init:
    LDA $0874
    BEQ bgm_load_empty

    LDX $42
    STX $4E
    LDX $44
    STX $50

  bgm_load:
    JSL $@code_049111
    ;LDA #$01
    ;STA $0874
    LDA #$03
    JSL $@code_0480F2
    LDA $086E
    STA $APUIO0
    CLC 
    RTS 
    
  bgm_load_empty:
    LDX #&bgm_no_music
    STX $4E
    LDX #*bgm_no_music
    STX $50
    ;LDA #$00
    ;STA $0874
    BRA bgm_load

  msu_begin_load:
    LDX $0870
    BNE msu_begin_continue      ;If 00 is not requested, continue

    STZ $2007                   ;Stop playback when 00 is requested

    LDA $0874
    BNE msu_begin_halt
    RTS                         ;Exit if 00 is already playing

  msu_begin_halt:
    STZ $0874
    BRA bgm_halt                ;Set loading track to 00 and begin halt

  msu_begin_continue:
    LDA @bgm_track_map, X
    STZ $2006
    STA $2004
    STZ $2005

  msu_busy_wait:
    BIT $2000 
    BVS msu_busy_wait           ;Wait for data busy to clear

    LDA $2000
    AND #08
    BEQ msu_start_playback
    LDA $0870
    STA $0874
    JMP bgm_halt                ;Track not found, revert to normal process

  msu_start_playback:

    LDA @bgm_loop_map, X
    BEQ msu_start
    LDA #$03
    BRA msu_write

  msu_start:
    LDA #01

  msu_write:
    STA $2007                   ;Start playback
    LDA #FF                     ;Max volume
    STA $2006
    LDA $0874
    BEQ msu_return

    STZ $0874
    JMP bgm_halt

  msu_return:
    RTS