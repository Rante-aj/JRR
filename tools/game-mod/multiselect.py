# Multi-select for trades and My Shop, run from patch.py (like anchors.py):
# `edit` is patch.py's.
#
# In the item picker, Ctrl+click picks an item and Shift+click picks a range.
# In a trade, "Add N items" then puts them all in the trade at once, instead of
# reopening the picker for every item. It works for both trade screens (the
# one you start with, and the one inside a trade). The game itself adds the
# items to its own lists and sends its usual messages, JR sends nothing.
# In My Shop (picker type 2), "Price N items" hands the picks to shop.py,
# which opens the game's price popup for each in turn.
# How to pick several is told by a small green ? on the bottom bar, left of
# the search bar (hover to read, click to keep it open).

PICKER_IMPORTS = '''   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.MouseEvent;
'''
PICKER_IMPORTS_NEW = '''   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.filters.GlowFilter;
   import flash.geom.Point;
   import flash.geom.Rectangle;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
'''

PICKER_VARS = '''      private var _yesNoPopup:SBYesNoPopup;
      
      public function DenAndClothesItemSelect()
'''
PICKER_VARS_NEW = '''      private var _yesNoPopup:SBYesNoPopup;
      
      private var _jrSel:Array = [];
      
      private var _jrLastIdx:int = -1;
      
      private var _jrLastTab:int = -1;
      
      private var _jrBtn:Sprite;
      
      private var _jrBtnTxt:TextField;
      
      private var _jrHelp:Sprite;
      
      private var _jrTip:Sprite;
      
      private var _jrPinned:Boolean = false;
      
      public function DenAndClothesItemSelect()
'''

PICKER_CLICK = '''               if(_loc3_.isApproved)
               {
                  if(_loc3_.isInDenShop && _loc3_.denStoreInvId != ShopManager.currentOpenShopId)
'''
PICKER_CLICK_NEW = '''               if(_loc3_.isApproved)
               {
                  if(jrOn() && (_jrSel.length > 0 || param1.ctrlKey || param1.shiftKey))
                  {
                     if(!_loc3_.isInDenShop)
                     {
                        jrToggle(param1.currentTarget,_loc3_,param1.shiftKey);
                     }
                     return;
                  }
                  if(_loc3_.isInDenShop && _loc3_.denStoreInvId != ShopManager.currentOpenShopId)
'''

PICKER_LOADED = '''      private function onListLoaded() : void
      {
         onSearchTextInput(null);
'''
PICKER_LOADED_NEW = '''      private function onListLoaded() : void
      {
         onSearchTextInput(null);
         jrRefresh();
'''

PICKER_REMOVE = '''      private function removeListeners() : void
      {
         _popup.bx.removeEventListener("mouseDown",onClose);
'''
PICKER_REMOVE_NEW = '''      private function removeListeners() : void
      {
         if(_jrBtn)
         {
            _jrBtn.removeEventListener("mouseDown",jrConfirm);
            _jrBtn = null;
            _jrBtnTxt = null;
         }
         if(_jrHelp)
         {
            _jrHelp.removeEventListener("mouseOver",jrHelpOver);
            _jrHelp.removeEventListener("mouseOut",jrHelpOut);
            _jrHelp.removeEventListener("mouseDown",jrHelpDown);
            _jrHelp = null;
            _jrTip = null;
         }
         _popup.bx.removeEventListener("mouseDown",onClose);
'''

