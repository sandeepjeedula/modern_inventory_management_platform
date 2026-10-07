import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: config.getOrThrow<string>('WEB_ORIGIN'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Inventory Platform API')
    .setDescription('REST API for the inventory management platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(config.getOrThrow<number>('API_PORT'), '0.0.0.0');
}

void bootstrap();
