import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class CreateOptionItemDto {
  @IsString()
  @IsNotEmpty()
  menuId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  required: boolean;
}
