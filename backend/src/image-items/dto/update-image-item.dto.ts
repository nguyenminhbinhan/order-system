import { PartialType } from '@nestjs/mapped-types';
import { CreateImageItemDto } from './create-image-item.dto';

export class UpdateImageItemDto extends PartialType(CreateImageItemDto) {}
