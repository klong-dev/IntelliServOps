import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const password = configService.get('redis.password');
        return {
          store: await redisStore({
            socket: {
              host: configService.get('redis.host'),
              port: configService.get('redis.port'),
            },
            password: password && password.trim() ? password : undefined,
          }),
          ttl: 60 * 1000, // 60 seconds default TTL
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class RedisModule {}
