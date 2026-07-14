import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Socket, sayfanın AYNI origin'ine bağlanır (varsayılan /socket.io yolu).
// Üretimde web+api tek sunucuda (aynı port) → doğrudan çalışır.
// Geliştirmede (Vite 5173) vite.config'teki /socket.io ws proxy'si 3011'e taşır.
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ transports: ['websocket', 'polling'] });
  }
  return socket;
}

// Bir olayı dinlemek için basit hook. deps değişince yeniden bağlanır.
export function useSocketEvent(
  event: string,
  handler: (payload: any) => void,
  deps: any[] = [],
) {
  useEffect(() => {
    const s = getSocket();
    s.on(event, handler);
    return () => {
      s.off(event, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
