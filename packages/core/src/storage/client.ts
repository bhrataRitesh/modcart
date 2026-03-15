import { Client } from 'minio';

export interface StorageConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
}

export class StorageClient {
  private client: Client;
  private bucket: string = 'modcart-images';

  constructor(config: StorageConfig) {
    this.client = new Client(config);
  }

  async ensureBucket() {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket, 'us-east-1');
      // Set public policy for images
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetBucketLocation', 's3:ListBucket'],
            Resource: [`arn:aws:s3:::${this.bucket}`],
          },
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };
      await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
    }
  }

  async upload(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.ensureBucket();
    await this.client.putObject(this.bucket, fileName, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    
    // In a production app, we would use a CDN or specific URL
    // For local dev, we construct the direct MinIO URL
    const protocol = (this.client as any).transport.protocol === 'https:' ? 'https' : 'http';
    const host = (this.client as any).host;
    const port = (this.client as any).port;
    
    return `${protocol}://${host}:${port}/${this.bucket}/${fileName}`;
  }
}
