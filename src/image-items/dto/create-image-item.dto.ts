import { IsNotEmpty, IsString } from 'class-validator';

export class CreateImageItemDto {
  @IsString()
  @IsNotEmpty()
  menuId: string;

  @IsString()
  @IsNotEmpty()
  image: string;
}
