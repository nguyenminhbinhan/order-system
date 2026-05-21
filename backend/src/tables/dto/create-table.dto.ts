import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TableStatus } from '@prisma/client';

export class CreateTableDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  qrCode?: string;

  @IsEnum(TableStatus)
  @IsOptional()
  status?: TableStatus;
}
