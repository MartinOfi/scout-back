import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { resolveAllowedOrigins } from './common/utils/cors-origins.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: orígenes por defecto + los de FRONTEND_URL (separados por coma)
  app.enableCors({
    origin: resolveAllowedOrigins(process.env.FRONTEND_URL),
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
