import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private useCloudinary = false;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.useCloudinary = true;
      console.log('[STORAGE] Cloudinary successfully configured and enabled.');
    } else {
      console.warn('[STORAGE] Cloudinary credentials missing. Falling back to local/persistent volume storage.');
    }
  }

  private slugifyFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const nameWithoutExt = path.basename(originalName, ext);

    // Remove Vietnamese accents / unicode characters
    let clean = nameWithoutExt
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .replace(/æ/g, 'ae')
      .replace(/œ/g, 'oe')
      .toLowerCase();

    // Replace non-alphanumeric characters with hyphens
    clean = clean
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')             // collapse duplicate hyphens
      .replace(/^-|-$/g, '');          // trim leading/trailing hyphens

    // Fallback to random if empty
    if (!clean) {
      clean = 'image';
    }

    // Add a unique timestamp/random suffix
    const suffix = Math.floor(100000 + Math.random() * 900000); // 6 digit random number
    return `${clean}-${suffix}${ext}`;
  }

  async saveFile(file: any): Promise<string> {
    if (!file || !file.buffer) {
      throw new Error('Invalid file buffer');
    }

    const sanitizedName = this.slugifyFilename(file.originalname);

    if (this.useCloudinary) {
      return new Promise<string>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'order-system',
            public_id: path.parse(sanitizedName).name,
          },
          (error, result) => {
            if (error) {
              console.error('[STORAGE] Cloudinary upload error:', error);
              // Fall back to local if Cloudinary upload fails
              this.saveFileLocally(file, sanitizedName)
                .then(resolve)
                .catch(reject);
            } else {
              console.log('[STORAGE] Uploaded directly to Cloudinary:', result?.secure_url);
              resolve(result?.secure_url || '');
            }
          }
        );
        Readable.from(file.buffer).pipe(uploadStream);
      });
    } else {
      return this.saveFileLocally(file, sanitizedName);
    }
  }

  private async saveFileLocally(file: any, filename: string): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    // Ensure directory exists
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
    } catch (err) {
      // ignore if already exists
    }

    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, file.buffer);
    console.log('[STORAGE] Saved file locally to:', filePath);
    return filename;
  }

  async deleteFile(filename: string): Promise<void> {
    if (!filename) return;

    if (filename.startsWith('http')) {
      // It is a Cloudinary URL — extract public_id and delete it
      try {
        const parts = filename.split('/');
        const folderAndId = parts.slice(parts.indexOf('upload') + 2).join('/');
        const publicIdWithExt = folderAndId.replace(/^v\d+\//, '');
        const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));

        if (this.useCloudinary && publicId) {
          console.log('[STORAGE] Deleting from Cloudinary with publicId:', publicId);
          await cloudinary.uploader.destroy(publicId);
        }
      } catch (err) {
        console.error('[STORAGE] Failed to delete file from Cloudinary:', err);
      }
    } else {
      // It is a local file
      const filePath = path.join(process.cwd(), 'uploads', filename);
      try {
        await fs.unlink(filePath);
        console.log('[STORAGE] Deleted local file:', filePath);
      } catch (err) {
        // Ignore if file doesn't exist
      }
    }
  }
}
