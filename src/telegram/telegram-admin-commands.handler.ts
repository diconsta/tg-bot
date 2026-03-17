import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { ObjectsService } from '../objects/objects.service';
import { TelegramService } from './telegram.service';
import { CoordinatorRole } from '../common/enums';

@Injectable()
export class TelegramAdminCommandsHandler {
  private readonly logger = new Logger(TelegramAdminCommandsHandler.name);

  constructor(
    private coordinatorsService: CoordinatorsService,
    private objectsService: ObjectsService,
    private telegramService: TelegramService,
  ) {}

  async handleCommand(msg: TelegramBot.Message): Promise<void> {
    const userId = msg.from?.id.toString();
    const text = msg.text;
    const chatId = msg.chat.id.toString();

    if (!userId || !text) {
      return;
    }

    // Check if user is admin
    const isAdmin = await this.coordinatorsService.isAdmin(userId);

    if (!isAdmin) {
      // Silently ignore commands from non-admins
      return;
    }

    try {
      if (text.startsWith('/create_coordinator')) {
        await this.handleCreateCoordinator(msg, chatId);
      } else if (text.startsWith('/assign')) {
        await this.handleAssign(msg, chatId);
      } else if (text.startsWith('/unassign')) {
        await this.handleUnassign(msg, chatId);
      } else if (text.startsWith('/promote')) {
        await this.handlePromote(msg, chatId);
      } else if (text.startsWith('/list_coordinators')) {
        await this.handleListCoordinators(msg, chatId);
      } else if (text.startsWith('/coordinators')) {
        await this.handleObjectCoordinators(msg, chatId);
      } else if (text.startsWith('/help_admin')) {
        await this.handleAdminHelp(msg, chatId);
      }
    } catch (error) {
      this.logger.error(`Error handling admin command: ${error.message}`, error.stack);
      await this.telegramService.sendMessage(
        chatId,
        `❌ Błąd: ${error.message}`,
      );
    }
  }

  private async handleCreateCoordinator(
    msg: TelegramBot.Message,
    chatId: string,
  ): Promise<void> {
    // Parse: /create_coordinator @username [COORDINATOR|VIEWER|ADMIN]
    const parts = msg.text.split(' ');

    if (parts.length < 2) {
      await this.telegramService.sendMessage(
        chatId,
        '❌ Użycie: /create_coordinator @username [COORDINATOR|VIEWER|ADMIN]',
      );
      return;
    }

    const username = parts[1].replace('@', '');
    const role = (parts[2] as CoordinatorRole) || CoordinatorRole.COORDINATOR;

    // Note: We need the user's Telegram ID, not just username
    // In practice, they should interact with the bot first
    await this.telegramService.sendMessage(
      chatId,
      `ℹ️ Aby dodać koordynatora, poproś @${username} o wysłanie dowolnej wiadomości do tego bota, a następnie użyj:\n/assign @${username} <nazwa_obiektu>`,
    );
  }

  private async handleAssign(
    msg: TelegramBot.Message,
    chatId: string,
  ): Promise<void> {
    // Parse: /assign @username object_name
    const parts = msg.text.split(' ');

    if (parts.length < 3) {
      await this.telegramService.sendMessage(
        chatId,
        '❌ Użycie: /assign @username nazwa_obiektu',
      );
      return;
    }

    const username = parts[1].replace('@', '');
    const objectName = parts.slice(2).join(' ');

    // Find coordinator by username
    const coordinators = await this.coordinatorsService.findAll();
    const coordinator = coordinators.find((c) => c.username === username);

    if (!coordinator) {
      await this.telegramService.sendMessage(
        chatId,
        `❌ Koordynator @${username} nie znaleziony. Poproś go o wysłanie wiadomości do bota.`,
      );
      return;
    }

    // Find object by name (fuzzy match)
    const allObjects = await this.objectsService.findActiveObjects();
    const object = allObjects.find((o) =>
      o.name.toLowerCase().includes(objectName.toLowerCase()),
    );

    if (!object) {
      await this.telegramService.sendMessage(
        chatId,
        `❌ Obiekt "${objectName}" nie znaleziony.`,
      );
      return;
    }

    await this.coordinatorsService.assignToObject(coordinator.id, object.id);

    await this.telegramService.sendMessage(
      chatId,
      `✅ Przypisano @${username} do "${object.name}"`,
    );
  }

  private async handleUnassign(
    msg: TelegramBot.Message,
    chatId: string,
  ): Promise<void> {
    // Parse: /unassign @username object_name
    const parts = msg.text.split(' ');

    if (parts.length < 3) {
      await this.telegramService.sendMessage(
        chatId,
        '❌ Użycie: /unassign @username nazwa_obiektu',
      );
      return;
    }

    const username = parts[1].replace('@', '');
    const objectName = parts.slice(2).join(' ');

    const coordinators = await this.coordinatorsService.findAll();
    const coordinator = coordinators.find((c) => c.username === username);

    if (!coordinator) {
      await this.telegramService.sendMessage(
        chatId,
        `❌ Koordynator @${username} nie znaleziony.`,
      );
      return;
    }

    const allObjects = await this.objectsService.findActiveObjects();
    const object = allObjects.find((o) =>
      o.name.toLowerCase().includes(objectName.toLowerCase()),
    );

    if (!object) {
      await this.telegramService.sendMessage(
        chatId,
        `❌ Obiekt "${objectName}" nie znaleziony.`,
      );
      return;
    }

    await this.coordinatorsService.unassignFromObject(coordinator.id, object.id);

    await this.telegramService.sendMessage(
      chatId,
      `✅ Usunięto przypisanie @${username} od "${object.name}"`,
    );
  }

