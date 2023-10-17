import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { IRFGameId } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';

export const name = 'ids';
export const ephemeral = false;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Returns all IRF Game IDs')
  .setDMPermission(false);
export async function run(client: CustomClient, interaction: ChatInputCommandInteraction): Promise<void> {
  interaction.editReply({
    embeds: [
      new EmbedBuilder({
        color: 0xde2821,
        title: 'IRF Game IDs',
        // Convert the map to an array of strings, then join them with newlines
        description: Object.entries(IRFGameId)
          .filter(([_k, v]) => typeof v === 'number')
          .map(([k, v]) => `**${k}**: ${v}`)
          .join('\n'),
        timestamp: new Date()
      })
    ]
  });
  return;
}
