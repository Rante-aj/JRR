# My Shop pricing (shop.ShopToSell), run from patch.py after multiselect.py:
# `edit` is patch.py's.
#
# - The item picker can hand over several items at once (multiselect.py,
#   "Price N items"). The game's own price popup then opens for each in turn,
#   with "Item 2 of 5" above it; each popup starts at the price just set.
#   The X on a popup stops the batch: items already priced stay in the shop
#   (the shop's own delete button removes them), the rest are not added.
#   The next popup opens one frame after the last one closed (see jrAfterClose).
# - "Price match same" gives the price to every waiting copy of this item
#   (same item id), "Price match all" to every waiting item.
# - The price can be typed (Enter = Set). A price outside the game's steps
#   (gems: 50 to 15,000 in steps of 50; diamonds: 1 to 500) is rounded, after
#   a Yes/No popup that says so.
# Nothing new is sent: the game saves the shop as before, when it is closed.

SHOP_IMPORTS = '''   import flash.filters.GlowFilter;
   import flash.display.DisplayObject;
   import flash.display.GradientType;
   import flash.display.Graphics;
   import flash.display.Sprite;
   import flash.events.KeyboardEvent;
   import flash.geom.Matrix;
   import flash.geom.Rectangle;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFieldType;
   import flash.text.TextFormat;
   import flash.ui.Keyboard;
   import flash.utils.Dictionary;
'''

SHOP_VARS = '''      private var _myShopItemsNameHigh:Vector.<MyShopItem>;

      // ------------------------------------------------------------ JR
      // Pricing several items in a row (functions at the end of the class).

      private var _jrQueue:Array;

      private var _jrTotal:int = 0;

      private var _jrDone:int = 0;

      private var _jrSetting:Boolean = false;

      private var _jrLastCost:int = -1;

      private var _jrLastCurrency:int = -1;

      private var _jrAsking:Boolean = false;

      private var _jrPendingAction:int = 0;

      private var _jrPendingCost:int = 0;

      private var _jrCountBox:Sprite;

      private var _jrCountTxt:TextField;

      private var _jrSameBtn:Sprite;

      private var _jrAllBtn:Sprite;

      private var _jrBtns:Dictionary;

      private var _jrCancel:Boolean = false;

      private var _jrNextQueued:Boolean = false;

      private var _jrTick:Sprite;
'''

