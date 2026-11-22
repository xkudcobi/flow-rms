import { Module } from '@nestjs/common';
import { StaffRecosService } from './staff-recos.service';
import { StaffRecosController } from './staff-recos.controller';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [StockModule],
  providers: [StaffRecosService],
  controllers: [StaffRecosController],
  exports: [StaffRecosService],
})
export class StaffRecosModule {}
