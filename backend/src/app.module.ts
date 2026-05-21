import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { TablesModule } from './tables/tables.module';
import { CategoriesModule } from './categories/categories.module';
import { MenuItemsModule } from './menu-items/menu-items.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { OptionItemsModule } from './option-items/option-items.module';
import { ImageItemsModule } from './image-items/image-items.module';
import { AuthModule } from './auth/auth.module';
import { SocketModule } from './socket/socket.module';
import { AdminModule } from './admin/admin.module';
import { MessagesModule } from './messages/messages.module';
import { AppCacheModule } from './cache/cache.module';

@Module({
  imports: [
    AppCacheModule,
    PrismaModule,
    UsersModule,
    TablesModule,
    CategoriesModule,
    MenuItemsModule,
    OrdersModule,
    PaymentsModule,
    OptionItemsModule,
    ImageItemsModule,
    AuthModule,
    SocketModule,
    AdminModule,
    MessagesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
