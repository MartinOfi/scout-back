import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend development
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4202' || 'http://localhost:4201',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
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

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Scout - Sistema de Gestión Financiera')
    .setDescription('API para gestión financiera de grupo scout')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag(
      'Personas',
      'Gestión de protagonistas, educadores y personas externas',
    )
    .addTag(
      'Cajas',
      'Gestión de caja de grupo, fondos de rama y cuentas personales',
    )
    .addTag('Movimientos', 'Registro de ingresos y egresos')
    .addTag('Inscripciones', 'Inscripciones Scout Argentina')
    .addTag('Cuotas', 'Cuotas de grupo')
    .addTag('Campamentos', 'Gestión de campamentos')
    .addTag('Eventos', 'Eventos de venta y eventos de grupo')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`🚀 Application running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

void bootstrap();
