import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSessionEntity } from './entities/user-session.entity';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSessionEntity])],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
