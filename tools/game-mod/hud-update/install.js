'use strict'
/*
 * Keeps JR's button on the chat bar after Adventures (and mini games): the
 * game rebuilds its HUD there, and JR now adds its round buttons again.
 *   node "<JR folder>\tools\game-mod\hud-update\install.js"   (from any folder)
 * Only the chat bar part of edits.json changes. Running it again changes nothing.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const here = __dirname
const mod = path.join(here, '..')
const root = path.join(here, '..', '..', '..')
const editsFile = path.join(root, 'src', 'game', 'mod', 'edits.json')
const patchFile = path.join(mod, 'patch.py')
const REL = 'gui/GuiManager.as'
const LINE = "exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hud.py'), encoding='utf-8').read())\n"
const OLD_STEPS = [
 {
  "find": "      {\n         chatHist = new ChatHistory(mainHud.chatHist,mainHud.chatBar,mainHud.chatHistUpDownBtn,mainHud.buddyListBtn,mainHud.chatTxt,mainHud.sendChatBtn,UserCommXtCommManager.onSendMessage,mainHud.predictTxtTag,mainHud.specialCharCont,mainHud.chatRepeatBtn,mainHud.chatRepeatWindow);\n         SafeChatManager.init(UserCommXtCommManager.sendAvatarSafeChat,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n         emoteMgr = new EmoticonManager(0,onEmoteClick,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,gMainFrame.userInfo.firstFiveMinutes > 0);\n         actionMgr = new ActionManager(UserCommXtCommManager.sendAvatarAction,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow);\n         mainHud.furnBtn.visible = false;\n         mainHud.mySettingsBtn.glow.visible = false;\n",
  "replace": "      {\n         chatHist = new ChatHistory(mainHud.chatHist,mainHud.chatBar,mainHud.chatHistUpDownBtn,mainHud.buddyListBtn,mainHud.chatTxt,mainHud.sendChatBtn,UserCommXtCommManager.onSendMessage,mainHud.predictTxtTag,mainHud.specialCharCont,mainHud.chatRepeatBtn,mainHud.chatRepeatWindow);\n         XtReplyDemuxer.jrChatBar(mainHud.chatBar,mainHud.chatTxt);\n         SafeChatManager.init(UserCommXtCommManager.sendAvatarSafeChat,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n         emoteMgr = new EmoticonManager(0,onEmoteClick,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,gMainFrame.userInfo.firstFiveMinutes > 0);\n         actionMgr = new ActionManager(UserCommXtCommManager.sendAvatarAction,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow);\n         XtReplyDemuxer.jrPoseButtons(actionMgr.actionWindow.sitBtns);\n         XtReplyDemuxer.jrSmooth();\n         mainHud.furnBtn.visible = false;\n         mainHud.mySettingsBtn.glow.visible = false;\n",
  "count": 1
 },
 {
  "find": "                  SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n                  actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n                  emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n                  setToolTipText();\n",
  "replace": "                  SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n                  actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n                  XtReplyDemuxer.jrPoseButtons(actionMgr.actionWindow.sitBtns);\n                  XtReplyDemuxer.jrSmooth();\n                  emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n                  setToolTipText();\n",
  "count": 1
 },
 {
  "find": "                  SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n                  actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,MinigameManager.sendActionMsg);\n                  emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,MinigameManager.sendEmoteMsg,gMainFrame.userInfo.firstFiveMinutes > 0);\n                  setToolTipText();\n",
  "replace": "                  SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n                  actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,MinigameManager.sendActionMsg);\n                  XtReplyDemuxer.jrPoseButtons(actionMgr.actionWindow.sitBtns);\n                  XtReplyDemuxer.jrSmooth();\n                  emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,MinigameManager.sendEmoteMsg,gMainFrame.userInfo.firstFiveMinutes > 0);\n                  setToolTipText();\n",
  "count": 1
 },
 {
  "find": "               SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n               actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n               emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n               volumeMgr.enable(true,mainHud.worldMapBtn,mainHud.zoneName,mainHud.worldHelp);\n",
  "replace": "               SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n               actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n               XtReplyDemuxer.jrPoseButtons(actionMgr.actionWindow.sitBtns);\n               XtReplyDemuxer.jrSmooth();\n               emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n               volumeMgr.enable(true,mainHud.worldMapBtn,mainHud.zoneName,mainHud.worldHelp);\n",
  "count": 1
 },
 {
  "find": "            SafeChatManager.reload(true,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n            actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n            emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n            if(mainHud.worldMapBtn)\n",
  "replace": "            SafeChatManager.reload(true,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n            actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n            XtReplyDemuxer.jrPoseButtons(actionMgr.actionWindow.sitBtns);\n            XtReplyDemuxer.jrSmooth();\n            emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n            if(mainHud.worldMapBtn)\n",
  "count": 1
 }
]
const NEW_STEPS = [
 {
  "find": "      {\n         chatHist = new ChatHistory(mainHud.chatHist,mainHud.chatBar,mainHud.chatHistUpDownBtn,mainHud.buddyListBtn,mainHud.chatTxt,mainHud.sendChatBtn,UserCommXtCommManager.onSendMessage,mainHud.predictTxtTag,mainHud.specialCharCont,mainHud.chatRepeatBtn,mainHud.chatRepeatWindow);\n         SafeChatManager.init(UserCommXtCommManager.sendAvatarSafeChat,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n         emoteMgr = new EmoticonManager(0,onEmoteClick,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,gMainFrame.userInfo.firstFiveMinutes > 0);\n         actionMgr = new ActionManager(UserCommXtCommManager.sendAvatarAction,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow);\n         mainHud.furnBtn.visible = false;\n         mainHud.mySettingsBtn.glow.visible = false;\n",
  "replace": "      {\n         chatHist = new ChatHistory(mainHud.chatHist,mainHud.chatBar,mainHud.chatHistUpDownBtn,mainHud.buddyListBtn,mainHud.chatTxt,mainHud.sendChatBtn,UserCommXtCommManager.onSendMessage,mainHud.predictTxtTag,mainHud.specialCharCont,mainHud.chatRepeatBtn,mainHud.chatRepeatWindow);\n         XtReplyDemuxer.jrChatBar(mainHud.chatBar,mainHud.chatTxt);\n         SafeChatManager.init(UserCommXtCommManager.sendAvatarSafeChat,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n         emoteMgr = new EmoticonManager(0,onEmoteClick,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,gMainFrame.userInfo.firstFiveMinutes > 0);\n         actionMgr = new ActionManager(UserCommXtCommManager.sendAvatarAction,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow);\n         XtReplyDemuxer.jrPoseButtons(actionMgr.actionWindow.sitBtns);\n         XtReplyDemuxer.jrSmooth();\n         mainHud.furnBtn.visible = false;\n         mainHud.mySettingsBtn.glow.visible = false;\n",
  "count": 1
 },
 {
  "find": "                  SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n                  actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n                  emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n                  setToolTipText();\n",
  "replace": "                  SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n                  actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n                  XtReplyDemuxer.jrPoseButtons(actionMgr.actionWindow.sitBtns);\n                  XtReplyDemuxer.jrChatBar(mainHud.chatBar,mainHud.chatTxt);\n                  XtReplyDemuxer.jrSmooth();\n                  emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n                  setToolTipText();\n",
  "count": 1
 },
 {
  "find": "                  SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n                  actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,MinigameManager.sendActionMsg);\n                  emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,MinigameManager.sendEmoteMsg,gMainFrame.userInfo.firstFiveMinutes > 0);\n                  setToolTipText();\n",
  "replace": "                  SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n                  actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,MinigameManager.sendActionMsg);\n                  XtReplyDemuxer.jrPoseButtons(actionMgr.actionWindow.sitBtns);\n                  XtReplyDemuxer.jrChatBar(mainHud.chatBar,mainHud.chatTxt);\n                  XtReplyDemuxer.jrSmooth();\n                  emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,MinigameManager.sendEmoteMsg,gMainFrame.userInfo.firstFiveMinutes > 0);\n                  setToolTipText();\n",
  "count": 1
 },
 {
  "find": "               SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n               actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n               emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n               volumeMgr.enable(true,mainHud.worldMapBtn,mainHud.zoneName,mainHud.worldHelp);\n",
  "replace": "               SafeChatManager.reload(false,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n               actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n               XtReplyDemuxer.jrPoseButtons(actionMgr.actionWindow.sitBtns);\n               XtReplyDemuxer.jrChatBar(mainHud.chatBar,mainHud.chatTxt);\n               XtReplyDemuxer.jrSmooth();\n               emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n               volumeMgr.enable(true,mainHud.worldMapBtn,mainHud.zoneName,mainHud.worldHelp);\n",
  "count": 1
 },
 {
  "find": "            SafeChatManager.reload(true,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n            actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n            emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n            if(mainHud.worldMapBtn)\n",
  "replace": "            SafeChatManager.reload(true,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,mainHud.actionsBtn,mainHud.actionWindow,mainHud.emotesBtn,mainHud.emotesWindow);\n            actionMgr.reload(mainHud.actionsBtn,mainHud.actionsWindow,mainHud.emotesBtn,mainHud.emotesWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,UserCommXtCommManager.sendAvatarAction);\n            XtReplyDemuxer.jrPoseButtons(actionMgr.actionWindow.sitBtns);\n            XtReplyDemuxer.jrChatBar(mainHud.chatBar,mainHud.chatTxt);\n            XtReplyDemuxer.jrSmooth();\n            emoteMgr.reload(mainHud.emotesBtn,mainHud.emotesWindow,mainHud.actionsBtn,mainHud.actionsWindow,mainHud.safeChatBtn,mainHud.safeChatTreeWindow,onEmoteClick,gMainFrame.userInfo.firstFiveMinutes > 0);\n            if(mainHud.worldMapBtn)\n",
  "count": 1
 }
]
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function setSteps (E, steps) {
  const old = E.id
  E.files[REL] = steps
  const { id, ...body } = E
  const ordered = { ffdec: body.ffdec, classes: body.classes, files: body.files }
  const newId = crypto.createHash('sha1').update(JSON.stringify(ordered, null, 1)).digest('hex').slice(0, 10)
  fs.writeFileSync(editsFile, JSON.stringify({ ...ordered, id: newId }, null, 1) + '\n')
  return `${old} -> ${newId}`
}
console.log('JR folder: ' + root)
const E = JSON.parse(fs.readFileSync(editsFile, 'utf8'))
if (!E.files || !E.files[REL]) throw new Error(`${REL} is missing from edits.json: is this the JR folder?`)

if (same(E.files[REL], NEW_STEPS)) console.log('  Already installed (' + E.id + ').')
else if (same(E.files[REL], OLD_STEPS)) console.log('  edits.json updated (' + setSteps(E, NEW_STEPS) + ')')
else throw new Error(`${REL} in edits.json has changes this update doesn't know. Nothing was changed.`)
fs.copyFileSync(path.join(here, 'hud.py'), path.join(mod, 'hud.py'))
if (fs.existsSync(patchFile)) {
  let py = fs.readFileSync(patchFile, 'utf8')
  if (!py.includes(LINE)) {
    const at = py.lastIndexOf("print('ok')")
    py = at >= 0 ? py.slice(0, at) + LINE + py.slice(at) : py + (py.endsWith('\n') ? '' : '\n') + LINE
    fs.writeFileSync(patchFile, py)
  }
  console.log('  patch.py runs hud.py')
}
console.log('Done. Start JR, press Play, log in, and leave JR open until the log says the in-game features are ready.')
