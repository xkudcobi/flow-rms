import { Global, Module } from '@nestjs/common';
import { GraphMemoryService } from './graph-memory.service';

/**
 * Global modül: GraphMemoryService'i her yere enjekte edilebilir kılar.
 * Bağımlılığı yoktur (yalnız fs/child_process) → döngüsel bağımlılık riski yok.
 */
@Global()
@Module({
  providers: [GraphMemoryService],
  exports: [GraphMemoryService],
})
export class GraphMemoryModule {}
