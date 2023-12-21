import { ChatInputCommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } from 'discord.js';
import { getRoblox, interactionEmbed } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';

export const name = 'username';
export const ephemeral = false;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Provides a Roblox username when given a Roblox ID')
  .addIntegerOption((option) => {
    return option.setName('id').setDescription('Roblox ID').setRequired(true);
  });
export async function run(
  _client: CustomClient,
  interaction: ChatInputCommandInteraction,
  options: CommandInteractionOptionResolver
) {
  // Fetch Roblox ID
  const roblox = await getRoblox(options.getInteger('id', true));
  if (roblox.success === false) return interactionEmbed(3, roblox.error, interaction);

  // Fetch avatar
  const avatar = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar?userIds=${roblox.user.id}&size=720x720&format=Png&isCircular=false`
  )
    .then((r) => r.json())
    .then((r) => r.data[0].imageUrl)
    .catch(() => 'https://cdn.discordapp.com/embed/avatars/5.png');
  return interaction.editReply({
    embeds: [
      {
        title: `Roblox Username for ${roblox.user.id}`,
        color: 0xde2821,
        description: `${roblox.user.name}`,
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
