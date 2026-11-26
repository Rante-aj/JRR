# Shop Explorer "Open" (shopx-update): JR asks the game ("os" {id}) to open a My Shop stand in the
# den you're in, the same way clicking the stand does (ShopManager.launchDenShopStore).
edit('XtReplyDemuxer.as', [
    ('   import flash.utils.getTimer;\n   \n   public class XtReplyDemuxer\n',
     '   import flash.utils.getTimer;\n   import shop.ShopManager;\n   import room.RoomManagerWorld;\n   \n   public class XtReplyDemuxer\n'),
    ('         else if(_loc2_ == "dp")\n',
     '         else if(_loc2_ == "os")\n'
     '         {\n'
     '            jrOpenShop(_loc3_);\n'
     '         }\n'
     '         else if(_loc2_ == "dp")\n'),
    ('      private static function jrHandle(param1:Object) : void\n',
     '      // Shop Explorer\'s Open button (plugins/shop-explorer): opens one My Shop stand in the den\n'
     '      // you\'re in, the same as clicking it. {id: the stand\'s den item number}\n'
     '      private static function jrOpenShop(param1:Object) : void\n'
     '      {\n'
     '         try\n'
     '         {\n'
     '            if(param1 == null || int(param1.id) <= 0 || RoomManagerWorld.instance == null)\n'
     '            {\n'
     '               return;\n'
     '            }\n'
     '            if(!RoomManagerWorld.instance.denOwnerName)\n'
     '            {\n'
     '               return;\n'
     '            }\n'
     '            ShopManager.launchDenShopStore(int(param1.id));\n'
     '         }\n'
     '         catch(e:Error)\n'
     '         {\n'
     '         }\n'
     '      }\n'
     '      \n'
     '      private static function jrHandle(param1:Object) : void\n'),
])
