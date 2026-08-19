;This patch file allows map assets to be loaded uncompressed
;Uncompressed files use a negative size header to avoid altering the meta tables

!VMADDL                         2116
!DMAP0                          4300
!BBAD0                          4301
!A1T0L                          4302
!A1B0                           4304
!DAS0L                          4305
!MDMAEN                         420B

?INCLUDE 'chunk_048000'
?INCLUDE 'chunk_088000'

------------------------------------
;Fix decompression for bitmaps

loc_048660 {
    LDA $0804
    CMP #$00FF
    BEQ loc_0486B6
    ASL $0800
    BCS loc_048680
    LDA [$42]
    BPL bitmap_decompress_normal1

    ;LDA #$0000
    ;SEC
    ;SBC [$42] ;Size is already calculated. Do we need it?
    INC $42
    INC $42
    BRA loc_048680

  bitmap_decompress_normal1:
    LDX #$5000
    STX $99
    JSL $@code_04843D
    LDX #$5000
    STX $42
    LDA #$007E
    STA $44
}

loc_0486B6 {
    ASL $0800
    BCS loc_0486CE
    LDA [$42]
    BPL bitmap_decompress_normal2

    ;LDA #$0000
    ;SEC
    ;SBC [$42] ;Size is already calculated. Do we need it?
    INC $42
    INC $42
    BRA loc_0486CE
    
  bitmap_decompress_normal2:
    LDX #$5000
    STX $99
    JSL $@code_04843D
    LDX #$5000
    STX $42
    LDA #$007E
    STA $44
}

---------------------------------------
;Fix decompression for tilesets

loc_048797 {
    LDA $0806
    BEQ loc_048809
    LDA $01, S
    BMI loc_0487A9
    LDA [$42]
    BPL tileset_decompress_normal

    ;LDA #$0000
    ;SEC
    ;SBC [$42] ;Size is already calculated. Do we need it?
    INC $42
    INC $42
    BRA loc_0487A9

  tileset_decompress_normal:
    LDX #$5000
    STX $99
    JSL $@code_04843D
    LDX #$5000
    STX $42
    LDA #$007E
    STA $44
}

loc_0487A9 {
    LSR $0806
    BCC loc_0487CB
    ;LDX #$5000
    ;STX $42
    ;LDA #$007E
    ;STA $44
    LDX #$2000
    STX $46
    LDA #$007E
    STA $48
    JSR $&code_048F5A
    LDX #$0000
    JSR $&code_048F88
}

loc_0487CB {
    LSR $0806
    BCC loc_0487ED
    ;LDX #$5000
    ;STX $42
    ;LDA #$007E
    ;STA $44
    LDX #$2800
    STX $46
    LDA #$007E
    STA $48
    JSR $&code_048F5A
    LDX #$0002
    JSR $&code_048F88
}

loc_0487ED {
    LSR $0806
    BCC loc_048809
    ;LDX #$5000
    ;STX $42
    ;LDA #$007E
    ;STA $44
    LDX #$3000
    STX $46
    LDA #$007E
    STA $48
    JSR $&code_048F5A
}

------------------------------------------
;Fix decompression for tilemaps


loc_048895 {
    REP #$20
    LDA [$42]
    BPL tilemap_size_normal
    LDA #$0000
    SEC
    SBC [$42]

  tilemap_size_normal:
    STA $0802
    SEP #$20
    LDA $0806
    BIT #$01
    BEQ loc_0488CF
    LDX #$0000
    JSR $&code_0488D6
    LDA $0806
    BIT #$02
    BEQ loc_0488D5
    LDX #$A000
    STX $42
    LDA #$7E
    STA $44
    LDX #$D000
    STX $46
    LDA #$7E
    STA $48
    JSR $&code_048F5A
    LDX #$0002
    JSR $&code_0490F1
    BRA loc_0488D5
}

code_0488D6 {
    JSR $&code_0490F1
    REP #$20
    LDA [$42]
    BPL tilemap_decompress_normal

    ;LDA #$0000
    ;SEC
    ;SBC [$42] ;Size is already calculated. Do we need it?
    INC $42
    INC $42
    
    LDA $082E, X
    STA $46
    LDA #$007E
    STA $48
    STZ $0804
    JSR $&code_048F5A
    SEP #$20
    RTS 

  tilemap_decompress_normal:
    LDA $082E, X
    STA $99
    JSL $@code_04843D
    SEP #$20
    RTS 
}

code_04894B {
    LDA $0806
    BPL loc_04895C

  tilemap_decompress_direct:
    LDX $42
    STX $A1T0L
    LDA $44
    STA $A1B0
    BRA loc_048970

  loc_04895C:
    LDA [$42]
    BPL tilemap_decompress_normal2

    ;LDA #$0000
    ;SEC
    ;SBC [$42] ;Size is already calculated. Do we need it?
    INC $42
    INC $42
    BRA tilemap_decompress_direct
    
  tilemap_decompress_normal2:
    LDX #$A000
    STX $99
    JSL $@code_04843D
    LDX #$A000
    STX $A1T0L
    LDA #$7E
    STA $A1B0
}

