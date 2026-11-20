# "JR Buttons" in the game's Settings window (JR's own rows): off hides all of
# JR in the game except JR's Settings rows. Run from patch.py last (after
# multiselect.py, recycle.py, shop.py, hud.py and star.py): `edit` is patch.py's.
#
# Kept in SharedObject "jrUi" ({off: true}), shared by all accounts.
# - Shown or hidden at once (jrUiTrack): JR's buttons on game screens (jrAnchor),
#   the chat bar buttons, the sitting pose buttons, the map tab, the color row
#   under Edit Animal's color tables, the Starred tab in the buddy list.
# - Not made while off (back the next time that screen opens): the chat bar
#   buttons, Edit Animal's big palette, the worth bubble, More Sorts, JR windows
#   and messages, the recycle screen's toolbar and Shift+click, the item
#   picker's multi-select, the shop's typed price and Price match, the star on
#   player cards and name tags.
# Open JR windows close when it's turned off. Turning it off also gives the
# chat bar back its full chat field and rebuilds the buddy list without the
# Starred tab's space; turning it on puts JR's chat bar buttons back.

UI_API = r'''      // --------------------------------------------------------- JR buttons
      // Settings > "JR Buttons" off: all of JR in the game is hidden, except
      // JR's own Settings rows. SharedObject "jrUi" {off}, all accounts.

      private static var _jrUiOff:int = -1;

      private static var _jrUiParts:Dictionary = new Dictionary(true);

      // The chat bar JR last saw [bar, field], and how it was before JR made
      // room for its buttons [[part, x, width]...].
      private static var _jrChatRef:Array;

      private static var _jrChatSnap:Array;

      private static function jrChatUndo() : void
      {
         var _loc1_:Array = null;
         var _loc2_:DisplayObject = null;
         var _loc3_:DisplayObjectContainer = null;
         try
         {
            if(_jrChatSnap == null || _jrChatRef == null)
            {
               return;
            }
            _loc3_ = _jrChatRef[0] as DisplayObjectContainer;
            for each(_loc1_ in _jrChatSnap)
            {
               _loc2_ = _loc1_[0] as DisplayObject;
               if(_loc2_ != null && _loc2_.parent == _loc3_)
               {
                  if(_loc2_.width != Number(_loc1_[2]))
                  {
                     _loc2_.width = Number(_loc1_[2]);
                  }
                  _loc2_.x = Number(_loc1_[1]);
               }
            }
            _loc2_ = _loc3_ != null ? _loc3_.getChildByName("jrChat") : null;
            if(_loc2_ != null)
            {
               _loc3_.removeChild(_loc2_);
            }
         }
         catch(e:Error)
         {
         }
         _jrChatSnap = null;
      }

      public static function jrUiHidden() : Boolean
      {
         var _loc1_:SharedObject = null;
         if(_jrUiOff < 0)
         {
            _jrUiOff = 0;
            try
            {
               _loc1_ = SharedObject.getLocal("jrUi","/");
               _jrUiOff = _loc1_.data.off == true ? 1 : 0;
            }
            catch(e:Error)
            {
            }
         }
         return _jrUiOff == 1;
      }

      // A part of JR on a game screen: shown or hidden with the setting.
      public static function jrUiTrack(param1:Object) : void
      {
         var _loc2_:DisplayObject = param1 as DisplayObject;
         if(_loc2_ == null)
         {
            return;
         }
         _jrUiParts[_loc2_] = true;
         _loc2_.visible = !jrUiHidden();
      }

      public static function jrUiSet(param1:Boolean) : void
      {
         var _loc2_:SharedObject = null;
         var _loc3_:Object = null;
         var _loc4_:String = null;
         _jrUiOff = param1 ? 1 : 0;
         try
         {
            _loc2_ = SharedObject.getLocal("jrUi","/");
            _loc2_.data.off = param1;
            _loc2_.flush();
         }
         catch(e:Error)
         {
         }
         for(_loc3_ in _jrUiParts)
         {
            if(_loc3_ is DisplayObject)
            {
               DisplayObject(_loc3_).visible = !param1;
            }
         }
         if(param1)
         {
            jrChatUndo();
            jrSortMenuClose();
            if(_jrBubble)
            {
               _jrBubble.hide();
            }
            for(_loc4_ in _jrPanels)
            {
               try
               {
                  JRPanel(_jrPanels[_loc4_]).close();
               }
               catch(e2:Error)
               {
               }
            }
         }
         if(!param1 && _jrChatRef != null)
         {
            jrChatBar(_jrChatRef[0],_jrChatRef[1]);
         }
         try
         {
            BuddyList.jrRebuild();
         }
         catch(e3:Error)
         {
         }
         jrStarChanged();
      }

'''

