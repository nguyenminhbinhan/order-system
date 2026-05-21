import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ConfirmOrderItemDto {
  @IsString()
  itemId: string; // OrderItem ID

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class ConfirmOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmOrderItemDto)
  items: ConfirmOrderItemDto[];
}
