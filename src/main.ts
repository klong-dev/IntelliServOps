import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from './app.module';
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
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Apartments', 'Apartment listing endpoints')
    .addTag('Contracts', 'Rental contract endpoints')
    .addTag('Invoices', 'Invoice and billing endpoints')
    .addTag('Payments', 'Payment processing endpoints')
    .addTag('IoT', 'IoT device control endpoints')
    .addTag('Maintenance', 'Maintenance request endpoints')
    .addTag('Tickets', 'Support ticket endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

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
  `);
}
bootstrap();
