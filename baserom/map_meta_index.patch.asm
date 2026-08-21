;This patch allows the game to use lookup tables for meta loading and jumps
;This removes the need for two meta tables, and speeds up loading times

?BANK 4

;?INCLUDE 'chunk_008000'
?INCLUDE 'chunk_048000'
?INCLUDE 'chunk_018000'
?INCLUDE 'map_meta'

;music_load_stub:
;    JSR $&code_0085F6
;    RTL

------------------------------------
;Adjustment for map meta searching

addr_list_048D8B:

code_048D2E {
    REP #$20
    LDA $05A8
    ASL
    TAX
    LDA $@mapMeta_list, X
    TAY
    SEP #$20
    RTS

  loc_048D41:
  loc_048D51:
  loc_048D72:
  loc_048D73:
  loc_048D74:
  loc_048D75:
  loc_048D76:
  loc_048D7B:
}

------------------------------------
;Adjustment for bgm meta entries (FC) to load from the music_list

code_048E00 {
    LDA #$01
    STA $086E
    JSR $&code_048D23
    STA $0870
    INY
    PHY
    REP #$20
    ASL
    CLC
    ADC $0870
    TAX
    LDA $@music_list_01CA3C, X
    STA $42
    SEP #$20
    LDA $@music_list_01CA3C+2, X
    STA $44
    JSR $&loc_048C9C
    PLY
    RTS

  loc_048E13:
  loc_048E26:
  loc_048E35:
  loc_048E54:
  loc_048E55:
  loc_048E56:
  loc_048E57:
  loc_048E58:
  loc_048E5D:
  loc_048E6C:
  loc_048E70:
  loc_048E80:
}

---------------------------------------
;Adjustment for branch meta entries (FD) not needed, routes through below

---------------------------------------
;Adjustment for jump meta entries (FF)

code_048D95 {
    REP #$20
    ASL
    TAX
    LDA $@marker_list, X
    TAY
    SEP #$20
    RTS

  loc_048D9B:
  loc_048DAE:
  loc_048DB8:
  loc_048DD7:
  loc_048DD8:
  loc_048DD9:
  loc_048DDA:
  loc_048DDB:
  loc_048DDC:
  loc_048DE0:
  loc_048DF1:
}