PICKER_FUNCS_ANCHOR = '''      private function winMouseOver(param1:MouseEvent) : void
      {
         param1.stopPropagation();
         if(param1.currentTarget.numChildren >= 2 && param1.currentTarget.cir.currentFrameLabel != "gray")
'''
PICKER_FUNCS = '''      // ---------------------------------------------------------------- JR
      // Multi-select: Ctrl+click picks an item, Shift+click a range, then
      // "Add N items" puts them all in the trade at once, or in My Shop
      // "Price N items" prices them one by one.

      private function jrOn() : Boolean
      {
         return _type == 0 || _type == 2 || _type == 3;
      }
      
      private function jrLimit() : int
      {
         var _loc1_:int = 0;
         if(_type == 2)
         {
            // a shop holds 24 items; the ones already in it are in this list
            return 24 - (_initCustomDenList ? int(_initCustomDenList.length) : 0);
         }
         if(_type == 3)
         {
            _loc1_ = int(TradeManager.initiationTradeList.length);
         }
         else if(_customInitiationTradeList)
         {
            _loc1_ = int(_customInitiationTradeList.length);
         }
         return 20 - _loc1_;
      }
      
      private function jrItemAt(param1:int) : Iitem
      {
         if(_popup.denBtnUp.visible)
         {
            return _currDenItemsArray.getIitem(param1);
         }
         if(_popup.petsBtnUp.visible)
         {
            return _currPetsArray.getPetItem(param1) as Iitem;
         }
         return _currClothesArray.getIitem(param1);
      }
      
      private function jrIndexOf(param1:Iitem) : int
      {
         var _loc2_:int = 0;
         if(!param1)
         {
            return -1;
         }
         _loc2_ = 0;
         while(_loc2_ < _jrSel.length)
         {
            if(_jrSel[_loc2_].invIdx == param1.invIdx && _jrSel[_loc2_].itemType == param1.itemType)
            {
               return _loc2_;
            }
            _loc2_++;
         }
         return -1;
      }
      
      private function jrMark(param1:Object, param2:Boolean) : void
      {
         try
         {
            if(param2)
            {
               param1.cir.gotoAndStop("down");
               param1.filters = [new GlowFilter(3394611,1,8,8,3,2)];
            }
            else
            {
               param1.cir.gotoAndStop("up");
               param1.filters = [];
            }
         }
         catch(e:Error)
         {
         }
      }
      
      private function jrSelect(param1:Object, param2:Iitem) : void
      {
         if(!param2 || !param2.isApproved || param2.isInDenShop || jrIndexOf(param2) >= 0 || _jrSel.length >= jrLimit())
         {
            return;
         }
         // My Shop: items on your trade list need the game's own question
         // (pick them one at a time), so a multi-pick skips them
         if(_type == 2 && TradeManager.getTradeItemInTradeList(param2) != null)
         {
            return;
         }
         try
         {
            if(param1.cir.currentFrameLabel == "gray")
            {
               return;
            }
         }
         catch(e:Error)
         {
            return;
         }
         _jrSel.push(param2);
         jrMark(param1,true);
      }
      
      private function jrUnselect(param1:Object, param2:Iitem) : void
      {
         var _loc3_:int = jrIndexOf(param2);
         if(_loc3_ >= 0)
         {
            _jrSel.splice(_loc3_,1);
         }
         jrMark(param1,false);
      }
      
      private function jrToggle(param1:Object, param2:Iitem, param3:Boolean) : void
      {
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         var _loc6_:int = 0;
         var _loc7_:Object = null;
         var _loc8_:int = 0;
         if(param1.cir.currentFrameLabel == "gray")
         {
            return;
         }
         _loc4_ = int(param1.index);
         if(param3 && _jrLastIdx >= 0 && _jrLastTab == LAST_VIEWED_TYPE && _jrLastIdx != _loc4_ && _currItemWindow)
         {
            _loc5_ = int(Math.min(_jrLastIdx,_loc4_));
            _loc6_ = int(Math.max(_jrLastIdx,_loc4_));
            _loc8_ = 0;
            while(_loc8_ < _currItemWindow.bg.numChildren)
            {
               _loc7_ = _currItemWindow.bg.getChildAt(_loc8_);
               if(_loc7_ is ItemWindowOriginal && int(_loc7_.index) >= _loc5_ && int(_loc7_.index) <= _loc6_ && _loc7_.visible && _loc7_.alpha > 0)
               {
                  jrSelect(_loc7_,jrItemAt(int(_loc7_.index)));
               }
               _loc8_++;
            }
         }
         else if(jrIndexOf(param2) >= 0)
         {
            jrUnselect(param1,param2);
         }
         else
         {
            jrSelect(param1,param2);
         }
         _jrLastIdx = _loc4_;
         _jrLastTab = LAST_VIEWED_TYPE;
         jrButton();
      }
      
      private function jrRefresh() : void
      {
         var _loc1_:int = 0;
         var _loc2_:Object = null;
         if(!jrOn() || !_popup)
         {
            return;
         }
         if(_currItemWindow && _jrSel.length > 0)
         {
            _loc1_ = 0;
            while(_loc1_ < _currItemWindow.bg.numChildren)
            {
               _loc2_ = _currItemWindow.bg.getChildAt(_loc1_);
               try
               {
                  if(_loc2_ is ItemWindowOriginal && jrIndexOf(jrItemAt(int(_loc2_.index))) >= 0)
                  {
                     jrMark(_loc2_,true);
                  }
               }
               catch(e:Error)
               {
               }
               _loc1_++;
            }
         }
         jrButton();
      }
      
      private function jrButton() : void
      {
         var _loc1_:int = 0;
         var _loc2_:Rectangle = null;
         var _loc3_:Number = NaN;
         if(!jrOn() || !_popup)
         {
            return;
         }
         _loc2_ = jrListRect();
         jrHelpBubble();
         if(!_jrBtn)
         {
            _jrBtn = new Sprite();
            _jrBtnTxt = new TextField();
            _jrBtnTxt.defaultTextFormat = new TextFormat("Arial",14,16777215,true);
            _jrBtnTxt.selectable = false;
            _jrBtnTxt.mouseEnabled = false;
            _jrBtnTxt.autoSize = TextFieldAutoSize.LEFT;
            _jrBtn.addChild(_jrBtnTxt);
            _jrBtn.addEventListener("mouseDown",jrConfirm,false,0,true);
            _jrBtn.mouseChildren = false;
            _jrBtn.buttonMode = true;
            _popup.addChild(_jrBtn);
         }
         _loc1_ = int(_jrSel.length);
         _jrBtn.visible = _loc1_ > 0;
         if(_loc1_ < 1)
         {
            return;
         }
         _jrBtnTxt.text = (_type == 2 ? "Price " : "Add ") + _loc1_ + (_loc1_ == 1 ? " item" : " items");
         if(_loc1_ >= jrLimit())
         {
            _jrBtnTxt.text += " (limit)";
         }
         _jrBtnTxt.x = 12;
         _jrBtnTxt.y = 4;
         _loc3_ = _jrBtnTxt.width + 24;
         _jrBtn.graphics.clear();
         _jrBtn.graphics.beginFill(3055166,0.92);
         _jrBtn.graphics.drawRoundRect(0,0,_loc3_,28,10,10);
         _jrBtn.graphics.endFill();
         _jrBtn.x = Math.round(_loc2_.x + (_loc2_.width - _loc3_) / 2);
         _jrBtn.y = jrButtonY(_loc2_);
      }
      
      // Just below the picker's frame, out of the way of the items (like the
      // buttons under the shop's price popup); over the bottom of the list
      // when the screen has no room below.
      private function jrButtonY(param1:Rectangle) : Number
      {
         var _loc2_:Rectangle = null;
         var _loc3_:Number = NaN;
         var _loc4_:Point = null;
         try
         {
            _loc2_ = (_popup.searchBar.mouse.m as DisplayObject).getBounds(_popup);
            _loc3_ = Math.round(_loc2_.bottom + 20);
            if(_popup.stage != null)
            {
               _loc4_ = _popup.localToGlobal(new Point(0,_loc3_ + 30));
               if(_loc4_.y <= _popup.stage.stageHeight - 2)
               {
                  return _loc3_;
               }
            }
         }
         catch(e:Error)
         {
         }
         return Math.round(param1.y + param1.height - 34);
      }
      
      // The list's visible frame: the item block's first child (its frame,
      // the one child the game keeps). The block's own bounds grow with every
      // item window loaded, far past the visible part.
      private function jrListRect() : Rectangle
      {
         try
         {
            if(_popup.itemBlock.numChildren > 0)
            {
               return _popup.itemBlock.getChildAt(0).getBounds(_popup);
            }
         }
         catch(e:Error)
         {
         }
         return new Rectangle(_popup.itemBlock.x,_popup.itemBlock.y,_popup.itemBlock.width,_popup.itemBlock.height);
      }
      
      // The green ? on the bottom bar, left of the search bar: hover shows how
      // to pick several, a click keeps it open (click again to close).
      private function jrHelpBubble() : void
      {
         var _loc1_:Rectangle = null;
         var _loc2_:TextField = null;
         if(!_jrHelp)
         {
            _jrHelp = new Sprite();
            _jrHelp.graphics.lineStyle(2,2383378,1,true);
            _jrHelp.graphics.beginFill(4565034,1);
            _jrHelp.graphics.drawCircle(13,13,13);
            _jrHelp.graphics.endFill();
            _jrHelp.graphics.lineStyle(0,0,0);
            _jrHelp.graphics.beginFill(16777215,0.3);
            _jrHelp.graphics.drawEllipse(6,3,14,8);
            _jrHelp.graphics.endFill();
            _loc2_ = new TextField();
            _loc2_.defaultTextFormat = new TextFormat("Arial",16,16777215,true);
            _loc2_.selectable = false;
            _loc2_.mouseEnabled = false;
            _loc2_.autoSize = TextFieldAutoSize.LEFT;
            _loc2_.text = "?";
            _loc2_.x = Math.round(13 - _loc2_.width / 2);
            _loc2_.y = Math.round(13 - _loc2_.height / 2);
            _jrHelp.addChild(_loc2_);
            _jrHelp.buttonMode = true;
            _jrHelp.mouseChildren = false;
            _jrHelp.addEventListener("mouseOver",jrHelpOver,false,0,true);
            _jrHelp.addEventListener("mouseOut",jrHelpOut,false,0,true);
            _jrHelp.addEventListener("mouseDown",jrHelpDown,false,0,true);
            _popup.addChild(_jrHelp);
         }
         // left of the whole search bar (its rounded end too), centred on it
         _loc1_ = _popup.searchBar.getBounds(_popup);
         _jrHelp.x = Math.round(_loc1_.x - 26 - 12);
         try
         {
            _loc1_ = (_popup.searchBar.mouse.m as DisplayObject).getBounds(_popup);
         }
         catch(e:Error)
         {
         }
         _jrHelp.y = Math.round(_loc1_.y + (_loc1_.height - 26) / 2);
         if(_jrTip && _jrTip.visible)
         {
            jrTipPlace();
         }
      }
      
      private function jrTipShow() : void
      {
         var _loc1_:TextField = null;
         if(!_jrHelp || !_popup)
         {
            return;
         }
         if(!_jrTip)
         {
            _jrTip = new Sprite();
            _jrTip.mouseEnabled = false;
            _jrTip.mouseChildren = false;
            _loc1_ = new TextField();
            _loc1_.defaultTextFormat = new TextFormat("Arial",12,16777215,false);
            _loc1_.selectable = false;
            _loc1_.mouseEnabled = false;
            _loc1_.multiline = true;
            _loc1_.wordWrap = true;
            _loc1_.width = 200;
            _loc1_.autoSize = TextFieldAutoSize.LEFT;
            _loc1_.text = _type == 2 ? "Ctrl+click or Shift+click to pick several items, then press Price to set their prices one by one." : "Ctrl+click or Shift+click to pick several items, then press Add to put them all in the trade.";
            _loc1_.x = 10;
            _loc1_.y = 7;
            _jrTip.graphics.beginFill(3355443,0.94);
            _jrTip.graphics.drawRoundRect(0,0,_loc1_.width + 20,_loc1_.height + 14,12,12);
            _jrTip.graphics.endFill();
            _jrTip.addChild(_loc1_);
         }
         _popup.addChild(_jrTip);
         _jrTip.visible = true;
         jrTipPlace();
      }
      
      private function jrTipPlace() : void
      {
         _jrTip.x = _jrHelp.x;
         _jrTip.y = _jrHelp.y - _jrTip.height - 6;
      }
      
      private function jrTipHide() : void
      {
         if(_jrTip)
         {
            _jrTip.visible = false;
         }
      }
      
      private function jrHelpOver(param1:MouseEvent) : void
      {
         param1.stopPropagation();
         jrTipShow();
      }
      
      private function jrHelpOut(param1:MouseEvent) : void
      {
         param1.stopPropagation();
         if(!_jrPinned)
         {
            jrTipHide();
         }
      }
      
      private function jrHelpDown(param1:MouseEvent) : void
      {
         param1.stopPropagation();
         _jrPinned = !_jrPinned;
         if(_jrPinned)
         {
            jrTipShow();
         }
         else
         {
            jrTipHide();
         }
      }
      
      private function jrConfirm(param1:MouseEvent) : void
      {
         var _loc2_:Function = null;
         var _loc3_:Array = null;
         var _loc4_:int = 0;
         var _loc5_:Iitem = null;
         param1.stopPropagation();
         _loc2_ = _onCloseCallback;
         if(_jrSel.length < 1 || _loc2_ == null)
         {
            return;
         }
         _loc3_ = _jrSel.concat();
         _jrSel = [];
         if(_type == 3)
         {
            _loc4_ = 0;
            while(_loc4_ < _loc3_.length)
            {
               _loc5_ = _loc3_[_loc4_] as Iitem;
               if(_loc5_ is Item)
               {
                  TradeManager.adjustByOnNumClothingItemsInInitiateTradeList(1);
               }
               else if(_loc5_ is DenItem)
               {
                  TradeManager.adjustByOnNumDenItemsInInitiateTradeList(1);
               }
               else if(_loc5_ is PetItem)
               {
                  TradeManager.adjustByOnNumPetItemsInInitiateTradeList(1);
               }
               _loc4_++;
            }
         }
         _loc2_(_loc3_);
      }
      
'''

