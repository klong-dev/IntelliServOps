import { Global, Module, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

const logger = new Logger('RedisModule');

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const password = configService.get('redis.password');
        const host = configService.get('redis.host');
        const port = configService.get('redis.port');

        const store = await redisStore({
          socket: {
            host,
            port,
            reconnectStrategy: (retries: number) => {
              if (retries > 20) {
                logger.error(
                  `Redis: Too many reconnect attempts (${retries}). Giving up.`,
                );
                return new Error('Too many retries');
              }
              const delay = Math.min(retries * 500, 5000);
              logger.warn(
                `Redis: Connection lost. Reconnecting in ${delay}ms... (attempt ${retries})`,
              );
              return delay;
            },
          },
          password: password && password.trim() ? password : undefined,
        });

        // Handle Redis client error events to prevent unhandled crashes
        const client = (store as any).client;
        if (client) {
          client.on('error', (err: Error) => {
            logger.error(`Redis client error: ${err.message}`);
          });
          client.on('reconnecting', () => {
            logger.warn('Redis: Reconnecting...');
          });
          client.on('ready', () => {
            logger.log(`Redis: Connected to ${host}:${port}`);
          });
        }

        return {
          store,
          ttl: 60 * 1000, // 60 seconds default TTL
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class RedisModule {}
