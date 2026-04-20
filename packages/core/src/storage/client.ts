import { Client } from 'minio';
import sharp from 'sharp';

export interface StorageConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
}

export interface UploadedImage {
  original: string;
  thumbnail: string; // 300px
  medium: string;    // 800px
  large: string;     // 1400px
  blurDataURL: string; // base64 blur placeholder
}

const SIZES = {
  thumbnail: 300,
  medium: 800,
  large: 1400,
} as const;

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

  private buildUrl(fileName: string): string {
    const protocol = (this.client as any).transport?.protocol === 'https:' ? 'https' : 'http';
    const host = (this.client as any).host;
    const port = (this.client as any).port;
    return `${protocol}://${host}:${port}/${this.bucket}/${fileName}`;
  }

  private async putBuffer(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.putObject(this.bucket, fileName, buffer, buffer.length, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    return this.buildUrl(fileName);
  }

  /**
   * Upload an image with automatic resizing to 3 sizes + blur placeholder.
   * Returns URLs for all variants.
   */
  async uploadImage(baseName: string, buffer: Buffer): Promise<UploadedImage> {
    await this.ensureBucket();

    const image = sharp(buffer);
    const ext = 'webp'; // Always convert to WebP for best compression

    // Generate all variants in parallel
    const [originalBuf, thumbBuf, mediumBuf, largeBuf, blurBuf] = await Promise.all([
      image.clone().webp({ quality: 85 }).toBuffer(),
      image.clone().resize(SIZES.thumbnail, SIZES.thumbnail, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
      image.clone().resize(SIZES.medium, SIZES.medium, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      image.clone().resize(SIZES.large, SIZES.large, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      // Tiny 10px blur placeholder
      image.clone().resize(10, 10, { fit: 'inside' }).webp({ quality: 20 }).toBuffer(),
    ]);

    const [originalUrl, thumbUrl, mediumUrl, largeUrl] = await Promise.all([
      this.putBuffer(`${baseName}.${ext}`, originalBuf, 'image/webp'),
      this.putBuffer(`${baseName}_thumb.${ext}`, thumbBuf, 'image/webp'),
      this.putBuffer(`${baseName}_md.${ext}`, mediumBuf, 'image/webp'),
      this.putBuffer(`${baseName}_lg.${ext}`, largeBuf, 'image/webp'),
    ]);

    const blurDataURL = `data:image/webp;base64,${blurBuf.toString('base64')}`;

    return {
      original: originalUrl,
      thumbnail: thumbUrl,
      medium: mediumUrl,
      large: largeUrl,
      blurDataURL,
    };
  }

  /** Legacy single upload for backwards compatibility */
  async upload(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.ensureBucket();
    return this.putBuffer(fileName, buffer, contentType);
  }

  async delete(fileName: string): Promise<void> {
    await this.client.removeObject(this.bucket, fileName);
  }

  async deleteImageVariants(baseName: string): Promise<void> {
    const toDelete = [
      `${baseName}.webp`,
      `${baseName}_thumb.webp`,
      `${baseName}_md.webp`,
      `${baseName}_lg.webp`,
    ];
    await Promise.allSettled(toDelete.map(f => this.delete(f)));
  }

  async listFiles(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const files: string[] = [];
      const stream = this.client.listObjects(this.bucket, '', true);
      stream.on('data', (obj: any) => files.push(obj.name));
      stream.on('error', (err: any) => reject(err));
      stream.on('end', () => resolve(files));
    });
  }
}
