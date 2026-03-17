import { IsEnum, IsString, IsOptional, IsUUID } from 'class-validator';
import { HistoryAction } from '../../common/enums';

export class CreateHistoryDto {
  @IsUUID()
  objectId: string;

  @IsUUID()
  stageId: string;

  @IsEnum(HistoryAction)
  action: HistoryAction;

  @IsString()
  @IsOptional()
  telegramUserId?: string;

  @IsString()
  @IsOptional()
  username?: string;
}
