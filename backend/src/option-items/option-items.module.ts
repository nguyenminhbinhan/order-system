import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OptionItemsController } from './option-items.controller';
import { OptionItemsService } from './option-items.service';

@Module({
  imports: [PrismaModule],
  controllers: [OptionItemsController],
  providers: [OptionItemsService],
})
export class OptionItemsModule {}
