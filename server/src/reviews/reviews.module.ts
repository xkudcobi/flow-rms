import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule], // OrdersGateway (socket bildirimi)
  providers: [ReviewsService],
  controllers: [ReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}
