# Multi-select for trades, run from patch.py (like anchors.py): `edit` is patch.py's.
#
# In a trade's item picker, Ctrl+click picks an item and Shift+click picks a
# range. "Add N items" then puts them all in the trade at once, instead of
# reopening the picker for every item. It works for both trade screens (the
# one you start with, and the one inside a trade). The game itself adds the
# items to its own lists and sends its usual messages, JR sends nothing.

PICKER_IMPORTS = '''   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.MouseEvent;
'''
PICKER_IMPORTS_NEW = '''   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.filters.GlowFilter;
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
         _popup.bx.removeEventListener("mouseDown",onClose);
'''

PICKER_FUNCS_ANCHOR = '''      private function winMouseOver(param1:MouseEvent) : void
      {
         param1.stopPropagation();
         if(param1.currentTarget.numChildren >= 2 && param1.currentTarget.cir.currentFrameLabel != "gray")
'''
PICKER_FUNCS = '''      // ---------------------------------------------------------------- JR
      // Multi-select for trades: Ctrl+click picks an item, Shift+click a range,
      // then "Add N items" puts them all in the trade at once.

      private function jrOn() : Boolean
      {
         return _type == 0 || _type == 3;
      }
      
      private function jrLimit() : int
      {
         var _loc1_:int = 0;
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
         var _loc4_:Boolean = false;
         if(!jrOn() || !_popup)
         {
            return;
         }
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
            _popup.addChild(_jrBtn);
         }
         _loc1_ = int(_jrSel.length);
         _loc4_ = _loc1_ > 0;
         if(_loc4_)
         {
            _jrBtnTxt.text = "Add " + _loc1_ + (_loc1_ == 1 ? " item" : " items");
            if(_loc1_ >= jrLimit())
            {
               _jrBtnTxt.text += " (limit)";
            }
         }
         else
         {
            _jrBtnTxt.text = "Ctrl+click or Shift+click to pick several";
         }
         _jrBtnTxt.x = 12;
         _jrBtnTxt.y = 4;
         _loc3_ = _jrBtnTxt.width + 24;
         _jrBtn.graphics.clear();
         _jrBtn.graphics.beginFill(_loc4_ ? 3055166 : 5592405,0.92);
         _jrBtn.graphics.drawRoundRect(0,0,_loc3_,28,10,10);
         _jrBtn.graphics.endFill();
         _jrBtn.mouseEnabled = _loc4_;
         _jrBtn.mouseChildren = false;
         _jrBtn.buttonMode = _loc4_;
         _loc2_ = _popup.itemBlock.getBounds(_popup);
         _jrBtn.x = _loc2_.x + (_loc2_.width - _loc3_) / 2;
         _jrBtn.y = _loc2_.y + _loc2_.height - 34;
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