edit('gui/DenAndClothesItemSelect.as', [
    (PICKER_IMPORTS, PICKER_IMPORTS_NEW),
    (PICKER_VARS, PICKER_VARS_NEW),
    (PICKER_CLICK, PICKER_CLICK_NEW),
    (PICKER_LOADED, PICKER_LOADED_NEW),
    (PICKER_REMOVE, PICKER_REMOVE_NEW),
    (PICKER_FUNCS_ANCHOR, PICKER_FUNCS + PICKER_FUNCS_ANCHOR),
])

# ---------------------------------------------------------------- trade screen in a trade
# The picker now hands over an Array when several items were picked. The
# original add-one-item steps become jrAddTradeItem and run once per item; the
# picker is closed once, at the end.
AE_OLD = '''      private function onTradeItemSelectClose(param1:Iitem) : void
      {
         var _loc3_:int = 0;
         var _loc2_:TradeItem = null;
         if(param1)
         {
'''
AE_NEW = '''      private function onTradeItemSelectClose(param1:Object) : void
      {
         var _loc2_:int = 0;
         if(param1 is Array)
         {
            _loc2_ = 0;
            while(_loc2_ < param1.length)
            {
               jrAddTradeItem(param1[_loc2_] as Iitem);
               _loc2_++;
            }
         }
         else if(param1)
         {
            jrAddTradeItem(param1 as Iitem);
         }
         openCloseTradeWindow();
      }
      
      private function jrAddTradeItem(param1:Iitem) : void
      {
         var _loc3_:int = 0;
         var _loc2_:TradeItem = null;
         if(param1)
         {
'''
AE_TAIL_OLD = '''               _itemTradeWindows.findOpenWindowAndUpdate(param1.clone());
            }
         }
         openCloseTradeWindow();
      }
'''
AE_TAIL_NEW = '''               _itemTradeWindows.findOpenWindowAndUpdate(param1.clone());
            }
         }
      }
'''
edit('gui/AvatarEditor.as', [(AE_OLD, AE_NEW), (AE_TAIL_OLD, AE_TAIL_NEW)])

# ---------------------------------------------------------------- trade screen when starting a trade
TM_FIND = '''      private static function findItem(param1:TradeItem) : Iitem
'''
TM_FUNC = '''      private static function addTradeItemOrMany(param1:Object) : void
      {
         var _loc2_:int = 0;
         if(param1 is Array)
         {
            _loc2_ = 0;
            while(_loc2_ < param1.length)
            {
               addTradeItem(param1[_loc2_] as Iitem);
               _loc2_++;
            }
         }
         else
         {
            addTradeItem(param1 as Iitem);
         }
      }
      
'''
edit('gui/TradeManager.as', [
    ('PetManager.myPetListAsIitem,_guiLayer,null,addTradeItem,3);', 'PetManager.myPetListAsIitem,_guiLayer,null,addTradeItemOrMany,3);'),
    (TM_FIND, TM_FUNC + TM_FIND),
])
