import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImageItemsController } from './image-items.controller';
import { ImageItemsService } from './image-items.service';

@Module({
  imports: [PrismaModule],
  controllers: [ImageItemsController],
  providers: [ImageItemsService],
})
export class ImageItemsModule {}
