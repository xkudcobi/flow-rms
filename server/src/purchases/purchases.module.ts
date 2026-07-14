import { Module } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { StockModule } from '../stock/stock.module';
import { AccountsModule } from '../accounts/accounts.module';
import { CashModule } from '../cash/cash.module';

@Module({
  imports: [StockModule, AccountsModule, CashModule],
  providers: [PurchasesService],
  controllers: [PurchasesController],
})
export class PurchasesModule {}
