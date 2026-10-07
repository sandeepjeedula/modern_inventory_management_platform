import { DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { ObjectStorage } from './object-storage.port';

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private bucketReady?: Promise<void>;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('OBJECT_STORAGE_BUCKET');
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>('OBJECT_STORAGE_ENDPOINT'),
      region: config.getOrThrow<string>('OBJECT_STORAGE_REGION'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>('OBJECT_STORAGE_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('OBJECT_STORAGE_SECRET_KEY'),
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async readUrl(key: string): Promise<string> {
    await this.ensureBucket();
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 300 });
  }

  private ensureBucket(): Promise<void> {
    this.bucketReady ??= this.createBucketIfMissing().catch((error) => {
      this.bucketReady = undefined;
      throw error;
    });
    return this.bucketReady;
  }

  private async createBucketIfMissing(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      const name = (error as { name?: string }).name;
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (statusCode !== 404 && name !== 'NotFound' && name !== 'NoSuchBucket') throw error;
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (createError) {
        const createName = (createError as { name?: string }).name;
        if (createName !== 'BucketAlreadyExists' && createName !== 'BucketAlreadyOwnedByYou') throw createError;
      }
    }
  }
}
