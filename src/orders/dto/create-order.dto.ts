import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  tableId: string;

  @IsNumber()
  totalAmount: number;
}
