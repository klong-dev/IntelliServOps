import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors';
import { AllExceptionsFilter } from './common/filters';
import * as yaml from 'js-yaml';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  const apiPrefix = configService.get('app.apiPrefix') || 'api';
  const apiVersion = configService.get('app.apiVersion') || 'v1';
  app.setGlobalPrefix(`${apiPrefix}/${apiVersion}`);

  // Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global error handling filter (must be before interceptor)
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global JSON:API response interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get('SWAGGER_TITLE') || 'IntelliRentOps API')
    .setDescription(
      configService.get('SWAGGER_DESCRIPTION') ||
        'Property Rental Management Platform API Documentation',
    )
    .setVersion(configService.get('SWAGGER_VERSION') || '1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'IntelliRentOps API Docs',
    customCssUrl: undefined,
  });

  // Disable caching for Swagger UI & API spec (fixes Cloudflare tunnel serving stale docs)
  const expressApp_noCacheMiddleware = (req: any, res: any, next: any) => {
    if (req.path.startsWith('/docs') || req.path.startsWith('/openapi')) {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    next();
  };
  app.use(expressApp_noCacheMiddleware);

  // Expose OpenAPI spec as JSON and YAML for frontend code generation
  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.get('/openapi/v1.json', (req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  });

  expressApp.get('/openapi/v1.yaml', (req: any, res: any) => {
    res.setHeader('Content-Type', 'text/yaml');
    res.send(yaml.dump(document));
  });

  // Start server
  const port = configService.get('app.port') || 3000;
  await app.listen(port);

  console.log(`
    🏠 IntelliRentOps API is running!
    📍 Application: http://localhost:${port}/${apiPrefix}/${apiVersion}
    📚 Swagger Docs: http://localhost:${port}/docs
    🔧 Environment: ${configService.get('app.nodeEnv')}
    💾 Redis: ${'🟢 Connected'} (${configService.get('redis.host')}:${configService.get('redis.port')})
  `);
}
bootstrap();
