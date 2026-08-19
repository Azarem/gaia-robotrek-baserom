
?INCLUDE 'chunk_048000'

!APUIO0                         2140

---------------------------------------

  loc_048CA6:
    LDA $0874
    BEQ loc_048CB6
    ;LDA #$F2
    ;STA $APUIO0
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
    LDX $42
    STX $4E
    LDX $44
    STX $50
    JSL $@code_049111
    LDA #$01
    STA $0874
    LDA #$03
    JSL $@code_0480F2
    LDA $086E
    STA $APUIO0
    CLC 
    RTS 