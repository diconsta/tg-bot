import { IsString, IsNotEmpty } from 'class-validator';

export class CreateObjectDto {
  @IsString()
  @IsNotEmpty()
  telegramChatId: string;

  @IsString()
  @IsNotEmpty()
  telegramThreadId: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
