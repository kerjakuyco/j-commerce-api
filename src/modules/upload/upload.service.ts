import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';

export interface UploadedFileEntity {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class UploadService {
  constructor(private readonly configService: ConfigService) {}

  async save(file: Express.Multer.File | undefined): Promise<UploadedFileEntity> {
    if (!file) throw new BadRequestException('File wajib diunggah');
    this.validateImage(file);

    const uploadDir = this.configService.get<string>('upload.dir', './uploads');
    await mkdir(uploadDir, { recursive: true });

    const extension = this.getExtension(file);
    const filename = `${randomUUID()}${extension}`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, file.buffer);

    const baseUrl = this.configService.get<string>('upload.baseUrl', 'http://localhost:3000');

    return {
      url: `${baseUrl}/uploads/${filename}`,
      filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  async saveMany(files: Express.Multer.File[] | undefined): Promise<UploadedFileEntity[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Minimal 1 file wajib diunggah');
    }
    if (files.length > 5) {
      throw new BadRequestException('Maksimal upload 5 file sekaligus');
    }

    const results: UploadedFileEntity[] = [];
    for (const file of files) {
      results.push(await this.save(file));
    }

    return results;
  }

  async remove(filename: string): Promise<{ message: string }> {
    const safeFilename = basename(filename);
    const uploadDir = this.configService.get<string>('upload.dir', './uploads');
    const filepath = join(uploadDir, safeFilename);

    try {
      await unlink(filepath);
    } catch {
      throw new NotFoundException('File tidak ditemukan');
    }

    return { message: 'File berhasil dihapus' };
  }

  private validateImage(file: Express.Multer.File): void {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Format file harus jpg, png, atau webp');
    }

    const maxSizeMb = this.configService.get<number>('upload.maxSizeMb', 5);
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(`Ukuran file maksimal ${maxSizeMb} MB`);
    }
  }

  private getExtension(file: Express.Multer.File): string {
    const originalExtension = extname(file.originalname).toLowerCase();
    if (originalExtension) return originalExtension;

    switch (file.mimetype) {
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'image/jpeg':
      default:
        return '.jpg';
    }
  }
}
