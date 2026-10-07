import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  Matches,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'validGs1CheckDigit', async: false })
class ValidGs1CheckDigit implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (typeof value !== 'string' || !/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value)) return false;
    const digits = [...value].map(Number);
    const checkDigit = digits.pop()!;
    const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === checkDigit;
  }

  defaultMessage() {
    return 'Identifier has an invalid GS1 check digit';
  }
}

export class ProductDimensionsDto {
  @IsOptional() @IsNumber() @Min(0) length?: number;
  @IsOptional() @IsNumber() @Min(0) width?: number;
  @IsOptional() @IsNumber() @Min(0) height?: number;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
}

export class ProductTaxInformationDto {
  @IsOptional() @IsString() @MaxLength(80) code?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) rate?: number;
  @IsOptional() @IsBoolean() inclusive?: boolean;
}

export class ProductIdentifiersDto {
  @IsOptional() @IsString() @MaxLength(100) barcode?: string | null;
  @IsOptional() @IsString() @Matches(/^(?:\d{8}|\d{12})$/) @Validate(ValidGs1CheckDigit) upc?: string | null;
  @IsOptional() @IsString() @Matches(/^(?:\d{8}|\d{13})$/) @Validate(ValidGs1CheckDigit) ean?: string | null;
  @IsOptional() @IsString() @Matches(/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/) @Validate(ValidGs1CheckDigit) gtin?: string | null;
}

export class CreateProductDto extends ProductIdentifiersDto {
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(100) sku: string;
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string | null;
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() @IsString() @MaxLength(120) brand?: string | null;
  @IsOptional() @IsIn(['physical', 'digital', 'service', 'bundle']) productType?: 'physical' | 'digital' | 'service' | 'bundle';
  @IsOptional() @IsIn(['active', 'draft']) status?: 'active' | 'draft';
  @IsOptional() @IsString() @MaxLength(30) unitOfMeasure?: string;
  @IsOptional() @Transform(({ value }) => value === null || value === '' ? null : Number(value)) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) weight?: number | null;
  @IsOptional() @ValidateNested() @Type(() => ProductDimensionsDto) dimensions?: ProductDimensionsDto | null;
  @IsOptional() @ValidateNested() @Type(() => ProductTaxInformationDto) taxInformation?: ProductTaxInformationDto | null;
  @IsOptional() @IsBoolean() trackBatch?: boolean;
  @IsOptional() @IsBoolean() trackSerialNumber?: boolean;
  @IsOptional() @IsBoolean() trackExpiry?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class CreateVariantDto {
  @IsString() @MaxLength(100) sku: string;
  @IsObject() attributes: Record<string, string | number | boolean>;
  @IsOptional() @Transform(({ value }) => value === null || value === '' ? null : Number(value)) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number | null;
  @IsOptional() @Transform(({ value }) => value === null || value === '' ? null : Number(value)) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) cost?: number | null;
  @IsOptional() @IsString() @MaxLength(100) barcode?: string | null;
}

export class UpdateVariantDto extends PartialType(CreateVariantDto) {
  @IsOptional() @IsIn(['active', 'archived']) status?: 'active' | 'archived';
}
