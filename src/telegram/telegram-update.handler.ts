import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from './telegram.service';
import { TelegramAdminCommandsHandler } from './telegram-admin-commands.handler';
import { ObjectsService } from '../objects/objects.service';
import { StagesService } from '../stages/stages.service';
import { PhotosService, TelegramPhotoData } from '../photos/photos.service';
import { HistoryService } from '../history/history.service';
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { GoogleDriveStorageService } from '../storage/google-drive-storage.service';
import { SessionsService } from '../sessions/sessions.service';
import { MediaGroupCacheService } from '../sessions/media-group-cache.service';
import { PendingPhoto } from '../sessions/entities/media-group-cache.entity';
import { UserSessionEntity } from '../sessions/entities/user-session.entity';

@Injectable()
export class TelegramUpdateHandler implements OnModuleInit {
  private readonly logger = new Logger(TelegramUpdateHandler.name);
  private bot: TelegramBot;

  constructor(
    private telegramService: TelegramService,
    private adminCommandsHandler: TelegramAdminCommandsHandler,
    private objectsService: ObjectsService,
    private stagesService: StagesService,
    private photosService: PhotosService,
    private historyService: HistoryService,
    private coordinatorsService: CoordinatorsService,
    private googleDriveStorage: GoogleDriveStorageService,
    private sessionsService: SessionsService,
    private mediaGroupCacheService: MediaGroupCacheService,
  ) {}

  onModuleInit() {
    this.bot = this.telegramService.getBot();
    this.logger.log('Telegram update handlers registered');
  }

