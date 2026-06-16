import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  Controller,
  Delete,
  ExceptionFilter,
  Param,
  Post,
  UploadedFile,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { memoryStorage, MulterError } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { uploadConfig } from '../../config/upload.config';
import { UploadService } from './upload.service';

const uploadMaxSizeMb = uploadConfig().upload.maxSizeMb;
const uploadMaxSizeBytes = uploadMaxSizeMb * 1024 * 1024;

const multerImageOptions = {
  storage: memoryStorage(),
  limits: { fileSize: uploadMaxSizeBytes },
};

@Catch(MulterError)
class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    if (exception.code === 'LIMIT_FILE_SIZE') {
      response.status(413).json({
        statusCode: 413,
        message: `Ukuran file melebihi batas ${uploadMaxSizeMb} MB`,
      });
      return;
    }
    throw new BadRequestException(exception.message);
  }
}

@ApiTags('upload')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(MulterExceptionFilter)
@Roles(UserRole.ADMIN)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', multerImageOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload single image' })
  uploadImage(@UploadedFile() file?: Express.Multer.File) {
    return this.uploadService.save(file);
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 5, multerImageOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } },
    },
  })
  @ApiOperation({ summary: 'Upload multiple images (max 5)' })
  uploadImages(@UploadedFiles() files?: Express.Multer.File[]) {
    return this.uploadService.saveMany(files);
  }

  @Delete(':filename')
  @ApiOperation({ summary: 'Delete uploaded file' })
  remove(@Param('filename') filename: string) {
    return this.uploadService.remove(filename);
  }
}
