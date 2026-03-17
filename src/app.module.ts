import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';
import { ObjectsModule } from './objects/objects.module';
import { StagesModule } from './stages/stages.module';
import { PhotosModule } from './photos/photos.module';
import { HistoryModule } from './history/history.module';
import { CoordinatorsModule } from './coordinators/coordinators.module';
import { TelegramModule } from './telegram/telegram.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.get('database'),
    }),
    ObjectsModule,
    StagesModule,
    PhotosModule,
    HistoryModule,
    CoordinatorsModule,
    TelegramModule,
    SchedulerModule,
    SessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
