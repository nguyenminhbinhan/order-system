import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      useFactory: (): any => {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          return {
            store: redisStore as any,
            url: redisUrl,
          };
        }
        return {
          store: redisStore as any,
          host: 'localhost',
          port: 6379,
        };
      },
    }),
  ],
  exports: [NestCacheModule],
})
export class AppCacheModule {}
