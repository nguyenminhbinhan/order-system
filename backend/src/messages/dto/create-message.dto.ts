import { IsInt, IsNotEmpty, IsString, IsEnum } from 'class-validator';

export class CreateMessageDto {
  @IsInt()
  @IsNotEmpty()
  tableId: number;

  @IsEnum(['customer', 'service'])
  @IsNotEmpty()
  sender: 'customer' | 'service';

  @IsString()
  @IsNotEmpty()
  content: string;
}
