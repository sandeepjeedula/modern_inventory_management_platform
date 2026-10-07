import { ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UpdateProductImageDto {
  @IsOptional() @IsString() @MaxLength(300) altText?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(10000) sortOrder?: number;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class ReorderProductImagesDto {
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsUUID('4', { each: true }) imageIds: string[];
}
