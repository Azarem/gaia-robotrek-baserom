
?INCLUDE 'chunk_048000'

;Allow the last character slot to be used in a box

code_0498EE:
    BCC loc_0498F7
    LDA #$0002
    STA $00
    BRA loc_0498FC