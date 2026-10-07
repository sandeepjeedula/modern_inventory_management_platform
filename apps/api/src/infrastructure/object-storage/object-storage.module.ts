import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OBJECT_STORAGE } from './object-storage.port';
import { S3ObjectStorage } from './s3-object-storage';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: S3ObjectStorage, inject: [ConfigService], useFactory: (config: ConfigService) => new S3ObjectStorage(config) },
    { provide: OBJECT_STORAGE, useExisting: S3ObjectStorage },
  ],
  exports: [OBJECT_STORAGE],
})
export class ObjectStorageModule {}
