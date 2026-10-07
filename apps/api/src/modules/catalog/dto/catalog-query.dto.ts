import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ProductListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @IsOptional() @IsIn(['active', 'draft', 'archived']) status?: 'active' | 'draft' | 'archived';
  @IsOptional() @IsIn(['physical', 'digital', 'service', 'bundle']) productType?: 'physical' | 'digital' | 'service' | 'bundle';
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(120) brand?: string;
  @IsOptional() @IsIn(['sku', 'name', 'createdAt', 'updatedAt']) sortBy: 'sku' | 'name' | 'createdAt' | 'updatedAt' = 'createdAt';
  @IsOptional() @IsIn(['ASC', 'DESC']) sortOrder: 'ASC' | 'DESC' = 'DESC';
}