edit('XtReplyDemuxer.as', [
    ('   import buddy.BuddyManager;\n', '   import buddy.BuddyManager;\n   import buddy.BuddyList;\n'),
    # the map tabs follow the game's tab, but stay hidden while off
    ('         _loc6_.visible = _loc7_.visible;\n',
     '         _loc6_.visible = _loc7_.visible && !XtReplyDemuxer.jrUiHidden();\n'),
    # the chat bar as it was, before JR makes room (for turning JR off)
    ('            _loc5_ = Math.round(Math.max(30,Math.min(40,_loc4_.height + 14)));\n',
     '            _jrChatSnap = [];\n            _loc10_ = 0;\n            while(_loc10_ < _loc3_.numChildren)\n            {\n'
     '               _loc11_ = _loc3_.getChildAt(_loc10_);\n               _jrChatSnap.push([_loc11_,_loc11_.x,_loc11_.width]);\n'
     '               _loc10_++;\n            }\n'
     '            _loc5_ = Math.round(Math.max(30,Math.min(40,_loc4_.height + 14)));\n'),
    # the setting itself, first of JR's rows
    ('      // ------------------------------------------------------------ stars\n',
     UI_API + '      // ------------------------------------------------------------ stars\n'),
    ('      public static function jrAddSettingsRows(param1:Array) : void\n      {\n         var _loc2_:Object = null;\n',
     '      public static function jrAddSettingsRows(param1:Array) : void\n      {\n         var _loc2_:Object = null;\n'
     '         param1.push({\n            "type":0,\n            "frame":"autoServer",\n            "jrKey":"jrUi",\n'
     '            "jrLabel":"JR Buttons",\n            "jrValue":!jrUiHidden()\n         });\n'),
    ('      public static function jrSetRow(param1:String, param2:Boolean) : void\n      {\n         var _loc3_:Object = null;\n',
     '      public static function jrSetRow(param1:String, param2:Boolean) : void\n      {\n         var _loc3_:Object = null;\n'
     '         if(param1 == "jrUi")\n         {\n            jrUiSet(!param2);\n         }\n'),
    # shown or hidden at once
    ('            _loc5_.addChild(_loc8_);\n',
     '            _loc5_.addChild(_loc8_);\n            jrUiTrack(_loc8_);\n'),
    ('            _loc3_.addChild(_loc13_);\n',
     '            _loc3_.addChild(_loc13_);\n            jrUiTrack(_loc13_);\n'),
    ('         _loc2_.addChild(_loc4_);\n      }\n\n      private static function jrOnPose',
     '         _loc2_.addChild(_loc4_);\n         jrUiTrack(_loc4_);\n      }\n\n      private static function jrOnPose'),
    ('            _loc5_.parent.addChild(_loc7_);\n',
     '            _loc5_.parent.addChild(_loc7_);\n            jrUiTrack(_loc7_);\n'),
    ('            param1.addChild(_loc7_);\n            param1.jrOnPick',
     '            param1.addChild(_loc7_);\n            jrUiTrack(_loc7_);\n            param1.jrOnPick'),
    ('            _loc2_.addChild(_jrStarTabs);\n',
     '            _loc2_.addChild(_jrStarTabs);\n            jrUiTrack(_jrStarTabs);\n'),
    # not made while off
    ('            _loc3_ = param1 as DisplayObjectContainer;\n            _loc4_ = param2 as TextField;\n',
     '            _loc3_ = param1 as DisplayObjectContainer;\n            _loc4_ = param2 as TextField;\n'
     '            _jrChatRef = [_loc3_,_loc4_];\n            if(jrUiHidden())\n            {\n               return;\n            }\n'),
    ('         if(param1 == null || param2 == null)\n         {\n            return;\n         }\n         _loc5_ = Math.min(256,param2.length);',
     '         if(param1 == null || param2 == null || jrUiHidden())\n         {\n            return;\n         }\n         _loc5_ = Math.min(256,param2.length);'),
    ('         if(!(param1 is Iitem))\n',
     '         if(!(param1 is Iitem) || jrUiHidden())\n'),
    ('         if(param1 == null || param1.stage == null)\n         {\n            return;\n         }\n         if(_jrSortMenu)',
     '         if(param1 == null || param1.stage == null || jrUiHidden())\n         {\n            return;\n         }\n         if(_jrSortMenu)'),
    ('         if(_loc7_ == null)\n         {\n            return;\n         }\n         if(_loc7_.stage)\n         {\n            _jrStage = _loc7_.stage;\n         }\n         jrUnembed(param1,false);',
     '         if(_loc7_ == null || jrUiHidden())\n         {\n            return;\n         }\n         if(_loc7_.stage)\n         {\n            _jrStage = _loc7_.stage;\n         }\n         jrUnembed(param1,false);'),
    ('         if(_jrStage == null)\n         {\n            return;\n         }\n         if(_loc3_ == null)',
     '         if(_jrStage == null || _loc3_ == null && jrUiHidden())\n         {\n            return;\n         }\n         if(_loc3_ == null)'),
    ('         if(_jrStage == null || !param1 || !param1.text)\n',
     '         if(_jrStage == null || !param1 || !param1.text || jrUiHidden())\n'),
    # stars
    ('         return _loc2_ == 2 || _loc2_ == 1 && !_jrStarMineOnly;\n',
     '         return !jrUiHidden() && (_loc2_ == 2 || _loc2_ == 1 && !_jrStarMineOnly);\n'),
    ('            if(_loc5_ == null || !param2)\n            {\n               return;\n            }\n            if(param5 is NameBar)',
     '            if(_loc5_ == null || !param2 || jrUiHidden())\n            {\n               return;\n            }\n            if(param5 is NameBar)'),
    ('      public static function jrStarTabsH() : int\n      {\n         return _jrStarTabs != null ? JRStarTabs.H : 0;\n',
     '      public static function jrStarTabsH() : int\n      {\n         return _jrStarTabs != null && !jrUiHidden() ? JRStarTabs.H : 0;\n'),
    ('   public function refresh() : void\n   {\n      drawTabs();\n      sync(null);\n',
     '   public function refresh() : void\n   {\n      if(XtReplyDemuxer.jrUiHidden())\n      {\n         _starred = false;\n      }\n      drawTabs();\n      sync(null);\n'),
])

