;This patch contains miscellaneous changes to map/meta loading
;It also contains a fix for string font stamping so the raw bitmap can be moved

?INCLUDE 'chunk_048000'

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
    PLP 
    RTS 

  loc_048EF9:
  loc_048F09:
  loc_048F1E:

}

