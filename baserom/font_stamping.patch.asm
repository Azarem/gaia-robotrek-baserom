
?INCLUDE 'chunk_048000'

code_0499CD {
    REP #$20
    PHY 
    AND #$00FF
    ASL 
    ASL 
    ASL 
    ASL 
    CLC
    ADC #$&rawbitmap_080000
    STA $46
    LDA #$*rawbitmap_080000
    STA $48
    SEC 
    LDX $0ED6
    JSR $&code_0498EE
    JSR $&code_049B03
    LDX $0ED6
    LDA $0EAE, X
    CLC 
    ADC #$0002
    STA $0EAE, X
    PLY 
    RTS 
}
