import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getRowifi } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';

export const name = 'report';
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Report a member to a division or sub-division');
export const ephemeral = true;
export async function run(client: CustomClient, interaction: ChatInputCommandInteraction): Promise<void> {
  // Verify Rowifi
  const rowifi = await getRowifi(interaction.user.id, client);
  if (rowifi.success === false) {
    interaction.editReply({ content: rowifi.error });
    return;
  }
  // Report form has been moved. Provide the new link
  const invUrl = 'https://discord.gg/irf-military-451841329765548069';
  interaction.editReply({
    content: `Looking for the report form? We've moved this to the Military server. [Click here](${invUrl}) or use this invite link: ${invUrl}`
  });
  // Return
  return;
}
