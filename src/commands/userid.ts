import { ChatInputCommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } from 'discord.js';
import { getRoblox, interactionEmbed } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';

export const name = 'userid';
export const ephemeral = false;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Provides a Roblox ID when given a username')
  .addStringOption((option) => {
    return option.setName('username').setDescription('Roblox username').setRequired(true);
  });
export async function run(
  _client: CustomClient,
  interaction: ChatInputCommandInteraction,
  options: CommandInteractionOptionResolver
) {
  // Fetch Roblox ID
  const roblox = await getRoblox(options.getString('username', true));
  if (roblox.success === false) return interactionEmbed(3, roblox.error, interaction);

  // Fetch avatar
  const avatar = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar?userIds=${roblox.user.id}&size=720x720&format=Png&isCircular=false`
  )
    .then((r) => r.json())
    .then((r) => r.data[0].imageUrl)
    .catch(() => 'https://cdn.discordapp.com/embed/avatars/5.png?size=1024');
  // Reply to interaction
  return interaction.editReply({
    embeds: [
      {
        title: `Roblox ID for ${roblox.user.name}`,
        color: 0xde2821,
        description: `${roblox.user.id}`,
        thumbnail: {
          url: avatar
        },
        footer: {
          text: `This user also goes by "${roblox.user.displayName}" as their display name`
        }
      }
    ]
  });
}
