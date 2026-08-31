;FIX BCD display functions so they work with HEX

?INCLUDE 'chunk_048000'
-----------------------------------

  loc_04A06C:
    LDA $0000, Y
    AND #$0F
    CLC 
    ADC #$30
    CMP #$3A
    BCC loc_04A07A
    CLC
    ADC #$07
    CMP #$47
    BCC loc_04A07A
    LDA #$2D

  loc_04A094:
    DEC $0C
    BEQ loc_04A0C9
    LDA $0000, Y
    INY 
    AND #$F0
    LSR 
    LSR 
    LSR 
    LSR 
    CLC 
    ADC #$30
    CMP #$3A
    BCC loc_04A0AB
    CLC
    ADC #$07
    CMP #$47
    BCC loc_04A0AB
    LDA #$2D

