# Adventures automation gear (advgear-update): a round gear button at the top right of the screen
# while you're in an adventure room; JR opens its automation window from it (anchor "questgear").
edit('quest/QuestXtCommManager.as', [
    ('      public static function roomJoined(param1:String) : void\n      {\n         QuestManager.questRoomJoined(param1.indexOf("quest_") == 0);\n      }\n',
     '      public static function roomJoined(param1:String) : void\n      {\n         QuestManager.questRoomJoined(param1.indexOf("quest_") == 0);\n         XtReplyDemuxer.jrQuestGear(param1);\n      }\n'),
])
edit('XtReplyDemuxer.as', [
    ('   import shop.ShopManager;\n   import room.RoomManagerWorld;\n',
     '   import shop.ShopManager;\n   import room.RoomManagerWorld;\n   import gui.GuiManager;\n'),
    ('      // Shop Explorer\'s Open button (plugins/shop-explorer): opens one My Shop stand in the den\n',
     '      // Adventures: JR\'s gear button at the top right while you\'re in an adventure room\n'
     '      // (quest_... rooms, and seasonal sin<number>_... lobbies). Leaving takes it away.\n'
     '      public static function jrQuestGear(param1:String) : void\n'
     '      {\n'
     '         var _loc2_:DisplayObjectContainer = null;\n'
     '         var _loc3_:DisplayObject = null;\n'
     '         var _loc4_:String = param1 != null ? param1 : "";\n'
     '         try\n'
     '         {\n'
     '            _loc2_ = GuiManager.mainHud as DisplayObjectContainer;\n'
     '            if(_loc2_ == null)\n'
     '            {\n'
     '               return;\n'
     '            }\n'
     '            if(_loc4_.indexOf("quest_") == 0 || _loc4_.indexOf("sin") == 0 && !isNaN(Number(_loc4_.charAt(3))))\n'
     '            {\n'
     '               jrAnchor("questgear",_loc2_,GuiManager.mainHud.mySettingsBtn);\n'
     '            }\n'
     '            else\n'
     '            {\n'
     '               _loc3_ = _loc2_.getChildByName("jrBar_questgear");\n'
     '               if(_loc3_ != null)\n'
     '               {\n'
     '                  _loc2_.removeChild(_loc3_);\n'
     '               }\n'
     '               delete _jrPending["questgear"];\n'
     '            }\n'
     '         }\n'
     '         catch(e:Error)\n'
     '         {\n'
     '         }\n'
     '      }\n'
     '      \n'
     '      // Shop Explorer\'s Open button (plugins/shop-explorer): opens one My Shop stand in the den\n'),
    ('      if(param2 == "palette" || param2 == "palette2")\n      {\n         // a grid of color squares',
     '      if(param2 == "gear")\n'
     '      {\n'
     '         // a cog: eight teeth round a ring with a hole, like the game\'s settings gear\n'
     '         param1.lineStyle(0,0,0);\n'
     '         param1.beginFill(0xFFFFFF,1);\n'
     '         _loc7_ = 0;\n'
     '         while(_loc7_ < 8)\n'
     '         {\n'
     '            _loc8_ = _loc7_ * Math.PI / 4;\n'
     '            param1.moveTo(param3 + Math.cos(_loc8_) * _loc6_ * 0.5 - Math.sin(_loc8_) * _loc6_ * 0.2,param4 + Math.sin(_loc8_) * _loc6_ * 0.5 + Math.cos(_loc8_) * _loc6_ * 0.2);\n'
     '            param1.lineTo(param3 + Math.cos(_loc8_) * _loc6_ * 0.95 - Math.sin(_loc8_) * _loc6_ * 0.2,param4 + Math.sin(_loc8_) * _loc6_ * 0.95 + Math.cos(_loc8_) * _loc6_ * 0.2);\n'
     '            param1.lineTo(param3 + Math.cos(_loc8_) * _loc6_ * 0.95 + Math.sin(_loc8_) * _loc6_ * 0.2,param4 + Math.sin(_loc8_) * _loc6_ * 0.95 - Math.cos(_loc8_) * _loc6_ * 0.2);\n'
     '            param1.lineTo(param3 + Math.cos(_loc8_) * _loc6_ * 0.5 + Math.sin(_loc8_) * _loc6_ * 0.2,param4 + Math.sin(_loc8_) * _loc6_ * 0.5 - Math.cos(_loc8_) * _loc6_ * 0.2);\n'
     '            param1.lineTo(param3 + Math.cos(_loc8_) * _loc6_ * 0.5 - Math.sin(_loc8_) * _loc6_ * 0.2,param4 + Math.sin(_loc8_) * _loc6_ * 0.5 + Math.cos(_loc8_) * _loc6_ * 0.2);\n'
     '            _loc7_++;\n'
     '         }\n'
     '         param1.endFill();\n'
     '         param1.beginFill(0xFFFFFF,1);\n'
     '         param1.drawCircle(param3,param4,_loc6_ * 0.68);\n'
     '         param1.drawCircle(param3,param4,_loc6_ * 0.3);\n'
     '         param1.endFill();\n'
     '         return;\n'
     '      }\n'
     '      if(param2 == "palette" || param2 == "palette2")\n      {\n         // a grid of color squares'),
])
