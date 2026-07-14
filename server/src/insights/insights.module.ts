import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { AiService } from './ai.service';
import { AiActionsService } from './ai-actions.service';
import { InsightsController } from './insights.controller';
import { MenuModule } from '../menu/menu.module';
import { StockModule } from '../stock/stock.module';
import { SettingsModule } from '../settings/settings.module';
import { TablesModule } from '../tables/tables.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [MenuModule, StockModule, SettingsModule, TablesModule, OrdersModule],
  providers: [InsightsService, AiService, AiActionsService],
  controllers: [InsightsController],
  exports: [InsightsService],
})
export class InsightsModule {}
