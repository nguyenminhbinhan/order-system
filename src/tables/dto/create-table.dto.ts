import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { TableStatus } from '@prisma/client';

export class CreateTableDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  qrCode: string;

  @IsEnum(TableStatus)
  @IsNotEmpty()
  status: TableStatus;
}
