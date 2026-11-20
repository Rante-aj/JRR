# The game's recycle screen (gui.RecycleItems): a search box, JR's sort list
# (the same one the inventory uses) and Shift+click to pick a whole range.
# JR's Presets button stays where JR puts it: on the popup's top bar, left of
# the close button (src/game/surfaces/index.js: recycle pos "left").
#
# Runs from patch.py after anchors.py, with patch.py's `edit` helper, so the
# anchor line JR adds to this screen is already there.
#
# How picks work: the game keeps its picks by position in the list on screen
# (_itemsToRecycle, keyed by window index). Search and sort change that list,
# so JR keeps the picks by item (invIdx) in _jrPicked and rebuilds the game's
# own _itemsToRecycle from them for whatever the list shows. Pressing Recycle
# while a search hides some picks clears the search first, so the game's
# confirm popup and recycle request always cover every pick.

RECYCLE_IMPORTS = '''   import flash.events.MouseEvent;
   import flash.display.DisplayObject;
   import flash.display.GradientType;
   import flash.display.Graphics;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.KeyboardEvent;
   import flash.events.TimerEvent;
   import flash.filters.GlowFilter;
   import flash.geom.Matrix;
   import flash.geom.Point;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFieldType;
   import flash.text.TextFormat;
   import flash.ui.Keyboard;
   import flash.utils.Dictionary;
   import flash.utils.Timer;
'''

RECYCLE_VARS = '''      private var _onRecycleSuccessCallback:Function;

      // ------------------------------------------------------------ JR
      // Search, sort and Shift+click (functions at the end of the class).

      private static const JR_BAR_H:int = 30;

      // [JR sort key, short label]; keys are the ones JR's sort list uses.
      private static const JR_SORTS:Array = [["newest","Newest"],["oldest","Oldest"],["az","A to Z"],["za","Z to A"],["worth","Worth high"],["worthlow","Worth low"],["rare","Rares"],["diamond","Diamonds"],["members","Members"],["dupes","Copies"],["color","Color"]];

      private static var _jrSortKey:String = "newest";

      private var _jrAll:Array;

      private var _jrPicked:Object;

      private var _jrLast:int = -1;

      private var _jrLastPick:Boolean = true;

      private var _jrBar:Sprite;

      private var _jrSearch:TextField;

      private var _jrHint:TextField;

      private var _jrClear:Sprite;

      private var _jrSortBtn:Sprite;

      private var _jrSortPrefix:Boolean = true;

      private var _jrHelp:Sprite;

      private var _jrBtns:Dictionary;

      private var _jrTimer:Timer;

      private var _jrMarkQueued:Boolean = false;
'''

