import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { basename, join } from 'path';

export interface UploadedFileEntity {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface DetectedImageType {
  mimetype: string;
  extension: string;
}

@Injectable()
export class UploadService {
  constructor(private readonly configService: ConfigService) {}

  async save(file: Express.Multer.File | undefined): Promise<UploadedFileEntity> {
    if (!file) throw new BadRequestException('File wajib diunggah');
    const imageType = this.validateImage(file);

    const uploadDir = this.configService.get<string>('upload.dir', './uploads');
    await mkdir(uploadDir, { recursive: true });

    const filename = `${randomUUID()}${imageType.extension}`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, file.buffer);

    const baseUrl = this.configService.get<string>('upload.baseUrl', 'http://localhost:3000');

    return {
      url: `${baseUrl}/uploads/${filename}`,
      filename,
      size: file.size,
      mimetype: imageType.mimetype,
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

  private validateImage(file: Express.Multer.File): DetectedImageType {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Format file harus jpg, png, atau webp');
    }

    const maxSizeMb = this.configService.get<number>('upload.maxSizeMb', 5);
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(`Ukuran file maksimal ${maxSizeMb} MB`);
    }

    const imageType = this.detectImageType(file.buffer);
    if (!imageType || imageType.mimetype !== file.mimetype) {
      throw new BadRequestException('Konten file tidak sesuai format gambar');
    }

    return imageType;
  }

  private detectImageType(buffer: Buffer): DetectedImageType | null {
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mimetype: 'image/jpeg', extension: '.jpg' };
    }

    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mimetype: 'image/png', extension: '.png' };
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { mimetype: 'image/webp', extension: '.webp' };
    }

    return null;
  }
}
