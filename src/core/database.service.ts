import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(readonly dataSource: DataSource) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>) {
    return this.dataSource.transaction(work);
  }
  async onModuleDestroy() {
    if (this.dataSource.isInitialized) await this.dataSource.destroy();
  }
}
