# Starred players, run from patch.py after anchors.py: `edit` is patch.py's.
#
# - Player card (buddy.BuddyCard): a star and a "..." button over the left end
#   of the card's name plate. The star stars the player and opens the note;
#   "..." opens the note (title, 60 characters, and a description: JRStarNote).
# - Buddy list (buddy.BuddyList): tabs "Buddies" and "Starred (N)" over the
#   list; the Starred tab lists starred players with their note title (a green
#   dot for buddies online). A row opens the player's card; the pencil opens
#   the note. "All accounts" / "This account" switches what is shown.
# - Name tags (avatar.NameBar): a gold star in the level badge's place at the
#   left end of a starred player's tag (the level is hidden while starred).
#   Stars are updated without touching the tag's text, and JR's own name
#   refresh now keeps the game's choice of animal name or user name.
# Kept on this computer (SharedObject "jrStars", like jrTrueColors), shared by
# all accounts; each star remembers which accounts starred the player. Nothing
# is sent anywhere.

STAR_IMPORTS_OLD = '   import avatar.NameBar;\n'
STAR_IMPORTS_NEW = '   import avatar.NameBar;\n   import buddy.Buddy;\n   import buddy.BuddyManager;\n   import flash.display.Graphics;\n'

STAR_API = r'''      // ------------------------------------------------------------ stars
      // Starred players (classes JRStarCard, JRStarNote, JRStarTabs at the end
      // of this file). Kept in SharedObject "jrStars": {stars: {lowercase
      // name: {n: name, t: title, d: description, by: {account: 1}, at: time}},
      // mine: show only this account's stars}.

      private static var _jrStars:Object = null;

      private static var _jrStarMineOnly:Boolean = false;

      private static var _jrStarTabs:JRStarTabs;

      private static var _jrStarNote:JRStarNote;

      private static var _jrStarCardUi:JRStarCard;

      private static function jrStarData() : Object
      {
         var _loc1_:SharedObject = null;
         if(_jrStars == null)
         {
            _jrStars = {};
            try
            {
               _loc1_ = SharedObject.getLocal("jrStars","/");
               if(_loc1_.data.stars)
               {
                  _jrStars = _loc1_.data.stars;
               }
               _jrStarMineOnly = _loc1_.data.mine == true;
            }
            catch(e:Error)
            {
            }
         }
         return _jrStars;
      }

      private static function jrStarFlush() : void
      {
         var _loc1_:SharedObject = null;
         try
         {
            _loc1_ = SharedObject.getLocal("jrStars","/");
            _loc1_.data.stars = jrStarData();
            _loc1_.data.mine = _jrStarMineOnly;
            _loc1_.flush();
         }
         catch(e:Error)
         {
         }
      }

      public static function jrStarMe() : String
      {
         try
         {
            return String(gMainFrame.userInfo.myUserName || "").toLowerCase();
         }
         catch(e:Error)
         {
         }
         return "";
      }

      public static function jrStarEntry(param1:String) : Object
      {
         var _loc2_:Object = jrStarData()[String(param1 || "").toLowerCase()];
         return _loc2_ != null ? _loc2_ : null;
      }

      // 2: starred by this account, 1: by another account only, 0: not starred.
      public static function jrStarState(param1:String) : int
      {
         var _loc2_:Object = jrStarEntry(param1);
         var _loc3_:String = null;
         if(_loc2_ == null || _loc2_.by == null)
         {
            return 0;
         }
         if(_loc2_.by[jrStarMe()])
         {
            return 2;
         }
         for(_loc3_ in _loc2_.by)
         {
            return 1;
         }
         return 0;
      }

      public static function jrStarShown(param1:String) : Boolean
      {
         var _loc2_:int = jrStarState(param1);
         return _loc2_ == 2 || _loc2_ == 1 && !_jrStarMineOnly;
      }

      public static function jrStarMineOnly() : Boolean
      {
         jrStarData();
         return _jrStarMineOnly;
      }

      public static function jrStarSetMineOnly(param1:Boolean) : void
      {
         jrStarData();
         _jrStarMineOnly = param1;
         jrStarFlush();
         jrStarChanged();
      }

      // Star (or unstar) a player for this account. A star nobody keeps any
      // more is removed with its note.
      public static function jrStarSet(param1:String, param2:Boolean) : void
      {
         var _loc3_:Object = jrStarData();
         var _loc4_:String = String(param1 || "").toLowerCase();
         var _loc5_:Object = _loc3_[_loc4_];
         var _loc6_:String = jrStarMe();
         var _loc7_:String = null;
         var _loc8_:Boolean = false;
         if(_loc4_ == "")
         {
            return;
         }
         if(param2)
         {
            if(_loc5_ == null)
            {
               _loc5_ = {
                  "n":param1,
                  "t":"",
                  "d":"",
                  "by":{},
                  "at":new Date().time
               };
               _loc3_[_loc4_] = _loc5_;
            }
            if(_loc5_.by == null)
            {
               _loc5_.by = {};
            }
            _loc5_.by[_loc6_] = 1;
         }
         else if(_loc5_ != null)
         {
            if(_loc5_.by != null)
            {
               delete _loc5_.by[_loc6_];
               for(_loc7_ in _loc5_.by)
               {
                  _loc8_ = true;
               }
            }
            if(!_loc8_)
            {
               delete _loc3_[_loc4_];
            }
         }
         jrStarFlush();
         jrStarChanged();
      }

      // Save a note; writing a note stars the player for this account.
      public static function jrStarSaveNote(param1:String, param2:String, param3:String) : void
      {
         var _loc4_:Object = null;
         if(jrStarState(param1) != 2)
         {
            jrStarSet(param1,true);
         }
         _loc4_ = jrStarEntry(param1);
         if(_loc4_ == null)
         {
            return;
         }
         _loc4_.t = String(param2 || "").substr(0,60);
         if(param3 != null)
         {
            _loc4_.d = String(param3).substr(0,1000);
         }
         jrStarFlush();
         jrStarChanged();
      }

      public static function jrStarChanged() : void
      {
         try
         {
            NameBar.jrStarRefreshAll();
         }
         catch(e:Error)
         {
         }
         if(_jrStarTabs)
         {
            _jrStarTabs.refresh();
         }
         if(_jrStarCardUi && _jrStarCardUi.stage)
         {
            _jrStarCardUi.refresh();
         }
      }

      // The stars shown now, by name: [{n, t, d, mine}].
      public static function jrStarList() : Array
      {
         var _loc1_:Object = jrStarData();
         var _loc2_:String = null;
         var _loc3_:Array = [];
         for(_loc2_ in _loc1_)
         {
            if(jrStarShown(_loc2_))
            {
               _loc3_.push({
                  "k":_loc2_,
                  "n":String(_loc1_[_loc2_].n || _loc2_),
                  "t":String(_loc1_[_loc2_].t || ""),
                  "d":String(_loc1_[_loc2_].d || "")
               });
            }
         }
         _loc3_.sortOn("k");
         return _loc3_;
      }

      // 1: a buddy online, 0: a buddy offline, -1: not a buddy.
      public static function jrStarOnline(param1:String) : int
      {
         var _loc2_:Buddy = null;
         try
         {
            _loc2_ = BuddyManager.getBuddyByUserName(param1);
            if(_loc2_ != null)
            {
               return _loc2_.isOnline ? 1 : 0;
            }
         }
         catch(e:Error)
         {
         }
         return -1;
      }

      public static function jrStarOpenCard(param1:String) : void
      {
         try
         {
            BuddyManager.showBuddyCard({
               "userName":param1,
               "onlineStatus":Math.max(0,jrStarOnline(param1))
            });
         }
         catch(e:Error)
         {
         }
      }

      public static function jrStarOpenNote(param1:String, param2:Object) : void
      {
         var _loc3_:Stage = param2 is Stage ? Stage(param2) : (param2 is DisplayObject ? DisplayObject(param2).stage : _jrStage);
         if(_loc3_ == null)
         {
            return;
         }
         if(_jrStarNote == null)
         {
            _jrStarNote = new JRStarNote();
         }
         _jrStarNote.open(_loc3_,param1);
      }

      // The player card: a star and "..." over the left end of its name plate
      // (param3: the name text field, which spans the plate). The card's own
      // member name bar gets no star of its own (param5).
      public static function jrStarCard(param1:Object, param2:String, param3:Object, param4:Object, param5:Object = null) : void
      {
         var _loc5_:DisplayObjectContainer = param1 as DisplayObjectContainer;
         var _loc6_:JRStarCard = null;
         var _loc7_:Rectangle = null;
         var _loc8_:DisplayObject = null;
         try
         {
            if(_loc5_ == null || !param2)
            {
               return;
            }
            if(param5 is NameBar)
            {
               NameBar(param5).jrNoStar = true;
            }
            _loc8_ = _loc5_.getChildByName("jrStarCard");
            if(_loc8_)
            {
               _loc5_.removeChild(_loc8_);
            }
            _loc6_ = new JRStarCard(param2);
            _loc8_ = param3 as DisplayObject;
            _loc7_ = _loc8_ != null ? _loc8_.getBounds(_loc5_) : new Rectangle(0,0,200,30);
            _loc6_.x = Math.round(_loc7_.x + 6);
            _loc6_.y = Math.round(_loc7_.y + (_loc7_.height - _loc6_.height) / 2);
            _loc5_.addChild(_loc6_);
            _jrStarCardUi = _loc6_;
         }
         catch(e:Error)
         {
         }
      }

      // The buddy list: tabs and the Starred list, over its item block.
      public static function jrStarTabs(param1:Object) : void
      {
         var _loc2_:DisplayObjectContainer = param1 as DisplayObjectContainer;
         try
         {
            if(_loc2_ == null || param1.itemBlock == null)
            {
               return;
            }
            if(_jrStarTabs && _jrStarTabs.parent)
            {
               _jrStarTabs.parent.removeChild(_jrStarTabs);
            }
            _jrStarTabs = new JRStarTabs(param1.itemBlock as DisplayObject);
            _loc2_.addChild(_jrStarTabs);
         }
         catch(e:Error)
         {
            _jrStarTabs = null;
         }
      }

      public static function jrStarTabsH() : int
      {
         return _jrStarTabs != null ? JRStarTabs.H : 0;
      }

      // The game rebuilt its buddy list: hide it again if Starred is open.
      public static function jrStarTabsSync(param1:Object) : void
      {
         if(_jrStarTabs)
         {
            _jrStarTabs.sync(param1 as DisplayObject);
         }
      }

      // A star shape; param2: 2 gold, 1 pale gold (another account), 0 empty.
      public static function jrStarIcon(param1:Number, param2:int = 2) : Sprite
      {
         var _loc3_:Sprite = new Sprite();
         jrStarDraw(_loc3_.graphics,param1,param2);
         _loc3_.mouseEnabled = false;
         return _loc3_;
      }

      public static function jrStarDraw(param1:Graphics, param2:Number, param3:int) : void
      {
         var _loc4_:int = 0;
         var _loc5_:Number = param2 / 2;
         var _loc6_:Number = NaN;
         var _loc7_:Number = NaN;
         param1.clear();
         param1.lineStyle(Math.max(1,param2 / 12),param3 == 0 ? 0x8C6A48 : 0x9A6400,1,true);
         param1.beginFill(param3 == 2 ? 0xFFD23F : (param3 == 1 ? 0xFFEFA8 : 0xFFFFFF),param3 == 0 ? 0.6 : 1);
         while(_loc4_ < 10)
         {
            _loc6_ = (_loc4_ % 2 == 0 ? _loc5_ : _loc5_ * 0.45);
            _loc7_ = -Math.PI / 2 + _loc4_ * Math.PI / 5;
            if(_loc4_ == 0)
            {
               param1.moveTo(_loc5_ + Math.cos(_loc7_) * _loc6_,_loc5_ + Math.sin(_loc7_) * _loc6_);
            }
            else
            {
               param1.lineTo(_loc5_ + Math.cos(_loc7_) * _loc6_,_loc5_ + Math.sin(_loc7_) * _loc6_);
            }
            _loc4_++;
         }
         param1.endFill();
      }

'''