SHOP_FUNCS = r'''      // ------------------------------------------------------------ JR
      // Pricing several items in a row.

      private function jrStartBatch(param1:Array) : void
      {
         var _loc2_:Object = null;
         _jrQueue = [];
         for each(_loc2_ in param1)
         {
            if(_loc2_ is Iitem)
            {
               _jrQueue.push(_loc2_);
            }
         }
         _jrTotal = _jrQueue.length;
         _jrDone = 0;
         _jrLastCost = -1;
         _jrLastCurrency = -1;
         jrNext();
      }

      private function jrNext() : void
      {
         if(_jrQueue == null || _jrQueue.length == 0)
         {
            jrEndBatch();
            return;
         }
         _jrDone++;
         _itemCurrentlyBeingUpdated = null;
         displaySetCostPopup(_jrQueue.shift() as Iitem);
      }

      private function jrEndBatch() : void
      {
         if(_jrNextQueued && _jrTick != null)
         {
            _jrTick.removeEventListener(Event.ENTER_FRAME,onJrNextFrame);
         }
         _jrNextQueued = false;
         _jrCancel = false;
         _jrQueue = null;
         _jrTotal = 0;
         _jrDone = 0;
         jrHideExtras();
      }

      // After the first item of a batch, a popup starts at the price just set.
      private function jrBatchPrice() : Boolean
      {
         return _jrQueue != null && _jrDone > 1 && _jrLastCost > 0 && _itemCurrentlyBeingUpdated == null;
      }

      // The price popup has closed. Its X stops the batch; any other close
      // (Set, Price match, Yes on the rounding question) goes on to the next
      // item, one frame later: the click that closed this popup is still
      // being handled (by the game's popups too) and must not reach the next.
      private function jrAfterClose() : void
      {
         _jrSetting = false;
         jrHideExtras();
         if(_jrQueue == null)
         {
            _jrCancel = false;
            return;
         }
         if(_jrCancel)
         {
            _jrCancel = false;
            jrEndBatch();
            return;
         }
         if(!_jrNextQueued)
         {
            if(_jrTick == null)
            {
               _jrTick = new Sprite();
            }
            _jrNextQueued = true;
            _jrTick.addEventListener(Event.ENTER_FRAME,onJrNextFrame);
         }
      }

      private function onJrNextFrame(param1:Event) : void
      {
         _jrTick.removeEventListener(Event.ENTER_FRAME,onJrNextFrame);
         _jrNextQueued = false;
         if(_jrQueue == null)
         {
            return;
         }
         try
         {
            if(_shop == null || _shop.setItemCostCont == null || _shop.setItemCostCont.visible)
            {
               jrEndBatch();
               return;
            }
            jrNext();
         }
         catch(e:Error)
         {
            jrEndBatch();
         }
      }

      // The popup's X, before the game's own handler closes it.
      private function onJrCloseDown(param1:MouseEvent) : void
      {
         _jrCancel = _jrQueue != null;
      }

      // ------------------------------------------------------- typed price

      private function jrPriceField() : TextField
      {
         try
         {
            return _shop.setItemCostCont.numTxt as TextField;
         }
         catch(e:Error)
         {
         }
         return null;
      }

      private function jrPopupExtras() : void
      {
         var _loc1_:TextField = jrPriceField();
         _jrCancel = false;
         try
         {
            _shop.setItemCostCont.closeBtn.addEventListener("mouseDown",onJrCloseDown,false,10,true);
         }
         catch(e2:Error)
         {
         }
         if(_loc1_ != null)
         {
            try
            {
               _loc1_.type = TextFieldType.INPUT;
               _loc1_.selectable = true;
               _loc1_.restrict = "0-9";
               _loc1_.maxChars = 5;
               _loc1_.addEventListener(KeyboardEvent.KEY_DOWN,onJrPriceKey,false,0,true);
               _loc1_.addEventListener(KeyboardEvent.KEY_UP,onJrSwallowKey,false,0,true);
               _loc1_.addEventListener(Event.CHANGE,onJrPriceTyped,false,0,true);
               if(_loc1_.stage != null)
               {
                  _loc1_.stage.focus = _loc1_;
                  _loc1_.setSelection(0,_loc1_.text.length);
               }
            }
            catch(e:Error)
            {
            }
         }
         jrShowExtras();
      }

      private function onJrPriceTyped(param1:Event) : void
      {
         var _loc2_:TextField = jrPriceField();
         if(_loc2_ != null && _loc2_.text != "" && _costTypeRadioBtns != null)
         {
            setPriceTag();
         }
      }

      private function onJrPriceKey(param1:KeyboardEvent) : void
      {
         param1.stopPropagation();
         if(param1.keyCode == Keyboard.ENTER && !_jrAsking && _costTypeRadioBtns != null)
         {
            onSetCostDown(new MouseEvent(MouseEvent.MOUSE_DOWN));
         }
      }

      private function onJrSwallowKey(param1:KeyboardEvent) : void
      {
         param1.stopPropagation();
      }

      // The game's steps: gems 50 to 15,000 by 50, diamonds 1 to 500. If the
      // price isn't one of them, ask before rounding it (param1: what to do
      // after a Yes: 0 Set, 1 Price match same, 2 Price match all).
      private function jrPriceCheck(param1:int) : Boolean
      {
         var _loc2_:TextField = jrPriceField();
         var _loc3_:Boolean = false;
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         var _loc6_:String = null;
         if(_loc2_ == null || _costTypeRadioBtns == null)
         {
            return false;
         }
         if(_jrAsking)
         {
            return true;
         }
         _loc3_ = _costTypeRadioBtns.selected == 1;
         _loc4_ = int(_loc2_.text);
         if(_loc3_)
         {
            _loc5_ = Math.max(1,Math.min(500,_loc4_));
            _loc6_ = "Diamond prices go from 1 to 500. Set the price to " + _loc5_ + (_loc5_ == 1 ? " diamond?" : " diamonds?");
         }
         else
         {
            _loc5_ = Math.max(50,Math.min(15000,Math.round(_loc4_ / 50) * 50));
            _loc6_ = "Gem prices go from 50 to 15,000 in steps of 50. Round " + _loc4_ + " gems to " + _loc5_ + " gems?";
         }
         if(_loc5_ == _loc4_ && _loc2_.text != "")
         {
            return false;
         }
         _jrAsking = true;
         _jrPendingAction = param1;
         _jrPendingCost = _loc5_;
         new SBYesNoPopup(_popupLayer,_loc6_,true,onJrRoundAnswer);
         return true;
      }

      private function onJrRoundAnswer(param1:Object) : void
      {
         var _loc2_:TextField = jrPriceField();
         _jrAsking = false;
         if(param1 == null || !param1.status || _loc2_ == null || _costTypeRadioBtns == null)
         {
            return;
         }
         _loc2_.text = String(_jrPendingCost);
         setPriceTag();
         if(_jrPendingAction == 1)
         {
            jrMatch(false);
         }
         else if(_jrPendingAction == 2)
         {
            jrMatch(true);
         }
         else
         {
            onSetCostDown(new MouseEvent(MouseEvent.MOUSE_DOWN));
         }
      }

      // ----------------------------------------------------- price matching

      private function jrSameCount() : int
      {
         var _loc1_:Object = null;
         var _loc2_:int = 0;
         if(_jrQueue == null || _selectedItem == null)
         {
            return 0;
         }
         for each(_loc1_ in _jrQueue)
         {
            if(Iitem(_loc1_).itemType == _selectedItem.itemType && Iitem(_loc1_).defId == _selectedItem.defId)
            {
               _loc2_++;
            }
         }
         return _loc2_;
      }

      // This item gets the price as with Set; the waiting items that match
      // (same item id, or all of them) get it too, without a popup.
      private function jrMatch(param1:Boolean) : void
      {
         var _loc2_:Array = [];
         var _loc3_:Object = null;
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         var _loc6_:int = 0;
         if(_jrQueue == null || _selectedItem == null || _costTypeRadioBtns == null)
         {
            return;
         }
         if(jrPriceCheck(param1 ? 2 : 1))
         {
            return;
         }
         _loc4_ = _costTypeRadioBtns.selected == 1 ? 3 : 0;
         _loc5_ = int(_shop.setItemCostCont.numTxt.text);
         for each(_loc3_ in _jrQueue)
         {
            if(param1 || Iitem(_loc3_).itemType == _selectedItem.itemType && Iitem(_loc3_).defId == _selectedItem.defId)
            {
               jrAddPriced(_loc3_ as Iitem,_loc4_,_loc5_);
               _loc6_++;
            }
            else
            {
               _loc2_.push(_loc3_);
            }
         }
         _jrQueue = _loc2_;
         _jrDone += _loc6_;
         onSetCostDown(new MouseEvent(MouseEvent.MOUSE_DOWN));
      }

      // What Set does for a new item, for one that skips its popup.
      private function jrAddPriced(param1:Iitem, param2:int, param3:int) : void
      {
         var _loc4_:Iitem = null;
         var _loc5_:Boolean = false;
         var _loc6_:int = 0;
         var _loc7_:MyShopItem = null;
         if(param1 == null)
         {
            return;
         }
         _loc4_ = param1.clone();
         _loc4_.asShopItemSized = true;
         if(_removedItems)
         {
            _loc6_ = 0;
            while(_loc6_ < _removedItems.length)
            {
               if(_removedItems[_loc6_].currItem.itemType == _loc4_.itemType && _removedItems[_loc6_].currItem.defId == _loc4_.defId)
               {
                  if(param2 == _removedItems[_loc6_].currencyType && param3 == _removedItems[_loc6_].cost)
                  {
                     _loc5_ = true;
                  }
                  _removedItems.splice(_loc6_,1);
                  break;
               }
               _loc6_++;
            }
         }
         _shopItemArray.pushIitem(_loc4_.clone());
         _loc7_ = new MyShopItem(_loc4_.clone(),param2,param3,_shopId);
         if(!_loc5_)
         {
            if(_addedItems == null)
            {
               _addedItems = new Vector.<MyShopItem>();
            }
            _addedItems.push(_loc7_);
         }
         _currMyShopItemsArray.push(_loc7_);
      }

      // --------------------------------------------- "Item 2 of 5", buttons

      private function jrPopupRect() : Rectangle
      {
         var _loc1_:Rectangle = null;
         var _loc2_:Array = ["setCostBtn","closeBtn","upBtn","downBtn","item_name_txt","options","numTxt"];
         var _loc3_:String = null;
         var _loc4_:DisplayObject = null;
         for each(_loc3_ in _loc2_)
         {
            try
            {
               _loc4_ = _shop.setItemCostCont[_loc3_] as DisplayObject;
               if(_loc4_ != null)
               {
                  _loc1_ = _loc1_ == null ? _loc4_.getBounds(_shop.setItemCostCont) : _loc1_.union(_loc4_.getBounds(_shop.setItemCostCont));
               }
            }
            catch(e:Error)
            {
            }
         }
         return _loc1_ != null ? _loc1_ : new Rectangle(0,0,300,200);
      }

      private function jrShowExtras() : void
      {
         var _loc1_:Rectangle = null;
         var _loc2_:int = 0;
         var _loc3_:int = 0;
         var _loc4_:Number = NaN;
         if(_jrQueue == null)
         {
            jrHideExtras();
            return;
         }
         try
         {
            if(_jrBtns == null)
            {
               _jrBtns = new Dictionary(true);
            }
            _loc1_ = jrPopupRect();
            if(_jrCountBox == null)
            {
               _jrCountBox = new Sprite();
               _jrCountBox.mouseEnabled = false;
               _jrCountBox.mouseChildren = false;
               _jrCountTxt = new TextField();
               _jrCountTxt.defaultTextFormat = new TextFormat("Arial",14,16777215,true);
               _jrCountTxt.selectable = false;
               _jrCountTxt.autoSize = TextFieldAutoSize.LEFT;
               _jrCountBox.addChild(_jrCountTxt);
            }
            _jrCountTxt.text = "Item " + _jrDone + " of " + _jrTotal;
            _jrCountTxt.x = 12;
            _jrCountTxt.y = 4;
            _jrCountBox.graphics.clear();
            _jrCountBox.graphics.beginFill(3055166,0.95);
            _jrCountBox.graphics.drawRoundRect(0,0,_jrCountTxt.width + 24,28,12,12);
            _jrCountBox.graphics.endFill();
            _jrCountBox.x = Math.round(_loc1_.x + (_loc1_.width - _jrCountBox.width) / 2);
            _jrCountBox.y = Math.round(_loc1_.y - 34);
            _shop.setItemCostCont.addChild(_jrCountBox);
            _jrCountBox.visible = true;
            _loc2_ = jrSameCount();
            _loc3_ = _jrQueue.length;
            if(_jrSameBtn != null && _jrSameBtn.parent != null)
            {
               _jrSameBtn.parent.removeChild(_jrSameBtn);
            }
            if(_jrAllBtn != null && _jrAllBtn.parent != null)
            {
               _jrAllBtn.parent.removeChild(_jrAllBtn);
            }
            _jrSameBtn = _loc2_ > 0 ? jrButton("Price match same (" + _loc2_ + " more)",onJrSameDown) : null;
            _jrAllBtn = _loc3_ > 0 ? jrButton("Price match all (" + _loc3_ + " more)",onJrAllDown) : null;
            _loc4_ = (_jrSameBtn != null ? _jrSameBtn.width : 0) + (_jrAllBtn != null ? _jrAllBtn.width : 0) + (_jrSameBtn != null && _jrAllBtn != null ? 8 : 0);
            _loc4_ = _loc1_.x + (_loc1_.width - _loc4_) / 2;
            if(_jrSameBtn != null)
            {
               _jrSameBtn.x = Math.round(_loc4_);
               _jrSameBtn.y = Math.round(_loc1_.bottom + 8);
               _shop.setItemCostCont.addChild(_jrSameBtn);
               _loc4_ += _jrSameBtn.width + 8;
            }
            if(_jrAllBtn != null)
            {
               _jrAllBtn.x = Math.round(_loc4_);
               _jrAllBtn.y = Math.round(_loc1_.bottom + 8);
               _shop.setItemCostCont.addChild(_jrAllBtn);
            }
         }
         catch(e:Error)
         {
         }
      }

      private function jrHideExtras() : void
      {
         if(_jrCountBox != null)
         {
            _jrCountBox.visible = false;
         }
         if(_jrSameBtn != null && _jrSameBtn.parent != null)
         {
            _jrSameBtn.parent.removeChild(_jrSameBtn);
         }
         if(_jrAllBtn != null && _jrAllBtn.parent != null)
         {
            _jrAllBtn.parent.removeChild(_jrAllBtn);
         }
         _jrSameBtn = null;
         _jrAllBtn = null;
      }

      private function onJrSameDown(param1:MouseEvent) : void
      {
         jrMatch(false);
      }

      private function onJrAllDown(param1:MouseEvent) : void
      {
         jrMatch(true);
      }

      private function jrLighten(param1:uint) : uint
      {
         var _loc2_:uint = Math.min(255,(param1 >> 16 & 0xFF) + 28);
         var _loc3_:uint = Math.min(255,(param1 >> 8 & 0xFF) + 28);
         var _loc4_:uint = Math.min(255,(param1 & 0xFF) + 28);
         return _loc2_ << 16 | _loc3_ << 8 | _loc4_;
      }

      // A blue game button face, like JR's own buttons.
      private function jrFace(param1:Graphics, param2:Number, param3:Number, param4:Boolean) : void
      {
         var _loc5_:Matrix = new Matrix();
         var _loc6_:uint = 0x93DEF8;
         var _loc7_:uint = 0x2B98D6;
         param1.clear();
         param1.lineStyle(2,0x16598A,1,true);
         _loc5_.createGradientBox(param2,param3,Math.PI / 2,0,0);
         param1.beginGradientFill(GradientType.LINEAR,param4 ? [jrLighten(_loc6_),jrLighten(_loc7_)] : [_loc6_,_loc7_],[1,1],[0,255],_loc5_);
         param1.drawRoundRect(0,0,param2,param3,22,22);
         param1.endFill();
         param1.lineStyle(0,0,0);
         param1.beginFill(0xFFFFFF,0.35);
         param1.drawRoundRect(3,2,param2 - 6,param3 * 0.42,15,15);
         param1.endFill();
      }

      private function jrButton(param1:String, param2:Function) : Sprite
      {
         var _loc3_:Sprite = new Sprite();
         var _loc4_:TextField = new TextField();
         var _loc5_:Number = NaN;
         _loc4_.defaultTextFormat = new TextFormat("Arial",13,0xFFFFFF,true);
         _loc4_.selectable = false;
         _loc4_.mouseEnabled = false;
         _loc4_.autoSize = TextFieldAutoSize.LEFT;
         _loc4_.text = param1;
         _loc4_.filters = [new GlowFilter(0x16598A,1,3,3,8,2)];
         _loc5_ = Math.ceil(_loc4_.width) + 24;
         _jrBtns[_loc3_] = {
            "w":_loc5_,
            "act":param2
         };
         jrFace(_loc3_.graphics,_loc5_,28,false);
         _loc4_.x = 12;
         _loc4_.y = Math.round((28 - _loc4_.height) / 2);
         _loc3_.addChild(_loc4_);
         _loc3_.buttonMode = true;
         _loc3_.useHandCursor = true;
         _loc3_.mouseChildren = false;
         _loc3_.addEventListener(MouseEvent.ROLL_OVER,onJrBtnOver);
         _loc3_.addEventListener(MouseEvent.ROLL_OUT,onJrBtnOut);
         _loc3_.addEventListener(MouseEvent.MOUSE_DOWN,onJrBtnDown);
         return _loc3_;
      }

      private function onJrBtnOver(param1:MouseEvent) : void
      {
         var _loc2_:Sprite = param1.currentTarget as Sprite;
         if(_loc2_ != null && _jrBtns[_loc2_] != null)
         {
            jrFace(_loc2_.graphics,Number(_jrBtns[_loc2_].w),28,true);
         }
      }

      private function onJrBtnOut(param1:MouseEvent) : void
      {
         var _loc2_:Sprite = param1.currentTarget as Sprite;
         if(_loc2_ != null && _jrBtns[_loc2_] != null)
         {
            jrFace(_loc2_.graphics,Number(_jrBtns[_loc2_].w),28,false);
         }
      }

      private function onJrBtnDown(param1:MouseEvent) : void
      {
         var _loc2_:Object = _jrBtns[param1.currentTarget];
         var _loc3_:Function = null;
         param1.stopPropagation();
         if(_loc2_ != null)
         {
            _loc3_ = _loc2_.act as Function;
         }
         if(_loc3_ != null && !_jrAsking)
         {
            _loc3_(param1);
         }
      }
'''

