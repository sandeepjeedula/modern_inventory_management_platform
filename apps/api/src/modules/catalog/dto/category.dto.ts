import { PartialType } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(160) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string | null;
  @IsOptional() @IsUUID() parentId?: string | null;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
}
