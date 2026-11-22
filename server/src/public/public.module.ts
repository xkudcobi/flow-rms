import { Module } from '@nestjs/common';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [OrdersModule, SettingsModule],
  providers: [PublicService],
  controllers: [PublicController],
})
export class PublicModule {}