edit('shop/ShopToSell.as', [
    ('   import flash.filters.GlowFilter;\n', SHOP_IMPORTS),
    ('      private var _myShopItemsNameHigh:Vector.<MyShopItem>;\n', SHOP_VARS),
    # the picker may hand over several items
    ('''      private function onChooseItemsClose(param1:Iitem) : void
      {
         if(param1)
         {
            displaySetCostPopup(param1);
         }
''', '''      private function onChooseItemsClose(param1:Object) : void
      {
         if(param1 is Array)
         {
            jrStartBatch(param1 as Array);
         }
         else if(param1)
         {
            displaySetCostPopup(param1 as Iitem);
         }
'''),
    # each popup of a batch starts at the price just set
    ('''         _costTypeRadioBtns.selected = _itemCurrentlyBeingUpdated ? (_itemCurrentlyBeingUpdated.currencyType == 3 ? 1 : 0) : 1;''',
     '''         _costTypeRadioBtns.selected = _itemCurrentlyBeingUpdated ? (_itemCurrentlyBeingUpdated.currencyType == 3 ? 1 : 0) : (jrBatchPrice() ? (_jrLastCurrency == 3 ? 1 : 0) : 1);'''),
    ('''         _shop.setItemCostCont.numTxt.text = _itemCurrentlyBeingUpdated ? _itemCurrentlyBeingUpdated.cost : (_costTypeRadioBtns.selected == 1 ? 1 : 50);''',
     '''         _shop.setItemCostCont.numTxt.text = _itemCurrentlyBeingUpdated ? _itemCurrentlyBeingUpdated.cost : (jrBatchPrice() ? _jrLastCost : (_costTypeRadioBtns.selected == 1 ? 1 : 50));'''),
    # typed price, "Item 2 of 5" and the match buttons
    ('''         _shop.setItemCostCont.visible = true;
      }
''', '''         _shop.setItemCostCont.visible = true;
         jrPopupExtras();
      }
'''),
    # Set: round first if needed, remember the price for the next popup
    ('''         param1.stopPropagation();
         if(_itemCurrentlyBeingUpdated)
         {
            if(_modifiedItems == null)
''', '''         param1.stopPropagation();
         if(jrPriceCheck(0))
         {
            return;
         }
         _jrSetting = true;
         _jrLastCost = int(_shop.setItemCostCont.numTxt.text);
         _jrLastCurrency = _costTypeRadioBtns.selected == 1 ? 3 : 0;
         if(_itemCurrentlyBeingUpdated)
         {
            if(_modifiedItems == null)
'''),
    ('''         _selectedItem = null;
         _shop.setItemCostCont.visible = false;
      }
''', '''         _selectedItem = null;
         _shop.setItemCostCont.visible = false;
         jrAfterClose();
      }
'''),
    ('''      private function setPriceTag() : void
''', SHOP_FUNCS + '''
      private function setPriceTag() : void
'''),
])
