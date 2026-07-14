import { Module } from '@nestjs/common';
import { EInvoiceService } from './einvoice.service';
import { EInvoiceController } from './einvoice.controller';

@Module({
  providers: [EInvoiceService],
  controllers: [EInvoiceController],
  exports: [EInvoiceService],
})
export class EInvoiceModule {}
