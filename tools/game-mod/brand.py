# JRR fork: the game's JR button and window titles say JRR (brand-update).
edit('XtReplyDemuxer.as', [
    ('            _loc15_ = new JRRound("menu","","JR",_loc5_,jrChatPick);\n',
     '            _loc15_ = new JRRound("menu","","JRR",_loc5_,jrChatPick);\n'),
    ('         _loc3_ = JRStyle.field(String(param1.title || "JR").toUpperCase(),16,JRStyle.WOOD_DARK,true);\n',
     '         _loc3_ = JRStyle.field(String(param1.title || "JRR").toUpperCase(),16,JRStyle.WOOD_DARK,true);\n'),
])
