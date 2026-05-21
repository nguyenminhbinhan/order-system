import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Global()
@Module({
  imports: [
    NestCacheModule.register({
      store: redisStore as any,
      host: 'localhost',
      port: 6379,
    }),
  ],
  exports: [NestCacheModule],
})
export class AppCacheModule {}
