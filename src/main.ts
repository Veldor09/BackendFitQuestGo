import {ClassSerializerInterceptor,ValidationPipe,} from '@nestjs/common';
import {NestFactory,Reflector,} from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      // Borra del body cualquier propiedad que no este en el DTO.
      whitelist: true,
      // Y responde 400 si mandan alguna de mas, en vez de ignorarla en silencio.
      forbidNonWhitelisted: true,
      // Convierte los tipos primitivos segun el DTO (ej. "3" -> 3).
      transform: true,
    }),
  );

  // Aplica los @Exclude de las entidades, para que el hash de password
  // no salga en ninguna respuesta.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