STAR_CLASSES = r'''import flash.display.Graphics;

// Starred players: the star and "..." over a player card's name plate. The
// star stars the player (for this account) and opens the note; "..." opens
// the note (saving a note stars them too).
class JRStarCard extends Sprite
{
   private var _name:String;
   private var _star:Sprite;

   public function JRStarCard(param1:String)
   {
      super();
      _name = param1;
      name = "jrStarCard";
      addEventListener(MouseEvent.MOUSE_DOWN,swallow);
      _star = new Sprite();
      _star.buttonMode = true;
      _star.useHandCursor = true;
      // no yellow focus box when clicked
      _star.focusRect = false;
      _star.tabEnabled = false;
      focusRect = false;
      tabEnabled = false;
      tabChildren = false;
      _star.addEventListener(MouseEvent.MOUSE_DOWN,onStar);
      addChild(_star);
      var _loc2_:JRPill = new JRPill("...","more",onMore,"normal",28,10);
      _loc2_.x = 28;
      _loc2_.y = Math.round((24 - _loc2_.height) / 2);
      addChild(_loc2_);
      refresh();
   }

   public function refresh() : void
   {
      XtReplyDemuxer.jrStarDraw(_star.graphics,24,XtReplyDemuxer.jrStarState(_name));
      // a bigger invisible hit area, with no outline (the star's outline
      // style is still set from drawing the star)
      _star.graphics.lineStyle(0,0,0);
      _star.graphics.beginFill(0xFFFFFF,0.01);
      _star.graphics.drawRect(-2,-2,28,28);
      _star.graphics.endFill();
   }

   private function swallow(param1:Event) : void
   {
      param1.stopPropagation();
   }

   private function onStar(param1:MouseEvent) : void
   {
      param1.stopPropagation();
      if(XtReplyDemuxer.jrStarState(_name) != 2)
      {
         XtReplyDemuxer.jrStarSet(_name,true);
      }
      refresh();
      XtReplyDemuxer.jrStarOpenNote(_name,this);
   }

   private function onMore(param1:Object) : void
   {
      XtReplyDemuxer.jrStarOpenNote(_name,this);
   }
}

// Starred players: the note (title and description). Enter in the title
// saves, Esc closes without saving.
class JRStarNote extends Sprite
{
   private static const W:Number = 360;
   private static const HT:Number = 300;
   private var _name:String;
   private var _veil:Sprite;
   private var _box:Sprite;
   private var _head:TextField;
   private var _title:TextField;
   private var _desc:TextField;

   public function JRStarNote()
   {
      super();
      _veil = new Sprite();
      _veil.addEventListener(MouseEvent.MOUSE_DOWN,swallow);
      addChild(_veil);
      _box = new Sprite();
      JRStyle.frame(_box.graphics,W,HT);
      _box.filters = [new DropShadowFilter(4,90,0,0.5,14,14,1,2)];
      _box.addEventListener(MouseEvent.MOUSE_DOWN,swallow);
      addChild(_box);
      _head = JRStyle.field("",14,JRStyle.WOOD_DARK,true,W - 70);
      _head.x = 50;
      _head.y = 20;
      _box.addChild(_head);
      var _loc1_:Sprite = XtReplyDemuxer.jrStarIcon(24,2);
      _loc1_.x = 20;
      _loc1_.y = 18;
      _box.addChild(_loc1_);
      var _loc2_:TextField = JRStyle.field("Title (up to 60 characters)",11,JRStyle.DIM,false);
      _loc2_.x = 22;
      _loc2_.y = 50;
      _box.addChild(_loc2_);
      _title = input(22,68,W - 44,24,false,60);
      var _loc3_:TextField = JRStyle.field("Description",11,JRStyle.DIM,false);
      _loc3_.x = 22;
      _loc3_.y = 100;
      _box.addChild(_loc3_);
      _desc = input(22,118,W - 44,124,true,1000);
      var _loc4_:JRPill = new JRPill("Save","save",onSave,"primary",90,12);
      _loc4_.x = W - 22 - 90;
      _loc4_.y = HT - 46;
      _box.addChild(_loc4_);
      var _loc5_:JRPill = new JRPill("Cancel","cancel",onCancel,"plain",90,12);
      _loc5_.x = W - 22 - 90 - 8 - 90;
      _loc5_.y = HT - 46;
      _box.addChild(_loc5_);
      var _loc6_:JRPill = new JRPill("Unstar","unstar",onUnstar,"danger",80,12);
      _loc6_.x = 22;
      _loc6_.y = HT - 46;
      _box.addChild(_loc6_);
   }

   private function input(param1:Number, param2:Number, param3:Number, param4:Number, param5:Boolean, param6:int) : TextField
   {
      var _loc7_:Sprite = new Sprite();
      _loc7_.graphics.lineStyle(1,JRStyle.ROW_EDGE,1,true);
      _loc7_.graphics.beginFill(0xFFFFFF,1);
      _loc7_.graphics.drawRoundRect(0,0,param3,param4,8,8);
      _loc7_.graphics.endFill();
      _loc7_.x = param1;
      _loc7_.y = param2;
      _box.addChild(_loc7_);
      var _loc8_:TextField = new TextField();
      _loc8_.defaultTextFormat = new TextFormat("Verdana",12,JRStyle.TEXT);
      _loc8_.type = TextFieldType.INPUT;
      _loc8_.maxChars = param6;
      _loc8_.multiline = param5;
      _loc8_.wordWrap = param5;
      _loc8_.x = param1 + 5;
      _loc8_.y = param2 + 4;
      _loc8_.width = param3 - 10;
      _loc8_.height = param4 - 8;
      _loc8_.addEventListener(KeyboardEvent.KEY_DOWN,onKey);
      _loc8_.addEventListener(KeyboardEvent.KEY_UP,swallow);
      _box.addChild(_loc8_);
      return _loc8_;
   }

   public function open(param1:Stage, param2:String) : void
   {
      var _loc3_:Object = XtReplyDemuxer.jrStarEntry(param2);
      _name = param2;
      _head.text = param2;
      _title.text = _loc3_ != null ? String(_loc3_.t || "") : "";
      _desc.text = _loc3_ != null ? String(_loc3_.d || "") : "";
      _veil.graphics.clear();
      _veil.graphics.beginFill(0,0.35);
      _veil.graphics.drawRect(0,0,param1.stageWidth,param1.stageHeight);
      _veil.graphics.endFill();
      _box.x = Math.round((param1.stageWidth - W) / 2);
      _box.y = Math.round((param1.stageHeight - HT) / 2);
      param1.addChild(this);
      param1.focus = _title;
      _title.setSelection(0,_title.text.length);
   }

   private function close() : void
   {
      if(stage)
      {
         stage.focus = null;
      }
      if(parent)
      {
         parent.removeChild(this);
      }
   }

   private function swallow(param1:Event) : void
   {
      param1.stopPropagation();
   }

   private function onKey(param1:KeyboardEvent) : void
   {
      param1.stopPropagation();
      if(param1.keyCode == 27)
      {
         close();
      }
      else if(param1.keyCode == 13 && param1.currentTarget == _title)
      {
         onSave(null);
      }
   }

   private function onSave(param1:Object) : void
   {
      XtReplyDemuxer.jrStarSaveNote(_name,_title.text,_desc.text);
      XtReplyDemuxer.jrStarChanged();
      close();
   }

   private function onCancel(param1:Object) : void
   {
      close();
   }

   private function onUnstar(param1:Object) : void
   {
      XtReplyDemuxer.jrStarSet(_name,false);
      close();
   }
}

// Starred players: tabs over the buddy list, and the Starred list in its
// place. The game's own list is only hidden while Starred is open.
class JRStarTabs extends Sprite
{
   public static const H:int = 28;
   private static const ROW:int = 36;
   private var _block:DisplayObject;
   private var _w:Number;
   private var _h:Number;
   private var _starred:Boolean = false;
   private var _tabs:Sprite;
   private var _view:Sprite;
   private var _rows:Sprite;
   private var _mask:Shape;
   private var _foot:Sprite;
   private var _gameList:DisplayObject;
   private var _bar:Sprite;
   private var _thumb:Sprite;
   private var _thumbH:Number = 0;
   private var _dragOff:Number = 0;

   public function JRStarTabs(param1:DisplayObject)
   {
      super();
      _block = param1;
      name = "jrStarTabs";
      x = Math.round(param1.x);
      y = Math.round(param1.y);
      _w = param1.width;
      _h = param1.height;
      _tabs = new Sprite();
      addChild(_tabs);
      _view = new Sprite();
      _view.y = H;
      _view.visible = false;
      _view.addEventListener(MouseEvent.MOUSE_WHEEL,onWheel);
      _view.addEventListener(MouseEvent.MOUSE_DOWN,swallow);
      addChild(_view);
      _view.graphics.beginFill(JRStyle.PARCH,1);
      _view.graphics.drawRect(0,0,_w,_h - H);
      _view.graphics.endFill();
      _rows = new Sprite();
      _view.addChild(_rows);
      _mask = new Shape();
      _mask.graphics.beginFill(0,1);
      _mask.graphics.drawRect(0,0,_w,_h - H - 34);
      _mask.graphics.endFill();
      _view.addChild(_mask);
      _rows.mask = _mask;
      _foot = new Sprite();
      _foot.y = _h - H - 32;
      _view.addChild(_foot);
      drawTabs();
   }

   private function swallow(param1:Event) : void
   {
      param1.stopPropagation();
   }

   private function drawTabs() : void
   {
      var _loc1_:JRPill = null;
      var _loc2_:JRPill = null;
      var _loc3_:Number = Math.floor((_w - 6) / 2);
      while(_tabs.numChildren > 0)
      {
         _tabs.removeChildAt(0);
      }
      _loc1_ = new JRPill("Buddies","buddies",onTab,_starred ? "plain" : "primary",_loc3_,11);
      _loc2_ = new JRPill("Starred (" + XtReplyDemuxer.jrStarList().length + ")","starred",onTab,_starred ? "primary" : "plain",_loc3_,11);
      _loc1_.y = _loc2_.y = 1;
      _loc2_.x = _loc3_ + 6;
      _tabs.addChild(_loc1_);
      _tabs.addChild(_loc2_);
   }

   private function onTab(param1:Object) : void
   {
      _starred = String(param1.key) == "starred";
      refresh();
   }

   public function sync(param1:DisplayObject) : void
   {
      if(param1 != null)
      {
         _gameList = param1;
      }
      if(_gameList != null)
      {
         _gameList.visible = !_starred;
      }
   }

   public function refresh() : void
   {
      drawTabs();
      sync(null);
      _view.visible = _starred;
      if(_starred)
      {
         drawRows();
      }
      if(parent)
      {
         parent.setChildIndex(this,parent.numChildren - 1);
      }
   }

   private function viewH() : Number
   {
      return _h - H - 34;
   }

   // One line: cut with "..." when too wide.
   private function oneLine(param1:String, param2:int, param3:uint, param4:Boolean, param5:Number) : TextField
   {
      var _loc6_:TextField = JRStyle.field(param1,param2,param3,param4);
      var _loc7_:String = param1;
      while(_loc6_.textWidth > param5 && _loc7_.length > 1)
      {
         _loc7_ = _loc7_.substr(0,_loc7_.length - 1);
         _loc6_.text = _loc7_ + "...";
      }
      return _loc6_;
   }

   // Rows: gold = starred on this account, parchment = another account only.
   private function drawRows() : void
   {
      var _loc1_:Array = XtReplyDemuxer.jrStarList();
      var _loc2_:int = 0;
      var _loc3_:Object = null;
      var _loc4_:Sprite = null;
      var _loc5_:TextField = null;
      var _loc6_:TextField = null;
      var _loc7_:JRPill = null;
      var _loc8_:int = 0;
      var _loc10_:JRPill = null;
      var _loc11_:Boolean = _loc1_.length * ROW > viewH();
      var _loc12_:Number = _loc11_ ? _w - 18 : _w;
      var _loc13_:Boolean = false;
      while(_rows.numChildren > 0)
      {
         _rows.removeChildAt(0);
      }
      _rows.y = 0;
      if(_loc1_.length == 0)
      {
         _loc5_ = JRStyle.field(XtReplyDemuxer.jrStarMineOnly() ? "No stars on this account yet. Open a player's card and press the star." : "No starred players yet. Open a player's card and press the star.",12,JRStyle.DIM,false,_w - 24,"center");
         _loc5_.x = 12;
         _loc5_.y = 20;
         _rows.addChild(_loc5_);
      }
      while(_loc2_ < _loc1_.length)
      {
         _loc3_ = _loc1_[_loc2_];
         _loc13_ = XtReplyDemuxer.jrStarState(String(_loc3_.n)) == 2;
         _loc4_ = new Sprite();
         _loc4_.name = String(_loc3_.n);
         _loc4_.y = _loc2_ * ROW;
         _loc4_.graphics.beginFill(_loc13_ ? 0xFFE9A8 : 0xF4ECDD,1);
         _loc4_.graphics.drawRect(0,0,_loc12_,ROW - 1);
         _loc4_.graphics.endFill();
         _loc4_.graphics.beginFill(JRStyle.ROW_EDGE,1);
         _loc4_.graphics.drawRect(0,ROW - 1,_loc12_,1);
         _loc4_.graphics.endFill();
         _loc4_.buttonMode = true;
         _loc4_.useHandCursor = true;
         _loc4_.addEventListener(MouseEvent.MOUSE_DOWN,onRow);
         _loc8_ = XtReplyDemuxer.jrStarOnline(String(_loc3_.n));
         if(_loc8_ >= 0)
         {
            _loc4_.graphics.beginFill(_loc8_ == 1 ? JRStyle.OK : 0xB0A08A,1);
            _loc4_.graphics.drawCircle(_loc12_ - 50,ROW / 2,4);
            _loc4_.graphics.endFill();
         }
         _loc5_ = oneLine(String(_loc3_.n),12,JRStyle.TEXT,true,_loc12_ - 72);
         _loc5_.x = 8;
         _loc5_.y = 2;
         _loc4_.addChild(_loc5_);
         _loc6_ = oneLine(String(_loc3_.t) != "" ? String(_loc3_.t) : "(no note)",10,JRStyle.DIM,false,_loc12_ - 72);
         _loc6_.x = 8;
         _loc6_.y = 19;
         _loc4_.addChild(_loc6_);
         _loc7_ = new JRPill("Note","note:" + String(_loc3_.n),onNote,"normal",36,10);
         _loc7_.x = _loc12_ - 40;
         _loc7_.y = Math.round((ROW - _loc7_.height) / 2);
         _loc4_.addChild(_loc7_);
         _rows.addChild(_loc4_);
         _loc2_++;
      }
      drawBar(_loc11_);
      while(_foot.numChildren > 0)
      {
         _foot.removeChildAt(0);
      }
      _loc10_ = new JRPill(XtReplyDemuxer.jrStarMineOnly() ? "Showing: this account" : "Showing: all accounts","mine",onMine,"normal",_w - 12,11);
      _loc10_.x = 6;
      _foot.addChild(_loc10_);
   }

   // ------------------------------------------------- scrollbar
   private function drawBar(param1:Boolean) : void
   {
      var _loc2_:Number = viewH();
      if(_bar == null)
      {
         _bar = new Sprite();
         _bar.addEventListener(MouseEvent.MOUSE_DOWN,onTrack);
         _thumb = new Sprite();
         _thumb.buttonMode = true;
         _thumb.useHandCursor = true;
         _thumb.addEventListener(MouseEvent.MOUSE_DOWN,onThumb);
         _bar.addChild(_thumb);
         _view.addChild(_bar);
      }
      _bar.visible = param1;
      if(!param1)
      {
         return;
      }
      _bar.x = _w - 15;
      _bar.graphics.clear();
      _bar.graphics.lineStyle(1,JRStyle.ROW_EDGE,1,true);
      _bar.graphics.beginFill(0xEADFC6,1);
      _bar.graphics.drawRoundRect(0,0,14,_loc2_,12,12);
      _bar.graphics.endFill();
      _thumbH = Math.max(28,Math.round(_loc2_ * _loc2_ / Math.max(1,_rows.height)));
      JRStyle.face(_thumb.graphics,14,_thumbH,JRStyle.colors("normal"),false);
      syncThumb();
   }

   private function maxScroll() : Number
   {
      return Math.max(0,_rows.height - viewH());
   }

   private function scrollTo(param1:Number) : void
   {
      _rows.y = -Math.max(0,Math.min(maxScroll(),param1));
      syncThumb();
   }

   private function syncThumb() : void
   {
      var _loc1_:Number = maxScroll();
      if(_thumb == null)
      {
         return;
      }
      _thumb.y = _loc1_ > 0 ? Math.round(-_rows.y / _loc1_ * (viewH() - _thumbH)) : 0;
   }

   private function onThumb(param1:MouseEvent) : void
   {
      param1.stopPropagation();
      _dragOff = _bar.mouseY - _thumb.y;
      if(stage)
      {
         stage.addEventListener(MouseEvent.MOUSE_MOVE,onDrag);
         stage.addEventListener(MouseEvent.MOUSE_UP,onDrop);
      }
   }

   private function onDrag(param1:MouseEvent) : void
   {
      var _loc2_:Number = viewH() - _thumbH;
      var _loc3_:Number = Math.max(0,Math.min(_loc2_,_bar.mouseY - _dragOff));
      scrollTo(_loc2_ > 0 ? _loc3_ / _loc2_ * maxScroll() : 0);
   }

   private function onDrop(param1:MouseEvent) : void
   {
      if(stage)
      {
         stage.removeEventListener(MouseEvent.MOUSE_MOVE,onDrag);
         stage.removeEventListener(MouseEvent.MOUSE_UP,onDrop);
      }
   }

   // A click on the track moves a page towards the click.
   private function onTrack(param1:MouseEvent) : void
   {
      param1.stopPropagation();
      if(param1.target == _bar)
      {
         scrollTo(-_rows.y + (_bar.mouseY < _thumb.y ? -viewH() : viewH()));
      }
   }

   private function onRow(param1:MouseEvent) : void
   {
      param1.stopPropagation();
      XtReplyDemuxer.jrStarOpenCard(DisplayObject(param1.currentTarget).name);
   }

   private function onNote(param1:Object) : void
   {
      XtReplyDemuxer.jrStarOpenNote(String(param1.key).substr(5),this);
   }

   private function onMine(param1:Object) : void
   {
      XtReplyDemuxer.jrStarSetMineOnly(!XtReplyDemuxer.jrStarMineOnly());
   }

   private function onWheel(param1:MouseEvent) : void
   {
      param1.stopPropagation();
      scrollTo(-_rows.y + (param1.delta > 0 ? -ROW : ROW));
   }
}

'''