# The recycle screen: no toolbar, no Shift+click (the game's own screen).
edit('gui/RecycleItems.as', [
    ('            _loc1_ = _recyclePopup.itemBlock as DisplayObject;\n            if(_loc1_ == null)\n',
     '            _loc1_ = _recyclePopup.itemBlock as DisplayObject;\n            if(_loc1_ == null || XtReplyDemuxer.jrUiHidden())\n'),
    ('         if(_recycleInventory == null)\n         {\n            return;\n         }\n         _jrAll = _recycleInventory.getCoreArray().concat();\n',
     '         if(_recycleInventory == null || XtReplyDemuxer.jrUiHidden())\n         {\n            return;\n         }\n         _jrAll = _recycleInventory.getCoreArray().concat();\n'),
])

# The item picker: no multi-select (the game's own picker).
edit('gui/DenAndClothesItemSelect.as', [
    ('         return _type == 0 || _type == 2 || _type == 3;\n',
     '         return !XtReplyDemuxer.jrUiHidden() && (_type == 0 || _type == 2 || _type == 3);\n'),
])

# The shop's price popup: no typed price, count or Price match.
edit('shop/ShopToSell.as', [
    ('         var _loc1_:TextField = jrPriceField();\n         _jrCancel = false;\n',
     '         var _loc1_:TextField = jrPriceField();\n         _jrCancel = false;\n'
     '         if(XtReplyDemuxer.jrUiHidden())\n         {\n            return;\n         }\n'),
])

# The buddy list: rebuilt when the setting changes, so the game's list takes
# back the Starred tab's space (or makes room for it).
edit('buddy/BuddyList.as', [
    ('      public static function closeBuddyList() : void\n',
     '      public static function jrRebuild() : void\n      {\n'
     '         if(_buddyListPopup != null && _buddyListContent != null && _loadingSpiral != null)\n         {\n'
     '            onBuddyListChange(null);\n         }\n      }\n\n'
     '      public static function closeBuddyList() : void\n'),
])

# Edit Animal's clothing search bar (a JR bug, on or off): FFDec turns the
# game's "is this the trade list?" test in createItemWindows into lines that
# always say yes, so once JR rebuilds Edit Animal the search bar was always
# hidden. The game hides it only for the trade list (and den items, below).
edit('gui/AvatarEditor.as', [
    ('         _loc6_ = false;\n         _loc6_ = true;\n         param1 == _currTradesArray ? _loc6_ : (_loc6_);\n',
     '         _loc6_ = param1 == _currTradesArray;\n'),
])