RECYCLE_FUNCS = r'''      // ------------------------------------------------------------ JR
      // The toolbar over the top of the item list: [?] [search] [Sort].

      private function jrSetup() : void
      {
         var _loc1_:DisplayObject = null;
         var _loc2_:Point = null;
         var _loc3_:Number = NaN;
         var _loc4_:Sprite = null;
         var _loc5_:Number = NaN;
         var _loc6_:Number = NaN;
         var _loc7_:Number = NaN;
         var _loc8_:DisplayObject = null;
         try
         {
            _loc1_ = _recyclePopup.itemBlock as DisplayObject;
            if(_loc1_ == null)
            {
               return;
            }
            _jrBtns = new Dictionary(true);
            _loc2_ = _recyclePopup.globalToLocal(_loc1_.localToGlobal(new Point(0,0)));
            _loc3_ = _loc1_.width;
            _jrBar = new Sprite();
            _jrBar.name = "jrRecycleBar";
            _jrBar.x = Math.round(_loc2_.x);
            _jrBar.y = Math.round(_loc2_.y);
            _jrBar.graphics.lineStyle(1,0xD9BF8C,1,true);
            _jrBar.graphics.beginFill(0xF7EBCD,1);
            _jrBar.graphics.drawRoundRect(0,0,_loc3_,JR_BAR_H - 2,10,10);
            _jrBar.graphics.endFill();
            _jrBar.addEventListener(MouseEvent.MOUSE_DOWN,onJrBarDown);
            // ? : how Shift+click works
            _jrHelp = jrButton("?",22,22,null);
            _jrHelp.x = 4;
            _jrHelp.y = Math.round((JR_BAR_H - 2 - 22) / 2);
            _jrHelp.addEventListener(MouseEvent.ROLL_OVER,onJrHelpOver);
            _jrHelp.addEventListener(MouseEvent.ROLL_OUT,onJrHelpOut);
            _jrBar.addChild(_jrHelp);
            // Sort at the right end, sized for its longest label; search fills the rest
            _loc5_ = _jrHelp.x + 22 + 6;
            _loc6_ = jrSortWidth(true);
            _loc7_ = _loc3_ - 4 - _loc6_ - 6 - _loc5_;
            if(_loc7_ < 120)
            {
               _jrSortPrefix = false;
               _loc6_ = jrSortWidth(false);
               _loc7_ = _loc3_ - 4 - _loc6_ - 6 - _loc5_;
            }
            _jrSortBtn = jrButton(jrSortLabel(_jrSortKey,_jrSortPrefix),_loc6_,24,onJrSortDown);
            _jrSortBtn.x = Math.round(_loc5_ + Math.max(40,_loc7_) + 6);
            _jrSortBtn.y = Math.round((JR_BAR_H - 2 - 24) / 2);
            _jrBar.addChild(_jrSortBtn);
            // search box
            _loc4_ = new Sprite();
            _loc4_.graphics.lineStyle(1,0x8A6434,1,true);
            _loc4_.graphics.beginFill(0xFFFFFF,1);
            _loc4_.graphics.drawRoundRect(0,0,Math.max(40,_loc7_),22,10,10);
            _loc4_.graphics.endFill();
            _loc4_.x = Math.round(_loc5_);
            _loc4_.y = Math.round((JR_BAR_H - 2 - 22) / 2);
            _loc4_.addEventListener(MouseEvent.MOUSE_DOWN,onJrBoxDown);
            _jrHint = jrText("Search items",11,0x8C6A48,false);
            _jrHint.x = 6;
            _jrHint.y = Math.round((22 - _jrHint.height) / 2);
            _jrHint.autoSize = TextFieldAutoSize.NONE;
            _jrHint.width = Math.max(20,Math.max(40,_loc7_) - 26);
            _loc4_.addChild(_jrHint);
            _jrSearch = new TextField();
            _jrSearch.defaultTextFormat = new TextFormat("Verdana",11,0x4B2A12);
            _jrSearch.type = TextFieldType.INPUT;
            _jrSearch.maxChars = 40;
            _jrSearch.multiline = false;
            _jrSearch.x = 5;
            _jrSearch.y = 2;
            _jrSearch.width = Math.max(20,Math.max(40,_loc7_) - 26);
            _jrSearch.height = 18;
            _jrSearch.addEventListener(Event.CHANGE,onJrSearchChange);
            _jrSearch.addEventListener(KeyboardEvent.KEY_DOWN,onJrSearchKey);
            _jrSearch.addEventListener(KeyboardEvent.KEY_UP,onJrSwallowKey);
            _loc4_.addChild(_jrSearch);
            _jrClear = new Sprite();
            _jrClear.graphics.beginFill(0xB97E43,1);
            _jrClear.graphics.drawCircle(8,8,8);
            _jrClear.graphics.endFill();
            _jrClear.graphics.lineStyle(2,0xFFFFFF,1,true);
            _jrClear.graphics.moveTo(5,5);
            _jrClear.graphics.lineTo(11,11);
            _jrClear.graphics.moveTo(11,5);
            _jrClear.graphics.lineTo(5,11);
            _jrClear.x = Math.max(40,_loc7_) - 19;
            _jrClear.y = 3;
            _jrClear.buttonMode = true;
            _jrClear.useHandCursor = true;
            _jrClear.visible = false;
            _jrClear.addEventListener(MouseEvent.MOUSE_DOWN,onJrClearDown);
            _loc4_.addChild(_jrClear);
            _jrBar.addChild(_loc4_);
            _jrTimer = new Timer(250,1);
            _jrTimer.addEventListener(TimerEvent.TIMER_COMPLETE,onJrSearchTimer);
            // under the confirm popup: just above the item list
            _loc8_ = _loc1_;
            while(_loc8_.parent != null && _loc8_.parent != _recyclePopup)
            {
               _loc8_ = _loc8_.parent;
            }
            if(_loc8_.parent == _recyclePopup)
            {
               _recyclePopup.addChildAt(_jrBar,_recyclePopup.getChildIndex(_loc8_) + 1);
            }
            else
            {
               _recyclePopup.addChild(_jrBar);
            }
            _loc1_.addEventListener(Event.ADDED,onJrListChanged);
            _loc1_.addEventListener(MouseEvent.MOUSE_WHEEL,onJrListChanged);
            _loc1_.addEventListener(MouseEvent.MOUSE_UP,onJrListChanged);
         }
         catch(e:Error)
         {
            if(_jrBar != null && _jrBar.parent != null)
            {
               _jrBar.parent.removeChild(_jrBar);
            }
            _jrBar = null;
            _jrSortBtn = null;
            _jrSearch = null;
         }
      }

      private function jrTeardown() : void
      {
         XtReplyDemuxer.jrSortMenuClose();
         if(_jrTimer != null)
         {
            _jrTimer.stop();
            _jrTimer.removeEventListener(TimerEvent.TIMER_COMPLETE,onJrSearchTimer);
            _jrTimer = null;
         }
         if(_jrBar != null)
         {
            _jrBar.removeEventListener(Event.ENTER_FRAME,onJrMarkFrame);
         }
         _jrMarkQueued = false;
         try
         {
            _recyclePopup.itemBlock.removeEventListener(Event.ADDED,onJrListChanged);
            _recyclePopup.itemBlock.removeEventListener(MouseEvent.MOUSE_WHEEL,onJrListChanged);
            _recyclePopup.itemBlock.removeEventListener(MouseEvent.MOUSE_UP,onJrListChanged);
         }
         catch(e:Error)
         {
         }
      }

      private function jrBarH() : int
      {
         return _jrBar != null ? JR_BAR_H : 0;
      }

      private function jrText(param1:String, param2:int, param3:uint, param4:Boolean) : TextField
      {
         var _loc5_:TextField = new TextField();
         _loc5_.defaultTextFormat = new TextFormat("Verdana",param2,param3,param4);
         _loc5_.selectable = false;
         _loc5_.mouseEnabled = false;
         _loc5_.autoSize = TextFieldAutoSize.LEFT;
         _loc5_.text = param1;
         return _loc5_;
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
         var _loc6_:Number = Math.min(param3,22);
         var _loc7_:uint = 0x93DEF8;
         var _loc8_:uint = 0x2B98D6;
         param1.clear();
         param1.lineStyle(2,0x16598A,1,true);
         _loc5_.createGradientBox(param2,param3,Math.PI / 2,0,0);
         param1.beginGradientFill(GradientType.LINEAR,param4 ? [jrLighten(_loc7_),jrLighten(_loc8_)] : [_loc7_,_loc8_],[1,1],[0,255],_loc5_);
         param1.drawRoundRect(0,0,param2,param3,_loc6_,_loc6_);
         param1.endFill();
         param1.lineStyle(0,0,0);
         param1.beginFill(0xFFFFFF,0.35);
         param1.drawRoundRect(3,2,param2 - 6,param3 * 0.42,_loc6_ * 0.7,_loc6_ * 0.7);
         param1.endFill();
      }

      private function jrButton(param1:String, param2:Number, param3:Number, param4:Function) : Sprite
      {
         var _loc5_:Sprite = new Sprite();
         var _loc6_:TextField = jrText(param1,11,0xFFFFFF,true);
         _loc6_.filters = [new GlowFilter(0x16598A,1,3,3,8,2)];
         _loc6_.name = "label";
         _jrBtns[_loc5_] = {
            "w":param2,
            "h":param3,
            "act":param4
         };
         jrFace(_loc5_.graphics,param2,param3,false);
         _loc6_.x = Math.round((param2 - _loc6_.width) / 2);
         _loc6_.y = Math.round((param3 - _loc6_.height) / 2);
         _loc5_.addChild(_loc6_);
         _loc5_.buttonMode = true;
         _loc5_.useHandCursor = true;
         _loc5_.mouseChildren = false;
         _loc5_.addEventListener(MouseEvent.ROLL_OVER,onJrBtnOver);
         _loc5_.addEventListener(MouseEvent.ROLL_OUT,onJrBtnOut);
         _loc5_.addEventListener(MouseEvent.MOUSE_DOWN,onJrBtnDown);
         return _loc5_;
      }

      private function onJrBtnOver(param1:MouseEvent) : void
      {
         var _loc2_:Sprite = param1.currentTarget as Sprite;
         var _loc3_:Object = _loc2_ != null ? _jrBtns[_loc2_] : null;
         if(_loc3_ != null)
         {
            jrFace(_loc2_.graphics,Number(_loc3_.w),Number(_loc3_.h),true);
         }
      }

      private function onJrBtnOut(param1:MouseEvent) : void
      {
         var _loc2_:Sprite = param1.currentTarget as Sprite;
         var _loc3_:Object = _loc2_ != null ? _jrBtns[_loc2_] : null;
         if(_loc3_ != null)
         {
            jrFace(_loc2_.graphics,Number(_loc3_.w),Number(_loc3_.h),false);
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
         if(_loc3_ != null)
         {
            _loc3_(param1);
         }
      }

      private function onJrBarDown(param1:MouseEvent) : void
      {
         param1.stopPropagation();
         XtReplyDemuxer.jrSortMenuClose();
      }

      private function onJrHelpOver(param1:MouseEvent) : void
      {
         var _loc2_:Point = null;
         try
         {
            _loc2_ = _jrHelp.localToGlobal(new Point(0,24));
            _loc2_ = GuiManager.guiLayer.globalToLocal(_loc2_);
            GuiManager.toolTip.init(GuiManager.guiLayer,"Shift+click: pick a whole range",_loc2_.x,_loc2_.y);
            GuiManager.toolTip.startTimer(param1);
         }
         catch(e:Error)
         {
         }
      }

      private function onJrHelpOut(param1:MouseEvent) : void
      {
         try
         {
            GuiManager.toolTip.resetTimerAndSetVisibility();
         }
         catch(e:Error)
         {
         }
      }

      // --------------------------------------------------------------- sort

      private function jrSortLabel(param1:String, param2:Boolean) : String
      {
         var _loc3_:Array = null;
         var _loc4_:String = "Newest";
         for each(_loc3_ in JR_SORTS)
         {
            if(String(_loc3_[0]) == param1)
            {
               _loc4_ = String(_loc3_[1]);
            }
         }
         return param2 ? "Sort: " + _loc4_ : _loc4_;
      }

      private function jrSortWidth(param1:Boolean) : Number
      {
         var _loc2_:Array = null;
         var _loc3_:Number = 0;
         for each(_loc2_ in JR_SORTS)
         {
            _loc3_ = Math.max(_loc3_,jrText(jrSortLabel(String(_loc2_[0]),param1),11,0,true).width);
         }
         return Math.ceil(_loc3_) + 20;
      }

      private function onJrSortDown(param1:MouseEvent) : void
      {
         XtReplyDemuxer.jrSortMenu(_jrSortBtn,_jrSortKey,jrApplySort);
      }

      private function jrApplySort(param1:String) : void
      {
         var _loc2_:TextField = null;
         if(_jrSortBtn == null)
         {
            return;
         }
         _jrSortKey = param1;
         _loc2_ = _jrSortBtn.getChildByName("label") as TextField;
         if(_loc2_ != null)
         {
            _loc2_.text = jrSortLabel(_jrSortKey,_jrSortPrefix);
            _loc2_.x = Math.round((Number(_jrBtns[_jrSortBtn].w) - _loc2_.width) / 2);
         }
         jrApplyView(true);
      }

      // ------------------------------------------------------------- search

      private function onJrBoxDown(param1:MouseEvent) : void
      {
         param1.stopPropagation();
         XtReplyDemuxer.jrSortMenuClose();
         if(_jrSearch != null && _jrSearch.stage != null)
         {
            _jrSearch.stage.focus = _jrSearch;
         }
      }

      private function onJrSearchChange(param1:Event) : void
      {
         jrSearchLooks();
         if(_jrTimer != null)
         {
            _jrTimer.reset();
            _jrTimer.start();
         }
      }

      private function onJrSearchTimer(param1:TimerEvent) : void
      {
         jrApplyView(true);
      }

      private function onJrSearchKey(param1:KeyboardEvent) : void
      {
         param1.stopPropagation();
         if(param1.keyCode == Keyboard.ESCAPE)
         {
            jrClearSearch();
         }
         else if(param1.keyCode == Keyboard.ENTER)
         {
            if(_jrTimer != null)
            {
               _jrTimer.reset();
            }
            jrApplyView(true);
         }
      }

      private function onJrSwallowKey(param1:KeyboardEvent) : void
      {
         param1.stopPropagation();
      }

      private function onJrClearDown(param1:MouseEvent) : void
      {
         param1.stopPropagation();
         jrClearSearch();
      }

      private function jrSearchLooks() : void
      {
         var _loc1_:Boolean = _jrSearch != null && _jrSearch.text != "";
         if(_jrHint != null)
         {
            _jrHint.visible = !_loc1_;
         }
         if(_jrClear != null)
         {
            _jrClear.visible = _loc1_;
         }
      }

      private function jrClearSearch() : void
      {
         if(_jrSearch == null || _jrSearch.text == "")
         {
            return;
         }
         _jrSearch.text = "";
         jrSearchLooks();
         if(_jrTimer != null)
         {
            _jrTimer.reset();
         }
         jrApplyView(true);
      }

      // --------------------------------------------------------------- list

      // What the list shows: every item, sorted, then the search (all words).
      private function jrView() : Array
      {
         var _loc1_:Array = XtReplyDemuxer.jrSortItems(_jrAll,_jrSortKey);
         var _loc2_:String = _jrSearch != null ? _jrSearch.text.toLowerCase() : "";
         var _loc3_:Array = [];
         var _loc4_:Array = [];
         var _loc5_:String = null;
         var _loc6_:Object = null;
         var _loc7_:String = null;
         var _loc8_:Boolean = false;
         for each(_loc5_ in _loc2_.split(" "))
         {
            if(_loc5_ != "")
            {
               _loc4_.push(_loc5_);
            }
         }
         if(_loc4_.length == 0)
         {
            return _loc1_;
         }
         for each(_loc6_ in _loc1_)
         {
            try
            {
               _loc7_ = Iitem(_loc6_).name != null ? String(Iitem(_loc6_).name).toLowerCase() : "";
            }
            catch(e:Error)
            {
               _loc7_ = "";
            }
            _loc8_ = true;
            for each(_loc5_ in _loc4_)
            {
               if(_loc7_.indexOf(_loc5_) < 0)
               {
                  _loc8_ = false;
                  break;
               }
            }
            if(_loc8_)
            {
               _loc3_.push(_loc6_);
            }
         }
         return _loc3_;
      }

      // fillInventory has just filled _recycleInventory, in the game's order.
      private function jrInitList() : void
      {
         if(_recycleInventory == null)
         {
            return;
         }
         _jrAll = _recycleInventory.getCoreArray().concat();
         _jrPicked = {};
         _jrLast = -1;
         if(_jrBar != null && (_jrSortKey != "newest" || _jrSearch != null && _jrSearch.text != ""))
         {
            _recycleInventory = new IitemCollection(jrView());
         }
      }

      private function jrApplyView(param1:Boolean) : void
      {
         if(_jrAll == null || _recyclePopup == null)
         {
            return;
         }
         if(!param1 && _itemWindows != null)
         {
            _scrollValue = _itemWindows.scrollYValue;
         }
         else
         {
            _scrollValue = 0;
         }
         _recycleInventory = new IitemCollection(jrView());
         _jrLast = -1;
         if(_itemWindows != null)
         {
            _itemWindows.destroy();
            _itemWindows = null;
         }
         createWindows();
         jrSync();
         jrQueueMark();
      }

      // The game's own picks for what is on screen, the value and the button.
      private function jrSync() : void
      {
         var _loc1_:Array = _recycleInventory.getCoreArray();
         var _loc2_:int = 0;
         var _loc3_:Iitem = null;
         var _loc4_:Object = null;
         var _loc5_:int = 0;
         var _loc6_:int = 0;
         _itemsToRecycle = new SetDictionary();
         while(_loc2_ < _loc1_.length)
         {
            _loc3_ = _loc1_[_loc2_] as Iitem;
            if(_loc3_ != null && _jrPicked[String(_loc3_.invIdx)] == true)
            {
               _itemsToRecycle.insertKey(_loc2_,_loc3_.clone());
            }
            _loc2_++;
         }
         for each(_loc4_ in _jrAll)
         {
            _loc3_ = _loc4_ as Iitem;
            if(_loc3_ != null && _jrPicked[String(_loc3_.invIdx)] == true)
            {
               _loc5_ += _loc3_.recycleValue as int;
               _loc6_++;
            }
         }
         _recycleTotal = _loc5_;
         _recyclePopup.currencyToolTip.text = Utility.convertNumberToString(_recycleTotal);
         _recyclePopup.recycleBtn.activateGrayState(_loc6_ == 0);
      }

      // A click on an item. Plain: pick or unpick it. Shift: do the same to
      // everything between the last plain click and this one.
      private function jrClick(param1:ItemWindowOriginal, param2:Boolean) : Boolean
      {
         var _loc3_:Iitem = null;
         var _loc4_:Array = null;
         var _loc5_:int = 0;
         var _loc6_:int = 0;
         var _loc7_:int = 0;
         var _loc8_:Iitem = null;
         var _loc9_:String = null;
         var _loc10_:Object = null;
         if(_jrAll == null || _jrPicked == null || param1 == null)
         {
            return false;
         }
         _loc3_ = param1.currItem as Iitem;
         if(_loc3_ == null)
         {
            return false;
         }
         XtReplyDemuxer.jrSortMenuClose();
         _loc4_ = _recycleInventory.getCoreArray();
         _loc5_ = int(param1.index);
         if(param2 && _jrLast >= 0 && _jrLast < _loc4_.length && _jrLast != _loc5_)
         {
            _loc6_ = Math.min(_jrLast,_loc5_);
            _loc7_ = Math.max(_jrLast,_loc5_);
            _loc10_ = jrKeepSafe();
            while(_loc6_ <= _loc7_)
            {
               _loc8_ = _loc4_[_loc6_] as Iitem;
               if(_loc8_ != null && _loc8_.isApproved && (!_jrLastPick || _loc10_[String(_loc8_.invIdx)] != true))
               {
                  if(_jrLastPick)
                  {
                     _jrPicked[String(_loc8_.invIdx)] = true;
                  }
                  else
                  {
                     delete _jrPicked[String(_loc8_.invIdx)];
                  }
               }
               _loc6_++;
            }
         }
         else
         {
            if(!_loc3_.isApproved)
            {
               new SBOkPopup(_popupLayer,LocalizationManager.translateIdOnly(25196));
               return true;
            }
            _loc9_ = String(_loc3_.invIdx);
            if(_jrPicked[_loc9_] == true)
            {
               delete _jrPicked[_loc9_];
               _jrLastPick = false;
            }
            else
            {
               _jrPicked[_loc9_] = true;
               _jrLastPick = true;
            }
            _jrLast = _loc5_;
         }
         jrSync();
         jrMarkAll(param1);
         return true;
      }

      // Items a Shift+click range never picks (a plain click still can, as in
      // the game): worn ones, ones in a den shop, den shops themselves, and
      // ones on your trade list. invIdx -> true.
      private function jrKeepSafe() : Object
      {
         var _loc1_:Object = {};
         var _loc2_:Object = null;
         var _loc3_:Iitem = null;
         var _loc4_:TradeItemCollection = null;
         var _loc5_:int = 0;
         var _loc6_:int = _itemRecycleId == 0 || _itemRecycleId == 5 || _itemRecycleId == 6 ? 0 : 1;
         jrInUse(Object(_itemWindows) as DisplayObjectContainer,_loc1_,0);
         for each(_loc2_ in _jrAll)
         {
            _loc3_ = _loc2_ as Iitem;
            try
            {
               if(_loc3_ != null && (_loc3_.isInDenShop || _loc3_.denStoreInvId > 0 || _loc3_ is DenItem && (_loc3_ as DenItem).specialType == 5))
               {
                  _loc1_[String(_loc3_.invIdx)] = true;
               }
            }
            catch(e:Error)
            {
            }
         }
         try
         {
            _loc4_ = gMainFrame.userInfo.getMyTradeList();
            while(_loc4_ != null && _loc5_ < _loc4_.length)
            {
               if(_loc4_.getTradeItem(_loc5_).itemType == _loc6_)
               {
                  _loc1_[String(_loc4_.getTradeItem(_loc5_).invIdx)] = true;
               }
               _loc5_++;
            }
         }
         catch(e2:Error)
         {
         }
         return _loc1_;
      }

      private function jrInUse(param1:DisplayObjectContainer, param2:Object, param3:int) : void
      {
         var _loc4_:int = 0;
         var _loc5_:DisplayObject = null;
         var _loc6_:ItemWindowOriginal = null;
         if(param1 == null)
         {
            return;
         }
         while(_loc4_ < param1.numChildren)
         {
            _loc5_ = param1.getChildAt(_loc4_);
            _loc6_ = _loc5_ as ItemWindowOriginal;
            if(_loc6_ != null)
            {
               try
               {
                  if(_loc6_.isInUse && _loc6_.currItem is Iitem)
                  {
                     param2[String(Iitem(_loc6_.currItem).invIdx)] = true;
                  }
               }
               catch(e:Error)
               {
               }
            }
            else if(_loc5_ is DisplayObjectContainer && param3 < 4)
            {
               jrInUse(_loc5_ as DisplayObjectContainer,param2,param3 + 1);
            }
            _loc4_++;
         }
      }

      // Recycle pressed: if the search hides some picks, show everything so
      // the game's confirm popup and request include them.
      private function jrShowAllPicked() : void
      {
         var _loc1_:Object = {};
         var _loc2_:Object = null;
         var _loc3_:Iitem = null;
         var _loc4_:String = null;
         if(_jrAll == null || _jrSearch == null || _jrSearch.text == "")
         {
            return;
         }
         for each(_loc2_ in _recycleInventory.getCoreArray())
         {
            _loc3_ = _loc2_ as Iitem;
            if(_loc3_ != null)
            {
               _loc1_[String(_loc3_.invIdx)] = true;
            }
         }
         for(_loc4_ in _jrPicked)
         {
            if(_loc1_[_loc4_] != true)
            {
               _jrSearch.text = "";
               jrSearchLooks();
               if(_jrTimer != null)
               {
                  _jrTimer.reset();
               }
               jrApplyView(true);
               return;
            }
         }
      }

      // The game has removed the recycled items from the list on screen.
      private function jrAfterRecycle() : void
      {
         var _loc1_:Array = [];
         var _loc2_:Object = null;
         var _loc3_:Iitem = null;
         if(_jrAll == null)
         {
            return;
         }
         for each(_loc2_ in _jrAll)
         {
            _loc3_ = _loc2_ as Iitem;
            if(_loc3_ == null || _jrPicked[String(_loc3_.invIdx)] != true)
            {
               _loc1_.push(_loc2_);
            }
         }
         _jrAll = _loc1_;
         _jrPicked = {};
         _jrLast = -1;
      }

      // ------------------------------------------------------- highlighting
      // The game's own green frames, on every item window, after any change.

      private function onJrListChanged(param1:Event) : void
      {
         jrQueueMark();
      }

      private function jrQueueMark() : void
      {
         if(_jrBar == null)
         {
            jrMarkAll(null);
            return;
         }
         if(!_jrMarkQueued)
         {
            _jrMarkQueued = true;
            _jrBar.addEventListener(Event.ENTER_FRAME,onJrMarkFrame);
         }
      }

      private function onJrMarkFrame(param1:Event) : void
      {
         _jrBar.removeEventListener(Event.ENTER_FRAME,onJrMarkFrame);
         _jrMarkQueued = false;
         jrMarkAll(null);
      }

      private function jrMarkAll(param1:ItemWindowOriginal) : void
      {
         if(_itemWindows == null || _jrPicked == null)
         {
            return;
         }
         jrMarkIn(Object(_itemWindows) as DisplayObjectContainer,param1,0);
      }

      private function jrMarkIn(param1:DisplayObjectContainer, param2:ItemWindowOriginal, param3:int) : void
      {
         var _loc4_:int = 0;
         var _loc5_:DisplayObject = null;
         if(param1 == null)
         {
            return;
         }
         while(_loc4_ < param1.numChildren)
         {
            _loc5_ = param1.getChildAt(_loc4_);
            if(_loc5_ is ItemWindowOriginal)
            {
               jrMarkOne(_loc5_ as ItemWindowOriginal,param2);
            }
            else if(_loc5_ is DisplayObjectContainer && param3 < 4)
            {
               jrMarkIn(_loc5_ as DisplayObjectContainer,param2,param3 + 1);
            }
            _loc4_++;
         }
      }

      private function jrMarkOne(param1:ItemWindowOriginal, param2:ItemWindowOriginal) : void
      {
         var _loc3_:Iitem = null;
         var _loc4_:Boolean = false;
         var _loc5_:String = null;
         var _loc6_:Boolean = false;
         try
         {
            _loc3_ = param1.currItem as Iitem;
            if(_loc3_ == null || param1.cir == null)
            {
               return;
            }
            _loc4_ = _jrPicked[String(_loc3_.invIdx)] == true;
            _loc5_ = param1.cir.currentFrameLabel;
            _loc6_ = _loc5_ == "green" || _loc5_ == "greenMouse";
            if(_loc4_ && !_loc6_)
            {
               param1.cir.gotoAndStop(param1 == param2 || _loc5_ == "over" || _loc5_ == "downMouse" ? "greenMouse" : "green");
            }
            else if(!_loc4_ && _loc6_)
            {
               param1.cir.gotoAndStop(param1.isInUse ? "down" : "up");
            }
         }
         catch(e:Error)
         {
         }
      }

      private function confirmRemoveEventListeners() : void
'''

