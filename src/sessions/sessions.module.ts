import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSessionEntity } from './entities/user-session.entity';
import { MediaGroupCacheEntity } from './entities/media-group-cache.entity';
import { SessionsService } from './sessions.service';
import { MediaGroupCacheService } from './media-group-cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSessionEntity, MediaGroupCacheEntity])],
  providers: [SessionsService, MediaGroupCacheService],
  exports: [SessionsService, MediaGroupCacheService],
})
export class SessionsModule {}
