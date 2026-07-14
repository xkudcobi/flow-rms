import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

// Tek işletme / yerel ağ olduğu için tüm bağlı cihazlara (salon, KDS, kasa)
// global yayın yapıyoruz. Oda/room ayrımı ileride şube bazında eklenebilir.
@WebSocketGateway({ cors: { origin: true } })
export class OrdersGateway {
  @WebSocketServer() server: Server;

  // Masa durumu değişti (boş/dolu/ödendi...)
  emitTableUpdate(table: unknown) {
    this.server?.emit('table:update', table);
  }

  // Bir siparişin içeriği değişti (kalem eklendi, durum değişti, taşındı...)
  emitOrderUpdate(order: unknown) {
    this.server?.emit('order:update', order);
  }

  // Mutfak ekranının (KDS) yenilenmesi gereken bir olay oldu.
  emitKdsUpdate() {
    this.server?.emit('kds:update');
  }

  // QR'dan garson/hesap çağrısı — salon/garson ekranına anlık bildirim.
  emitWaiterCall(payload: unknown) {
    this.server?.emit('waiter:call', payload);
  }

  // Çağrı listesi değişti (karşılandı vb.) — ekranlar tazelesin.
  emitCallsUpdate() {
    this.server?.emit('calls:update');
  }

  // Yeni Google yorumu geldi — her ekrana anlık bildirim.
  emitNewReview(payload: unknown) {
    this.server?.emit('review:new', payload);
  }
}
