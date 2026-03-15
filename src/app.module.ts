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

@Module({
  imports: [PrismaModule, UsersModule, TablesModule, CategoriesModule, MenuItemsModule, OrdersModule, PaymentsModule, OptionItemsModule, ImageItemsModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
