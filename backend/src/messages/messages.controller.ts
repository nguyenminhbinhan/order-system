import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseIntPipe,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // Open Route for Waiters/Customers
  @Post()
  create(@Body() dto: CreateMessageDto) {
    return this.messagesService.create(dto);
  }

  // Open Route for Waiters/Customers
  @Get(':tableId')
  findByTable(@Param('tableId', ParseIntPipe) tableId: number) {
    return this.messagesService.findByTable(tableId);
  }
}