edit('XtReplyDemuxer.as', [
    (STAR_IMPORTS_OLD, STAR_IMPORTS_NEW),
    ('      public static function jrAnchor(param1:String, param2:Object, param3:Object, param4:Object = null) : void\n',
     STAR_API + '      public static function jrAnchor(param1:String, param2:Object, param3:Object, param4:Object = null) : void\n'),
    ('// A short message at the top of the game, on a parchment banner.\nclass JRToast extends Sprite\n',
     STAR_CLASSES + '// A short message at the top of the game, on a parchment banner.\nclass JRToast extends Sprite\n'),
])

# The player card: the star strip, once the card is on screen.
edit('buddy/BuddyCard.as', [
    ('         _buddyCardMC.x = 690;\n         _buddyCardMC.y = 165;\n',
     '         _buddyCardMC.x = 690;\n         _buddyCardMC.y = 165;\n'
     '         XtReplyDemuxer.jrStarCard(_buddyCardMC,_currUserName,userNameTxt,closeBtn,memberNameBar);\n'),
])

# The buddy list: tabs over the list; the game's list starts under them.
edit('buddy/BuddyList.as', [
    ('         _loadingSpiral = new LoadingSpiral(DisplayObjectContainer(_buddyListPopup.content),-15);\n',
     '         _loadingSpiral = new LoadingSpiral(DisplayObjectContainer(_buddyListPopup.content),-15);\n'
     '         XtReplyDemuxer.jrStarTabs(_buddyListPopup.content);\n'),
    ('         _itemWindowBuddyList.init((_buddyListPopup.content as MovieClip).itemBlock.width,(_buddyListPopup.content as MovieClip).itemBlock.height,',
     '         _itemWindowBuddyList.init((_buddyListPopup.content as MovieClip).itemBlock.width,(_buddyListPopup.content as MovieClip).itemBlock.height - XtReplyDemuxer.jrStarTabsH(),'),
    ('         (_buddyListPopup.content as MovieClip).itemBlock.addChild(_itemWindowBuddyList);\n      }\n',
     '         (_buddyListPopup.content as MovieClip).itemBlock.addChild(_itemWindowBuddyList);\n'
     '         _itemWindowBuddyList.y = XtReplyDemuxer.jrStarTabsH();\n'
     '         XtReplyDemuxer.jrStarTabsSync(_itemWindowBuddyList);\n      }\n'),
])

