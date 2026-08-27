
?INCLUDE 'chunk_0B8000'

  loc_0BFCED:
    LDA $7FF800, X
    BEQ loc_0BFD12
    INX 
    INX 
    STA $VMADDL
    LDA $7FF800, X
    INX 
    INX 
    CLC
    ADC #$&rawbitmap_080000
    STA $A1T0L
    LDA #$0010
    STA $DAS0L
    SEP #$20
    LDA #$01
    STA $MDMAEN
    REP #$20
    BRA loc_0BFCED
