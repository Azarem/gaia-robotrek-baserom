;This patch adds the GaiaLabs logo to the boot sequence

-------------------------------------
?INCLUDE 'map_meta'
-------------------------------------

mapMeta_01C1 [
  state < #00, #12 >   ;00
  bitmap < #00, #10, #20, !bitmap_087631 >   ;01
  bitmap < #80, #10, #30, !gfx_boot_exprite >   ;01
  palette < #00, #50, #80, !palette_171DE1 >   ;02
]

-------------------------------------
?INCLUDE 'actor_04B187'
-------------------------------------

actor_04B187 [
  actor < #00, #00, #40, #00, #00, {
    LDA $09C0
    BNE boot_logo_enix
    COP [C8] ( @spm_boot_logos, #01 )
    COP [CB]
    COP [D0] ( #$0060 )
    INC $09C0
    COP [18] ( #$01C1, #00, #00, #00, #00 )
    COP [CB]
    RTL
    
  boot_logo_enix:
    COP [B7] ( #$FFF8 )
    STZ $09C0
    ;SEP #$20
    ;LDA $STAT78
    ;BIT #$10
    ;REP #$20
    ;BNE loc_04B1C8                     ;Remove region protection

    COP [AA] ( @code_04B25F )
    COP [AA] ( @code_04B280 )
    COP [CB]
    ;LDA $09C0
    ;BNE loc_04B1B0
    ;RTL 
  
  loc_04B1B0:
    COP [84] ( #00, #02 )
    COP [98]
    LDA $0674
    JSL $@code_0AFC5D
    COP [18] ( #$0004, #00, #00, #00, #00 )
    COP [CB]
    RTL 
  
  loc_04B1C8:
  } 
]

consolestring_04B1E7:
