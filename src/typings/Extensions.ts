import {
  ChatInputCommandInteraction,
  Client,
  ModalSubmitFields,
  ModalSubmitInteraction,
  SlashCommandBuilder
} from 'discord.js';
import { Sequelize } from 'sequelize';
import type { initModels } from '../models/init-models.js';

interface CustomClient extends Client {
  commands?: Map<string, CommandFile>;
  modals?: Map<string, ModalFile>;
  sequelize?: Sequelize;
  models?: ReturnType<typeof initModels>;
  // Manually importing types due to TS not being able to find them
  channels: Client['channels'];
  guilds: Client['guilds'];
  user: Client['user'];
  users: Client['users'];
}
interface CommandFile {
  name: string;
  ephemeral: boolean;
  modal?: boolean;
  data: SlashCommandBuilder;
  run: (
    client: CustomClient,
    interaction: ChatInputCommandInteraction,
    options: ChatInputCommandInteraction['options']
  ) => Promise<void>;
}
interface ModalFile {
  name: string;
  run: (client: CustomClient, interaction: ModalSubmitInteraction, fields: ModalSubmitFields) => Promise<void>;
}
/**
 * Expected structure:
 * => servers[GameId][JobId] = [Players, new Date().toUTCString()];
 */
type ServerList = {
  /**
   * @param key ID of the game
   */
  [key: string]: {
    /**
     * @param key JobId of the server
     */
    [key: string]: [players: number[], date: string];
  };
};
type RobloxUserPresenceData = {
  userPresenceType: number;
  lastLocation: string;
  placeId: number;
  rootPlaceId: number;
  gameId: string;
  universeId: number;
  userId: number;
  lastOnline: string;
  invisibleModeExpiry: string;
};

export { CommandFile, CustomClient, ModalFile, RobloxUserPresenceData, ServerList };
