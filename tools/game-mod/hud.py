# JR's round buttons on the chat bar (jrChatBar: "ad" and "JR"), added again
# whenever the game rebuilds its HUD: entering and leaving Adventures, mini
# games and the like. anchors.py adds them once, when the HUD is first made,
# and re-adds only the sit-pose buttons on a rebuild, so after an Adventure
# the game's plain chat bar came back without JR's button. jrChatBar skips a
# bar that already has them. Run from patch.py after anchors.py.
import re as _hud_re
_hud_gm = os.path.join(O, 'gui/GuiManager.as')
_hud_g = open(_hud_gm if os.path.exists(_hud_gm) else os.path.join(B, 'gui/GuiManager.as'), encoding='utf-8').read().replace('\r\n', '\n')
_hud_g, _hud_n = _hud_re.subn(
    r'^([ \t]*)(actionMgr\.reload\([^\n]*\);\n[ \t]*XtReplyDemuxer\.jrPoseButtons\(actionMgr\.actionWindow\.sitBtns\);\n)',
    lambda m: m.group(1) + m.group(2) + m.group(1) + 'XtReplyDemuxer.jrChatBar(mainHud.chatBar,mainHud.chatTxt);\n',
    _hud_g, flags=_hud_re.M)
if _hud_n < 1: sys.exit(f'gui/GuiManager.as: HUD rebuilds not found ({_hud_n})')
os.makedirs(os.path.join(O, 'gui'), exist_ok=True)
open(_hud_gm, 'w', encoding='utf-8').write(_hud_g)
