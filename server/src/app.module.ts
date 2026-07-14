import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { existsSync } from 'fs';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MenuModule } from './menu/menu.module';
import { TablesModule } from './tables/tables.module';
import { OrdersModule } from './orders/orders.module';
import { PrintModule } from './print/print.module';
import { ReportsModule } from './reports/reports.module';
import { StockModule } from './stock/stock.module';
import { AccountsModule } from './accounts/accounts.module';
import { FiscalModule } from './fiscal/fiscal.module';
import { EInvoiceModule } from './einvoice/einvoice.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ReservationsModule } from './reservations/reservations.module';
import { PublicModule } from './public/public.module';
import { CallsModule } from './calls/calls.module';
import { FeedbackModule } from './feedback/feedback.module';
import { CashModule } from './cash/cash.module';
import { AuditModule } from './audit/audit.module';
import { ShiftsModule } from './shifts/shifts.module';
import { CrmModule } from './crm/crm.module';
import { InsightsModule } from './insights/insights.module';
import { SettingsModule } from './settings/settings.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ImportModule } from './import/import.module';
import { GraphMemoryModule } from './graph-memory/graph-memory.module';
import { AppController } from './app.controller';

// Üretimde derlenmiş React uygulamasını (web/dist) aynı sunucudan servis et.
// __dirname = server/dist → ../../web/dist = proje kökündeki web/dist.
// /api ve /socket.io hariç tutulur; kalan tüm yollar SPA fallback ile index.html'e gider.
const webDist = join(__dirname, '..', '..', 'web', 'dist');
const staticModules = existsSync(webDist)
  ? [
      ServeStaticModule.forRoot({
        rootPath: webDist,
        exclude: ['/api', '/api/(.*)', '/socket.io/(.*)'],
      }),
    ]
  : [];

@Module({
  imports: [
    ...staticModules,
    GraphMemoryModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    MenuModule,
    TablesModule,
    OrdersModule,
    PrintModule,
    ReportsModule,
    StockModule,
    AccountsModule,
    FiscalModule,
    EInvoiceModule,
    PurchasesModule,
    ReservationsModule,
    PublicModule,
    CallsModule,
    FeedbackModule,
    CashModule,
    AuditModule,
    ShiftsModule,
    CrmModule,
    InsightsModule,
    SettingsModule,
    ReviewsModule,
    NotificationsModule,
    ImportModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