  private async handlePromote(
    msg: TelegramBot.Message,
    chatId: string,
  ): Promise<void> {
    // Parse: /promote @username ADMIN|COORDINATOR|VIEWER
    const parts = msg.text.split(' ');

    if (parts.length < 3) {
      await this.telegramService.sendMessage(
        chatId,
        '❌ Użycie: /promote @username ADMIN|COORDINATOR|VIEWER',
      );
      return;
    }

    const username = parts[1].replace('@', '');
    const newRole = parts[2].toUpperCase() as CoordinatorRole;

    if (!Object.values(CoordinatorRole).includes(newRole)) {
      await this.telegramService.sendMessage(
        chatId,
        '❌ Nieprawidłowa rola. Użyj: ADMIN, COORDINATOR lub VIEWER',
      );
      return;
    }

    const coordinators = await this.coordinatorsService.findAll();
    const coordinator = coordinators.find((c) => c.username === username);

    if (!coordinator) {
      await this.telegramService.sendMessage(
        chatId,
        `❌ Koordynator @${username} nie znaleziony.`,
      );
      return;
    }

    await this.coordinatorsService.updateRole(coordinator.id, newRole);

    await this.telegramService.sendMessage(
      chatId,
      `✅ Zmieniono rolę @${username} na ${newRole}`,
    );
  }

  private async handleListCoordinators(
    msg: TelegramBot.Message,
    chatId: string,
  ): Promise<void> {
    const coordinators = await this.coordinatorsService.findAll();

    if (coordinators.length === 0) {
      await this.telegramService.sendMessage(
        chatId,
        '📋 Brak koordynatorów.',
      );
      return;
    }

    let message = '📋 <b>Lista koordynatorów</b>\n\n';

    for (const coord of coordinators) {
      const statusIcon = coord.isActive ? '✅' : '❌';
      const objectCount = coord.objects?.length || 0;

      message += `${statusIcon} <b>@${coord.username || coord.telegramUserId}</b>\n`;
      message += `   Rola: ${coord.role}\n`;
      message += `   Obiekty: ${objectCount}\n`;
      message += `   Status: ${coord.isActive ? 'Aktywny' : 'Nieaktywny'}\n\n`;
    }

    await this.telegramService.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });
  }

  private async handleObjectCoordinators(
    msg: TelegramBot.Message,
    chatId: string,
  ): Promise<void> {
    // Parse: /coordinators object_name
    const parts = msg.text.split(' ');

    if (parts.length < 2) {
      await this.telegramService.sendMessage(
        chatId,
        '❌ Użycie: /coordinators nazwa_obiektu',
      );
      return;
    }

    const objectName = parts.slice(1).join(' ');

    const allObjects = await this.objectsService.findActiveObjects();
    const object = allObjects.find((o) =>
      o.name.toLowerCase().includes(objectName.toLowerCase()),
    );

    if (!object) {
      await this.telegramService.sendMessage(
        chatId,
        `❌ Obiekt "${objectName}" nie znaleziony.`,
      );
      return;
    }

    const coordinators = await this.coordinatorsService.findCoordinatorsForObject(
      object.id,
    );

    if (coordinators.length === 0) {
      await this.telegramService.sendMessage(
        chatId,
        `📋 Brak przypisanych koordynatorów do "${object.name}"`,
      );
      return;
    }

    let message = `📋 <b>Koordynatorzy dla "${object.name}"</b>\n\n`;

    for (const coord of coordinators) {
      message += `• @${coord.username || coord.telegramUserId} (${coord.role})\n`;
    }

    await this.telegramService.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });
  }

  private async handleAdminHelp(
    msg: TelegramBot.Message,
    chatId: string,
  ): Promise<void> {
    const helpMessage = `
🔧 <b>Komendy administratora</b>

<b>Zarządzanie koordynatorami:</b>
/assign @username nazwa_obiektu - Przypisz koordynatora do obiektu
/unassign @username nazwa_obiektu - Usuń przypisanie
/promote @username ROLA - Zmień rolę koordynatora
/list_coordinators - Lista wszystkich koordynatorów
/coordinators nazwa_obiektu - Pokaż koordynatorów obiektu

<b>Role:</b>
• ADMIN - Może zarządzać wszystkim
• COORDINATOR - Może zarządzać przypisanymi obiektami
• VIEWER - Dostęp tylko do odczytu

<b>Uwagi:</b>
• Użytkownicy muszą wysłać wiadomość do bota przed przypisaniem
• Można używać częściowych nazw obiektów
• Tylko administratorzy mogą używać tych komend
    `;

    await this.telegramService.sendMessage(chatId, helpMessage.trim(), {
      parse_mode: 'HTML',
    });
  }
}
