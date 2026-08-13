
!VMADDL                         2116
!MDMAEN                         420B
!A1T0L                          4302
!DAS0L                          4305

?INCLUDE 'chunk_048000'
?INCLUDE 'chunk_0B8000'

----------------------------
;Fix OddLocation calculation so that it works with any bank hi/lo

code_048EBE {
    PHP 
    REP #$20
    LDA [$3C], Y
    INY 
    INY 
    STA $0000, X
    LDA [$3C], Y
    INY 
    STA $0002, X
;    LDA $0001, X
;    AND #$007F
;    PHA 
;    EOR $0001, X
;    ASL 
;    ORA #$0080
;    ORA $01, S
;    STA $0001, X
;    PLA 
;    SEP #$20
;    LDA $40
;    CMP #$03
;    BEQ loc_048F09
;    LDA $0002, X
;    CLC 
;    ADC #$8D
;    CMP #$98
;    BCS loc_048EF9
;    STA $0002, X
    PLP 
    RTS 

  loc_048EF9:
;    CLC 
;    ADC #$28
;    STA $0002, X
;    LDA $0001, X
;    AND #$7F
;    STA $0001, X
;    PLP 
;    RTS 

  loc_048F09:
;    LDA $0002, X
;    CLC
;    ADC #$84
;    CMP #$98
;    BCS loc_048EF9
;    STA $0002, X
;    PLP 
;    RTS 

  loc_048F1E:
;    LDA $0002, X
;    CLC 
;    ADC #$C4
;    STA $0002, X
;    LDA $0001, X
;    AND #$7F
;    STA $0001, X
;    PLP 
;    RTS 

}

------------------------------
;Fix font stamping so it works with any offset

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
