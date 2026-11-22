import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePage } from '../auth/permissions.guard';

// Alış faturası tarama. "alislar" sayfa iznine sahip olanlar kullanabilir.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePage('alislar')
@Controller('purchases')
export class OcrController {
  constructor(private readonly ocr: OcrService) {}

  @Post('ocr')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB
    }),
  )
  async scan(@UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Görüntü dosyası gerekli');
    }
    return this.ocr.extract(file.buffer, file.mimetype);
  }
}
