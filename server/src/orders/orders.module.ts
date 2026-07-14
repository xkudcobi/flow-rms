import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { PrintModule } from '../print/print.module';
import { StockModule } from '../stock/stock.module';
import { AccountsModule } from '../accounts/accounts.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { AuditModule } from '../audit/audit.module';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [
    PrintModule,
    StockModule,
    AccountsModule,
    FiscalModule,
    AuditModule,
    CrmModule,
  ],
  providers: [OrdersService, OrdersGateway],
  controllers: [OrdersController],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