edit('gui/RecycleItems.as', [
    # imports
    ('   import flash.events.MouseEvent;\n', RECYCLE_IMPORTS),
    # state
    ('      private var _onRecycleSuccessCallback:Function;\n', RECYCLE_VARS),
    # the list remembers every item once the game has filled it
    ('         createWindows();\n      }\n      \n      private function createWindows() : void\n',
     '         if(!param1)\n         {\n            jrInitList();\n         }\n         createWindows();\n         jrQueueMark();\n'
     '      }\n      \n      private function createWindows() : void\n'),
    # the list starts under the toolbar
    ('         _itemWindows.init(_recyclePopup.itemBlock.width,_recyclePopup.itemBlock.height,4,',
     '         _itemWindows.init(_recyclePopup.itemBlock.width,_recyclePopup.itemBlock.height - jrBarH(),4,'),
    ('         _recyclePopup.itemBlock.addChild(_itemWindows);\n',
     '         _recyclePopup.itemBlock.addChild(_itemWindows);\n         _itemWindows.y = jrBarH();\n'),
    # clicks: picks by item, Shift for ranges
    ('            _loc2_ = param1.currentTarget as ItemWindowOriginal;\n            if((_loc2_.currItem as Iitem).isApproved)\n',
     '            _loc2_ = param1.currentTarget as ItemWindowOriginal;\n'
     '            if(jrClick(_loc2_,param1.shiftKey))\n            {\n               return;\n            }\n'
     '            if((_loc2_.currItem as Iitem).isApproved)\n'),
    # Recycle shows every pick, even ones the search hides
    ('         param1.stopPropagation();\n         if(!param1.currentTarget.isGray)\n',
     '         param1.stopPropagation();\n         jrShowAllPicked();\n         if(!param1.currentTarget.isGray)\n'),
    # after recycling, forget the recycled items
    ('            _recyclePopup.recycleBtn.activateGrayState(true);\n         }\n      }\n      \n      public function setOnRecycleSuccessCallback',
     '            _recyclePopup.recycleBtn.activateGrayState(true);\n            jrAfterRecycle();\n         }\n      }\n      \n      public function setOnRecycleSuccessCallback'),
    # toolbar (JR's Presets button keeps its place by the close button)
    ('         XtReplyDemuxer.jrAnchor("recycle",_recyclePopup.bx.parent,_recyclePopup.bx);\n',
     '         jrSetup();\n'
     '         XtReplyDemuxer.jrAnchor("recycle",_recyclePopup.bx.parent,_recyclePopup.bx);\n'),
    ('         _recyclePopup.recycleBtn.removeEventListener("mouseDown",onRecycleBtn);\n',
     '         _recyclePopup.recycleBtn.removeEventListener("mouseDown",onRecycleBtn);\n         jrTeardown();\n'),
    ('      private function confirmRemoveEventListeners() : void\n', RECYCLE_FUNCS),
])