  async handleUpdate(update: TelegramBot.Update): Promise<void> {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  private async handleMessage(msg: TelegramBot.Message) {
    try {
      // Handle admin commands
      if (msg.text && msg.text.startsWith('/')) {
        await this.adminCommandsHandler.handleCommand(msg);
        // Auto-create or update coordinator info when they interact
        if (msg.from) {
          await this.coordinatorsService.getOrCreateCoordinator(
            msg.from.id.toString(),
            msg.from.username,
            msg.from.first_name,
            msg.from.last_name,
          );
        }
        return;
      }

      if (msg.forum_topic_created) {
        await this.handleForumTopicCreated(msg);
      } else if (msg.photo) {
        await this.handlePhotoMessage(msg);
      }
    } catch (error) {
      this.logger.error(`Error handling message: ${error.message}`, error.stack);
    }
  }

  private async handleForumTopicCreated(msg: TelegramBot.Message) {
    const chatId = msg.chat.id.toString();
    const threadId = msg.message_thread_id?.toString();
    const topicName = msg.forum_topic_created.name;

    if (!threadId) {
      this.logger.warn('Forum topic created without thread ID');
      return;
    }

    this.logger.log(`New forum topic created: "${topicName}" (Thread: ${threadId})`);

    const existingObject = await this.objectsService.findByTelegramIds(
      chatId,
      threadId,
    );

    if (existingObject) {
      this.logger.warn(
        `Object already exists for chat ${chatId}, thread ${threadId}`,
      );
      return;
    }

    // Create object
    const object = await this.objectsService.create({
      telegramChatId: chatId,
      telegramThreadId: threadId,
      name: topicName,
    });

    // Assign all master stages to this object
    await this.stagesService.assignStagesToObject(object.id);

    // Set first stage as current
    const firstStage = await this.stagesService.getMasterStageByIndex(1);
    await this.objectsService.setCurrentStage(object.id, firstStage.id);

    const welcomeMessage = this.formatWelcomeMessage(topicName, firstStage.stageName);
    const keyboard = this.telegramService.createStageActionButtons();

    this.logger.log(`Sending welcome message to chat ${chatId}, thread ${threadId}`);

    try {
      await this.telegramService.sendMessageToThread(
        chatId,
        threadId,
        welcomeMessage,
        keyboard,
      );
      this.logger.log(`Welcome message sent successfully`);
    } catch (error) {
      this.logger.error(`Failed to send welcome message: ${error.message}`);
    }

    this.logger.log(`Object created: ${object.name} (ID: ${object.id})`);
  }

  private async handlePhotoMessage(msg: TelegramBot.Message) {
    const chatId = msg.chat.id.toString();
    const threadId = msg.message_thread_id?.toString();
    const userId = msg.from?.id.toString();

    if (!threadId) return;

    const session = await this.sessionsService.get(userId, chatId, threadId);
    if (!session || session.state !== 'AWAITING_PHOTOS') return;

    const photo = msg.photo[msg.photo.length - 1];
    const photoData: TelegramPhotoData = {
      fileId: photo.file_id,
      fileUniqueId: photo.file_unique_id,
      fileSize: photo.file_size,
    };

    if (msg.media_group_id) {
      await this.processAlbumPhoto(msg.media_group_id, photoData, session, msg.from);
    } else {
      await this.processBatchPhotos([photoData], session, msg.from);
    }
  }

  private async processAlbumPhoto(
    mediaGroupId: string,
    photoData: TelegramPhotoData,
    session: UserSessionEntity,
    user: TelegramBot.User,
  ) {
    // Each invocation sends its own Processing message; first one wins via DB upsert.
    const processingMsg = await this.telegramService.sendMessageToThread(
      session.chatId,
      session.threadId,
      '⏳ Przetwarzanie zdjęć...',
    );

    const { messageId, isNew } = await this.mediaGroupCacheService.getOrCreate(
      mediaGroupId,
      processingMsg.message_id,
      session.chatId,
      session.threadId,
    );

    if (!isNew && messageId !== processingMsg.message_id) {
      // Another invocation already created the shared message — delete our duplicate
      await this.telegramService.deleteMessage(session.chatId, processingMsg.message_id);
    } else if (isNew && session.finishButtonMessageId) {
      // We are first — delete the initial "add photos" instructions message
      await this.telegramService.deleteMessage(session.chatId, session.finishButtonMessageId);
    }

    // Queue this photo in DB immediately (fast write, no Drive upload yet)
    await this.mediaGroupCacheService.appendPendingPhoto(mediaGroupId, {
      fileId: photoData.fileId,
      fileUniqueId: photoData.fileUniqueId,
      fileSize: photoData.fileSize,
    });

    // Wait for other invocations to also queue their photos
    await new Promise<void>(resolve => setTimeout(resolve, 3000));

    // Atomically claim finalization — only one invocation wins
    const won = await this.mediaGroupCacheService.tryFinalize(mediaGroupId);
    if (!won) {
      return;
    }

    // We won — process all queued photos at once
    const pendingPhotos: PendingPhoto[] =
      await this.mediaGroupCacheService.getPendingPhotos(mediaGroupId);
    const object = await this.objectsService.findById(session.objectId);
    const maxPhotos = this.photosService.getMaxPhotosAllowed();
    const currentCount = await this.photosService.countPhotosForStage(
      object.id,
      session.stageId,
    );

    if (currentCount + pendingPhotos.length > maxPhotos) {
      await this.telegramService.editMessageText(
        session.chatId,
        messageId,
        `❌ Nie można dodać ${pendingPhotos.length} zdjęć. Maksymalna liczba: ${maxPhotos}. Aktualnie: ${currentCount}.`,
      );
      return;
    }

    try {
      const photosToUpload: TelegramPhotoData[] = pendingPhotos.map(p => ({
        fileId: p.fileId,
        fileUniqueId: p.fileUniqueId,
        fileSize: p.fileSize,
      }));
      const enriched = await this.uploadPhotosToDrive(
        photosToUpload,
        object.name,
        session.stageName,
      );
      await this.photosService.addMultiplePhotos(
        object.id,
        session.stageId,
        enriched,
      );
      await this.historyService.recordPhotoAdded(
        object.id,
        session.stageId,
        user.id.toString(),
        user.username,
      );
      await this.showUploadResult(session, messageId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing album batch: ${msg}`);
      await this.telegramService.editMessageText(
        session.chatId,
        messageId,
        `❌ Błąd podczas dodawania zdjęć: ${msg}`,
      );
    }
  }

  private async processBatchPhotos(
    photosData: TelegramPhotoData[],
    session: UserSessionEntity,
    user: TelegramBot.User,
  ) {
    if (session.finishButtonMessageId) {
      await this.telegramService.deleteMessage(session.chatId, session.finishButtonMessageId);
    }

    const processingMsg = await this.telegramService.sendMessageToThread(
      session.chatId,
      session.threadId,
      '⏳ Przetwarzanie zdjęć...',
    );
    const processingMessageId = processingMsg.message_id;

    try {
      await this.uploadAndSavePhoto(photosData[0], session, user);
      await this.showUploadResult(session, processingMessageId);
    } catch (error) {
      this.logger.error(`Error processing photo: ${error.message}`);
      await this.telegramService.editMessageText(
        session.chatId,
        processingMessageId,
        `❌ Błąd podczas dodawania zdjęć: ${error.message}`,
      );
    }
  }

  private async uploadAndSavePhoto(
    photoData: TelegramPhotoData,
    session: UserSessionEntity,
    user: TelegramBot.User,
  ): Promise<void> {
    const object = await this.objectsService.findById(session.objectId);
    const maxPhotos = this.photosService.getMaxPhotosAllowed();
    const currentCount = await this.photosService.countPhotosForStage(object.id, session.stageId);

    if (currentCount >= maxPhotos) {
      throw new Error(`Osiągnięto maksymalną liczbę ${maxPhotos} zdjęć.`);
    }

    const enriched = await this.uploadPhotosToDrive([photoData], object.name, session.stageName);
    await this.photosService.addMultiplePhotos(object.id, session.stageId, enriched);
    await this.historyService.recordPhotoAdded(
      object.id,
      session.stageId,
      user.id.toString(),
      user.username,
    );
  }

  private async showUploadResult(session: UserSessionEntity, messageId: number): Promise<void> {
    try {
      const object = await this.objectsService.findById(session.objectId);
      const newCount = await this.photosService.countPhotosForStage(object.id, session.stageId);
      const maxPhotos = this.photosService.getMaxPhotosAllowed();
      const minRequired = this.photosService.getMinPhotosRequired();

      const resultText =
        `✅ Dodano zdjęcia.\n\n` +
        `📷 <b>Etap ${session.stageIndex}: ${session.stageName}</b>\n` +
        `Łącznie: <b>${newCount}/${maxPhotos}</b>\n` +
        (newCount >= minRequired
          ? `✅ Minimalna liczba zdjęć osiągnięta.`
          : `⚠️ Potrzeba jeszcze <b>${minRequired - newCount}</b> zdjęcie(a).`);

      const finishKeyboard = this.telegramService.createInlineKeyboard([
        [{ text: '✅ Zakończ dodawanie zdjęć', callback_data: 'action:done_photos' }],
      ]);

      await this.telegramService.editMessageText(
        session.chatId,
        messageId,
        resultText,
        finishKeyboard,
      );
      await this.sessionsService.update(session.id, { finishButtonMessageId: messageId });
    } catch (error) {
      this.logger.error(`Error showing upload result: ${error.message}`);
      await this.telegramService.editMessageText(
        session.chatId,
        messageId,
        `❌ Błąd podczas dodawania zdjęć: ${error.message}`,
      );
    }
  }

  private async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
    try {
      const data = query.data;
      const chatId = query.message.chat.id.toString();
      const threadId = query.message.message_thread_id?.toString();
      const userId = query.from.id.toString();

      if (!threadId) {
        await this.telegramService.answerCallbackQuery(
          query.id,
          'Ta akcja musi być wykonana w wątku',
        );
        return;
      }

      const object = await this.objectsService.findByTelegramIds(
        chatId,
        threadId,
      );

      if (!object) {
        await this.telegramService.answerCallbackQuery(
          query.id,
          'Nie znaleziono obiektu',
        );
        return;
      }

      // Check if user has permission to manage this object
      const canManage = await this.coordinatorsService.canManageObject(
        userId,
        object.id,
      );

      if (!canManage) {
        await this.telegramService.answerCallbackQuery(
          query.id,
          '❌ Nie masz uprawnień do zarządzania tym obiektem',
        );
        return;
      }

      if (data === 'action:add_photos') {
        await this.handleAddPhotosAction(query, object, userId);
      } else if (data === 'action:done_photos') {
        await this.handleDonePhotosAction(query, object, userId);
      } else if (data === 'action:complete_stage') {
        await this.handleCompleteStageAction(query, object, userId);
      } else if (data === 'action:pause') {
        await this.handlePauseAction(query, object, userId);
      } else if (data === 'action:resume') {
        await this.handleResumeAction(query, object, userId);
      } else if (data === 'action:view_photos') {
        await this.handleViewPhotosAction(query, object);
      } else if (data === 'action:generate_report') {
        await this.handleGenerateReportAction(query, object);
      } else if (data.startsWith('view_stage:')) {
        const stageIndex = parseInt(data.split(':')[1], 10);
        await this.handleViewStagePhotos(query, object, stageIndex);
      }

      await this.telegramService.answerCallbackQuery(query.id);
    } catch (error) {
      // Handle Telegram-specific errors gracefully
      if (error.message.includes('message thread not found')) {
        this.logger.warn(`Callback query for deleted/closed topic: ${error.message}`);
        // Don't try to answer - the thread is gone
        return;
      }

      if (error.message.includes('query is too old')) {
        this.logger.warn(`Old callback query ignored: ${error.message}`);
        // Don't try to answer - query expired
        return;
      }

      this.logger.error(`Error handling callback query: ${error.message}`);

      // Try to answer, but don't fail if it doesn't work
      try {
        await this.telegramService.answerCallbackQuery(
          query.id,
          'Wystąpił błąd',
        );
      } catch (answerError) {
        // Ignore answer errors
      }
    }
  }

  private async handleAddPhotosAction(
    query: TelegramBot.CallbackQuery,
    object: any,
    userId: string,
  ) {
    const chatId = query.message.chat.id.toString();
    const threadId = object.telegramThreadId;

    if (!object.currentStageId) {
      await this.telegramService.sendMessageToThread(
        chatId,
        threadId,
        `❌ Brak aktywnego etapu dla tego obiektu.`,
      );
      return;
    }

    const currentCount = await this.photosService.countPhotosForStage(
      object.id,
      object.currentStageId,
    );

    const maxPhotos = this.photosService.getMaxPhotosAllowed();

    if (currentCount >= maxPhotos) {
      await this.telegramService.sendMessageToThread(
        chatId,
        threadId,
        `❌ Osiągnięto maksymalną liczbę ${maxPhotos} zdjęć dla tego etapu.`,
      );
      return;
    }

    // Delete any existing session first, then create a new one
    await this.sessionsService.delete(userId, chatId, threadId);

    const minPhotos = this.photosService.getMinPhotosRequired();

    const sentMsg = await this.telegramService.sendMessageToThread(
      chatId,
      threadId,
      `📷 Prześlij zdjęcia do etapu ${object.currentStage.stageIndex}: ${object.currentStage.stageName}.\n\nAktualnie: ${currentCount}/${maxPhotos}\nMinimum wymagane: ${minPhotos}\n\nMożesz wysyłać zdjęcia jako album lub pojedynczo.`,
    );

    await this.sessionsService.create({
      userId,
      chatId,
      threadId,
      state: 'AWAITING_PHOTOS',
      objectId: object.id,
      stageId: object.currentStageId,
      stageIndex: object.currentStage.stageIndex,
      stageName: object.currentStage.stageName,
      finishButtonMessageId: sentMsg.message_id,
    });
  }

  private async handleDonePhotosAction(
    query: TelegramBot.CallbackQuery,
    object: any,
    userId: string,
  ) {
    const chatId = query.message.chat.id.toString();
    const threadId = object.telegramThreadId;

    await this.sessionsService.delete(userId, chatId, threadId);

    const currentCount = await this.photosService.countPhotosForStage(
      object.id,
      object.currentStageId,
    );

    const keyboard = this.telegramService.createStageActionButtons();

    await this.telegramService.sendMessageToThread(
      chatId,
      threadId,
      `✅ Sesja przesyłania zdjęć zakończona. Łączna liczba zdjęć: ${currentCount}\n\nSkorzystaj z przycisków poniżej, aby kontynuować.`,
      keyboard,
    );
  }

  private async handleCompleteStageAction(
    query: TelegramBot.CallbackQuery,
    object: any,
    userId: string,
  ) {
    const chatId = query.message.chat.id.toString();
    const threadId = object.telegramThreadId;

    if (!object.currentStageId) {
      await this.telegramService.sendMessageToThread(
        chatId,
        threadId,
        `❌ Brak aktywnego etapu dla tego obiektu.`,
      );
      return;
    }

    const hasMinPhotos = await this.photosService.validateMinimumPhotos(
      object.id,
      object.currentStageId,
    );

    if (!hasMinPhotos) {
      const minPhotos = this.photosService.getMinPhotosRequired();
      const currentCount = await this.photosService.countPhotosForStage(
        object.id,
        object.currentStageId,
      );

      await this.telegramService.sendMessageToThread(
        chatId,
        threadId,
        `❌ Nie można zakończyć etapu. Wymagane co najmniej ${minPhotos} zdjęcia. Aktualnie: ${currentCount}`,
      );
      return;
    }

    // Store the completed stage info before progressing
    const completedStageIndex = object.currentStage.stageIndex;
    const completedStageName = object.currentStage.stageName;

    // Complete current stage
    await this.stagesService.completeStage(object.id, object.currentStageId);

    await this.historyService.recordStageCompleted(
      object.id,
      object.currentStageId,
      userId,
      query.from.username,
    );

    // Progress to next stage
    const updatedObject = await this.objectsService.progressToNextStage(object.id);

    // Clear any active photo upload session
    await this.sessionsService.delete(userId, chatId, threadId);

    // Add debug logging
    this.logger.debug(`Updated object currentStageId: ${updatedObject.currentStageId}`);
    this.logger.debug(`Updated object currentStage: ${updatedObject.currentStage ? `${updatedObject.currentStage.stageIndex}:${updatedObject.currentStage.stageName}` : 'NULL'}`);

    if (updatedObject.status === 'DONE') {
      await this.telegramService.sendMessageToThread(
        chatId,
        threadId,
        `🎉 <b>Gratulacje!</b>\n\nWszystkie etapy zakończone dla: <b>${object.name}</b>\n\nEtap ${completedStageIndex}: ${completedStageName} był ostatnim etapem.\n\nObiekt jest teraz oznaczony jako ZAKOŃCZONY.`,
      );
    } else {
      const keyboard = this.telegramService.createStageActionButtons();

      if (!updatedObject.currentStage) {
        this.logger.error(`Current stage is NULL after progression! currentStageId: ${updatedObject.currentStageId}`);
        await this.telegramService.sendMessageToThread(
          chatId,
          threadId,
          `❌ Błąd: Nie udało się załadować informacji o kolejnym etapie. Skontaktuj się z pomocą techniczną.`,
        );
        return;
      }

      await this.telegramService.sendMessageToThread(
        chatId,
        threadId,
        `✅ Etap ${completedStageIndex}: ${completedStageName} zakończony!\n\n🔄 Przechodzenie do Etapu ${updatedObject.currentStage.stageIndex}: <b>${updatedObject.currentStage.stageName}</b>`,
        keyboard,
      );
    }
  }

  private async handlePauseAction(
    query: TelegramBot.CallbackQuery,
    object: any,
    userId: string,
  ) {
    const chatId = query.message.chat.id.toString();
    const threadId = object.telegramThreadId;

    await this.objectsService.togglePause(object.id);

    await this.historyService.recordPaused(
      object.id,
      object.currentStageId,
      userId,
      query.from.username,
    );

    const keyboard = this.telegramService.createPausedActionButtons();

    await this.telegramService.sendMessageToThread(
      chatId,
      threadId,
      `⏸ Obiekt wstrzymany. Dzienne przypomnienia nie będą wysyłane do momentu wznowienia.`,
      keyboard,
    );
  }

  private async handleResumeAction(
    query: TelegramBot.CallbackQuery,
    object: any,
    userId: string,
  ) {
    const chatId = query.message.chat.id.toString();
    const threadId = object.telegramThreadId;

    await this.objectsService.togglePause(object.id);

    await this.historyService.recordResumed(
      object.id,
      object.currentStageId,
      userId,
      query.from.username,
    );

    const keyboard = this.telegramService.createStageActionButtons();

    await this.telegramService.sendMessageToThread(
      chatId,
      threadId,
      `▶️ Obiekt wznowiony. Dzienne przypomnienia będą kontynuowane.`,
      keyboard,
    );
  }

  private formatWelcomeMessage(objectName: string, firstStageName: string): string {
    return `🏗 <b>Nowy obiekt utworzony</b>\n\nObiekt: <b>${objectName}</b>\nEtap: <b>1 — ${firstStageName}</b>\n\nSkorzystaj z przycisków poniżej, aby zarządzać tym obiektem.`;
  }

  private async handleViewPhotosAction(
    query: TelegramBot.CallbackQuery,
    object: any,
  ) {
    const chatId = query.message.chat.id.toString();
    const threadId = object.telegramThreadId;

    // Send processing message
    const processingMsg = await this.telegramService.sendProcessingMessage(
      chatId,
      threadId,
      '⏳ Ładowanie listy etapów...',
    );

    // Get all stages
    const allStages = await this.stagesService.getAllMasterStages();

    // Create keyboard with stage buttons
    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
    for (const stage of allStages) {
      const photoCount = await this.photosService.countPhotosForStage(
        object.id,
        stage.id,
      );

      keyboard.push([
        {
          text: `${stage.stageIndex}. ${stage.stageName} (${photoCount} zdjęć)`,
          callback_data: `view_stage:${stage.stageIndex}`,
        },
      ]);
    }

    // Delete processing message
    await this.telegramService.deleteMessage(chatId, processingMsg.message_id);

    await this.bot.sendMessage(
      chatId,
      `📸 Wybierz etap, aby zobaczyć zdjęcia:`,
      {
        message_thread_id: parseInt(threadId, 10),
        reply_markup: {
          inline_keyboard: keyboard,
        },
      } as TelegramBot.SendMessageOptions,
    );
  }

  private async handleViewStagePhotos(
    query: TelegramBot.CallbackQuery,
    object: any,
    stageIndex: number,
  ) {
    const chatId = query.message.chat.id.toString();
    const threadId = object.telegramThreadId;

    // Send processing message
    const processingMsg = await this.telegramService.sendProcessingMessage(
      chatId,
      threadId,
      '⏳ Ładowanie zdjęć...',
    );

    try {
      const stage = await this.stagesService.getMasterStageByIndex(stageIndex);
      const photos = await this.photosService.findByObjectAndStage(
        object.id,
        stage.id,
      );

      // Delete processing message
      await this.telegramService.deleteMessage(chatId, processingMsg.message_id);

      if (photos.length === 0) {
        await this.telegramService.sendMessageToThread(
          chatId,
          threadId,
          `Brak zdjęć dla etapu: ${stage.stageName}`,
        );
        return;
      }

      await this.telegramService.sendMessageToThread(
        chatId,
        threadId,
        `📸 Zdjęcia dla etapu ${stage.stageName} (łącznie ${photos.length}):`,
      );

      // Send photos in batches of 10 (Telegram media group limit)
      for (let i = 0; i < photos.length; i += 10) {
        const batch = photos.slice(i, i + 10);

        if (batch.length === 1) {
          // Send single photo
          await this.bot.sendPhoto(chatId, batch[0].telegramFileId, {
            message_thread_id: parseInt(threadId, 10),
            caption: `Zdjęcie ${i + 1}/${photos.length}`,
          });
        } else {
          // Send as media group
          const mediaGroup = batch.map((photo, index) => ({
            type: 'photo' as const,
            media: photo.telegramFileId,
            caption: i + index === 0 ? `Zdjęcia ${i + 1}-${i + batch.length}/${photos.length}` : undefined,
          }));

          await this.bot.sendMediaGroup(chatId, mediaGroup, {
            message_thread_id: parseInt(threadId, 10),
          } as any);
        }

        // Small delay between batches to avoid rate limiting
        if (i + 10 < photos.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      this.logger.log(
        `Sent ${photos.length} photos for stage ${stage.stageName} of object ${object.name}`,
      );
    } catch (error) {
      this.logger.error(`Error viewing stage photos: ${error.message}`);

      // Try to delete processing message if it exists
      try {
        await this.telegramService.deleteMessage(chatId, processingMsg.message_id);
      } catch (e) {
        // Ignore delete errors
      }

      await this.telegramService.sendMessageToThread(
        chatId,
        threadId,
        `❌ Błąd podczas ładowania zdjęć: ${error.message}`,
      );
    }
  }

  private async handleGenerateReportAction(
    query: TelegramBot.CallbackQuery,
    object: any,
  ) {
    const chatId = query.message.chat.id.toString();
    const threadId = object.telegramThreadId;

    // Send processing message
    const processingMsg = await this.telegramService.sendProcessingMessage(
      chatId,
      threadId,
      '⏳ Generowanie raportu...',
    );

    try {
      // Get all stages for this object
      const allStages = await this.stagesService.getAllMasterStages();

      // Count photos for each stage
      const photoCountsMap = new Map<string, number>();
      for (const stage of allStages) {
        const count = await this.photosService.countPhotosForStage(
          object.id,
          stage.id,
        );
        photoCountsMap.set(stage.id, count);
      }

      // Generate report
      const report = await this.objectsService.generateReport(
        object.id,
        photoCountsMap,
      );

      // Delete processing message
      await this.telegramService.deleteMessage(chatId, processingMsg.message_id);

      // Send report
      await this.telegramService.sendMessageToThread(
        chatId,
        threadId,
        report,
      );

      this.logger.log(`Generated report for object ${object.name}`);
    } catch (error) {
      this.logger.error(`Error generating report: ${error.message}`);

      // Try to delete processing message if it exists
      try {
        await this.telegramService.deleteMessage(chatId, processingMsg.message_id);
      } catch (e) {
        // Ignore delete errors
      }

      await this.telegramService.sendMessageToThread(
        chatId,
        threadId,
        `❌ Błąd podczas generowania raportu: ${error.message}`,
      );
    }
  }

  private async uploadPhotosToDrive(
    photosData: TelegramPhotoData[],
    objectName: string,
    stageName: string,
  ): Promise<TelegramPhotoData[]> {
    // If Google Drive is not enabled, return photos as-is
    if (!this.googleDriveStorage.isEnabled()) {
      this.logger.debug('Google Drive not enabled, skipping Drive upload');
      return photosData;
    }

    const enrichedPhotos: TelegramPhotoData[] = [];

    for (let i = 0; i < photosData.length; i++) {
      const photoData = photosData[i];

      try {
        // Download photo from Telegram
        const photoBuffer = await this.telegramService.downloadPhoto(photoData.fileId);

        // Generate filename: photo_<timestamp>_<index>.jpg
        const timestamp = Date.now();
        const fileName = `photo_${timestamp}_${i + 1}.jpg`;

        // Upload to Google Drive
        const driveResult = await this.googleDriveStorage.uploadPhoto(
          photoBuffer,
          objectName,
          stageName,
          fileName,
        );

        this.logger.log(`Photo uploaded to Google Drive: ${driveResult.driveFileId}`);

        // Enrich photo data with Drive info
        enrichedPhotos.push({
          ...photoData,
          fileName,
          driveFileId: driveResult.driveFileId,
          driveUrl: driveResult.driveUrl,
          driveFolderPath: driveResult.driveFolderPath,
        });
      } catch (error) {
        this.logger.error(`Failed to upload photo to Google Drive: ${error.message}`);
        // Still save photo with Telegram data only
        enrichedPhotos.push(photoData);
      }
    }

    return enrichedPhotos;
  }
}
