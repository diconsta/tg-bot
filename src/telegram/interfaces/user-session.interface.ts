export interface UserSession {
  userId: string;
  chatId: string;
  threadId: string;
  state: UserSessionState;
  objectId?: string;
  stageId?: string;
  stageIndex?: number;
  stageName?: string;
  photoBuffer?: Buffer[];
  mediaGroupId?: string;
  mediaGroupTimeout?: NodeJS.Timeout;
  finishButtonMessageId?: number;
}

export enum UserSessionState {
  IDLE = 'IDLE',
  AWAITING_PHOTOS = 'AWAITING_PHOTOS',
}