loc_04899B {
    REP #$20
    LDA [$42]
    BPL tilemap_size_normal2
    LDA #$0000
    SEC
    SBC [$42]

  tilemap_size_normal2:
    STA $0802
    SEP #$20
    LDA $0806
    BIT #$01
    BEQ loc_0489D2
    INC $0558
    LDX #$F000
    JSR $&code_0489DA
    LDA $0806
    BIT #$02
    BEQ loc_048A34
    LDX #$F000
    STX $42
    LDA #$7E
    STA $44
    LDX #$F800
    STX $46
    LDA #$7E
    STA $48
    JSR $&code_048F5A
    BRA loc_048A34
}

code_0489DA {
    REP #$20
    LDA [$42]
    BPL tilemap_decompress_normal3

    ;LDA #$0000
    ;SEC
    ;SBC [$42] ;Size is already calculated. Do we need it?
    INC $42
    INC $42
    
    STX $46
    LDA #$007E
    STA $48
    JSR $&code_048F5A
    SEP #$20
    RTS 

  tilemap_decompress_normal3:
    STX $99
    JSL $@code_04843D
    SEP #$20
    RTS 
}

-------------------------------------
;Fix decompression for strangemaps


loc_048D09 {
    LDX #$7000
    LDA [$42]
    BPL strangemap_decompress_normal
    
  strangemap_decompress_next:
    ;LDA #$0000
    ;SEC
    ;SBC [$42] ;Size is already calculated. Do we need it?
    INC $42
    INC $42

    STX $46
    LDA #$007E
    STA $48
    JSR $&code_048F5A
    RTS

  strangemap_decompress_normal:
    STX $99
    JSL $@code_04843D
    RTS 
}

loc_048D13 {
    LDX #$0042
    JSR $&code_048EBE
    LDX #$4800
    LDA [$42]
    BPL strangemap_decompress_normal
    BRA strangemap_decompress_next
}

-------------------------------------------------
;Fix decompression for battle sprites

code_08E8F1 {
    PHP 
    PHX 
    LDX #$&bitmap_1071A9
    STX $42
    LDA #$*bitmap_1071A9
    STA $44

    LDA [$42]
    BPL decompress_battle_normal
    
    ;LDA #$0000
    ;SEC
    ;SBC [$42] ;Size is already calculated. Do we need it?
    INC $42
    INC $42

    SEP #$20
    LDX $42
    LDA $44
    BRA decompress_battle_next

  decompress_battle_normal:
    SEP #$20
    LDX #$5000
    STX $99
    JSL $@code_04843D
    LDA #$7E

  decompress_battle_next:
    STX $A1T0L
    STA $A1B0
    LDA #$18
    STA $BBAD0
    LDA #$01
    STA $DMAP0
    LDX #$4000
    STX $VMADDL
    ;LDX #$5000
    ;STX $A1T0L
    ;LDA #$7E
    ;STA $A1B0
    LDX #$2000
    STX $DAS0L
    LDA #$01
    STA $MDMAEN

  decompress_battle_second:
    LDX #$4200
    STX $VMADDL
    LDX #$&rawbitmap_178000+400
    STX $A1T0L
    LDA #$^rawbitmap_178000
    STA $A1B0
    LDX #$0400
    STX $DAS0L
    LDA #$01
    STA $MDMAEN
    JSL $@code_08F448
    PLX 
    PLP 
    RTL 
}

code_08E950 {
    PHP 
    PHX 
    PHY 
    REP #$20
    LDX #$&bitmap_178800
    STX $42
    LDA #$*bitmap_178800
    STA $44
    
    LDA [$42]
    BPL decompress_battle_normal2
    
    ;LDA #$0000
    ;SEC
    ;SBC [$42] ;Size is already calculated. Do we need it?
    INC $42
    INC $42

    SEP #$20
    LDA $44
    STA $0527
    LDA #$7F
    STA $0526
    REP #$20
    LDX $42
    LDY #$D000
    LDA #$27FF
    JSR $0524
    BRA decompress_battle_next2

  decompress_battle_normal2:
    LDX #$A000
    STX $99
    JSL $@code_04843D
    PHB 
    LDX #$A000
    LDY #$D000
    LDA #$27FF
    MVN #$7F, #$7E
    PLB 

  decompress_battle_next2:
    JSL $@code_08F448
    PLY 
    PLX 
    PLP 
    RTL 
}

-----------------------------------------------
;Fix remaining decompression

code_04843D {
    PHP 
    PHB 
    PHX 
    PHY 
    REP #$20
    LDA [$42]
    BPL misc_decompression_normal
    
    LDA #$0000
    SEC
    SBC [$42] ;Size is already calculated. Do we need it?
    STA $95
    INC $42
    INC $42

    SEP #$20
    LDA $44
    STA $0527
    LDA #$7E
    STA $0526
    REP #$20
    LDX $42
    LDY $99
    LDA $95
    DEC
    JSR $0524
    BRA loc_0484B3

  misc_decompression_normal:
    INC $42
    INC $42
    STA $95
    CLC 
    ADC $99
    STA $97
    SEP #$20
    LDA #$7E
    PHA 
    PLB 
    LDX #$0300
    STX $91
    STX $93
    LDA #$20
}