# Name tags: a star left of a starred player's tag (JR's name bars keep the
# real user name in _jrReal and are all refreshed by jrRefreshAll).
NAMEBAR_STAR = '''
      private var _jrStar:Sprite;

      private var _jrStarHid:Boolean = false;

      // The card's own name bar: the card has its own star.
      public var jrNoStar:Boolean = false;

      // Stars only: the tags' text is left as the game set it.
      public static function jrStarRefreshAll() : void
      {
         var _loc1_:Object = null;
         for(_loc1_ in _jrBars)
         {
            if(_loc1_ is NameBar)
            {
               NameBar(_loc1_).jrStarMark();
            }
         }
      }

      // The star takes the level badge's place (left end of the tag): the
      // level is hidden while the player is starred.
      public function jrStarMark() : void
      {
         var _loc1_:Boolean = false;
         var _loc2_:DisplayObject = null;
         var _loc3_:Rectangle = null;
         var _loc4_:Number = 16;
         try
         {
            _loc1_ = !jrNoStar && _jrReal != null && _jrReal != "" && XtReplyDemuxer.jrStarShown(_jrReal);
            if(_shape && _shape.mouse)
            {
               if(_loc1_ || _jrStarHid)
               {
                  _shape.mouse.up.icon.visible = !_loc1_;
                  _shape.mouse.mouse.icon.visible = !_loc1_;
               }
               _jrStarHid = _loc1_;
            }
            if(!_loc1_)
            {
               if(_jrStar)
               {
                  _jrStar.visible = false;
               }
               return;
            }
            // as big as a level badge: a bit taller than the tag, centred
            // on its left end (or on the level badge, when there is one)
            _loc2_ = _mid.parent != this ? _mid.parent : _mid;
            _loc4_ = Math.max(22,Math.min(34,_loc2_.getBounds(this).height * 1.35));
            _loc2_ = _left.parent != this ? _left.parent : _left;
            _loc3_ = _loc2_.getBounds(this);
            _loc3_ = new Rectangle(_loc3_.x + _loc3_.width / 2 - 1,(_mid.parent != this ? _mid.parent : _mid).getBounds(this).y + (_mid.parent != this ? _mid.parent : _mid).getBounds(this).height / 2 - 1,2,2);
            if(_shape && _shape.mouse && _shape.mouse.up.icon.numChildren > 0)
            {
               _loc3_ = (_shape.mouse.up.icon as DisplayObject).getBounds(this);
               _loc4_ = Math.max(_loc4_,Math.min(36,_loc3_.height * 1.1));
            }
            if(!_jrStar)
            {
               _jrStar = new Sprite();
               _jrStar.mouseEnabled = false;
               _jrStar.mouseChildren = false;
            }
            XtReplyDemuxer.jrStarDraw(_jrStar.graphics,_loc4_,2);
            addChild(_jrStar);
            _jrStar.x = Math.round(_loc3_.x + (_loc3_.width - _loc4_) / 2);
            _jrStar.y = Math.round(_loc3_.y + (_loc3_.height - _loc4_) / 2);
            _jrStar.visible = true;
         }
         catch(e:Error)
         {
         }
      }
'''
edit('avatar/NameBar.as', [
    ('   import flash.utils.Dictionary;\n',
     '   import flash.utils.Dictionary;\n   import flash.display.DisplayObject;\n   import flash.display.Sprite;\n   import flash.geom.Rectangle;\n'),
    # JR's refresh: the game's own choice of name, not always the user name
    ('      private var _jrReal:String;\n',
     '      private var _jrReal:String;\n\n      private var _jrShown:String;\n'),
    ('               _loc2_._avNameTxt.text = XtReplyDemuxer.jrNameFor(_loc2_._jrReal,_loc2_._jrReal);\n               _loc2_.resize(_loc2_._jrSized,_loc2_._jrWidth);\n',
     '               _loc2_._avNameTxt.text = XtReplyDemuxer.jrNameFor(_loc2_._jrReal,_loc2_._jrShown != null ? _loc2_._jrShown : _loc2_._jrReal);\n               _loc2_.resize(_loc2_._jrSized,_loc2_._jrWidth);\n               _loc2_.jrStarMark();\n'),
    ('         _avNameTxt.text = XtReplyDemuxer.jrNameFor(_jrReal,_avNameTxt.text);\n         resize(param4,param5);\n      }\n',
     '         _jrShown = _avNameTxt.text;\n         _avNameTxt.text = XtReplyDemuxer.jrNameFor(_jrReal,_avNameTxt.text);\n         resize(param4,param5);\n         jrStarMark();\n      }\n' + NAMEBAR_STAR),
    # a level badge that loads later stays hidden under the star
    ('            _shape.mouse.gotoAndStop(1);\n            if(_isMemberNamebar)\n            {\n               this["updateColor"](_currColorId);\n            }\n         }\n      }\n',
     '            _shape.mouse.gotoAndStop(1);\n            if(_isMemberNamebar)\n            {\n               this["updateColor"](_currColorId);\n            }\n            jrStarMark();\n         }\n      }\n'),
])
