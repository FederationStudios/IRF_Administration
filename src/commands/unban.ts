import {
  ChatInputCommandInteraction,
  CommandInteractionOptionResolver,
  GuildMember,
  GuildMemberRoleManager,
  type GuildTextBasedChannel,
  SlashCommandBuilder
} from 'discord.js';
import { default as config } from '../config.json' with { type: 'json' };
import { IRFGameId, ResultMessage, getGroup, getRoblox, getRowifi, interactionEmbed, toConsole } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';
const { channels, roblox } = config;

const options = Object.entries(IRFGameId)
  .map(([k, v]) => {
    return { name: k, value: Number(v) };
  })
  .filter((v) => !isNaN(v.value));

export const name = 'unban';
export const ephemeral = false;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Unbans a user from an IRF game')
  .setDMPermission(false)
  .addStringOption((option) => {
    return option.setName('user_id').setDescription('Roblox username or ID').setRequired(true);
  })
  .addNumberOption((option) => {
    return option
      .setName('game_id')
      .setDescription('Roblox game ID')
      .setRequired(true)
      .addChoices(...options);
  })
  .addStringOption((option) => {
    return option.setName('reason').setDescription('Reason for unban').setRequired(true);
  });
export async function run(
  client: CustomClient,
  interaction: ChatInputCommandInteraction,
  options: CommandInteractionOptionResolver
) {
  const [gameName, gameId] = [IRFGameId[options.getNumber('game_id', true)], options.getNumber('game_id', true)];
  // Check roles
  if (!(interaction.member.roles as GuildMemberRoleManager).cache.find((r) => r.name === 'Administration Access'))
    return interactionEmbed(3, ResultMessage.UserPermission, interaction);
  const id = await getRoblox(options.getString('user_id', true));
  if (id.success === false) return interactionEmbed(3, id.error, interaction);

  // Rowifi link
  const rowifi = await getRowifi(interaction.user.id, client);
  if (rowifi.success === false) return interactionEmbed(3, rowifi.error, interaction);

  // Find bans
  const bans = await client.models.bans.findAll({
    where: {
      user: id.user.id,
      game: options.getNumber('game_id', true)
    }
  });
  // If no bans exists, return
  if (bans.length === 0) {
    return interactionEmbed(3, `No bans exist for \`${id.user.name}\` (${id.user.id}) on ${gameName}`, interaction);
  }
  // If FairPlay ban...
  if (bans[0].reason.includes('FairPlay')) {
    const data = await getGroup(rowifi.username, roblox.developerGroup);
    // Check if they are lower than the developer rank in the developer group
    if (data.success === true && data.data.role.rank < roblox.developerRank)
      return interactionEmbed(
        3,
        'You are not authorized to unban a FairPlay ban. Contact a developer to arrange the unban',
        interaction
      );
  }

  // Destroy the ban
  let error = false;
  try {
    bans
      .filter((b) => !b.isSoftDeleted())
      .forEach((b) => {
        // Add unban reason and destroy
        b.update({
          unbanReason: options.getString('reason')
        });
        b.destroy();
      });
  } catch (e) {
    // Error handling
    toConsole(
      `An error occurred while removing a ban for ${id.user.name} (${id.user.id})\n> ${String(e)}`,
      new Error().stack,
      client
    );
    error = true;
  }
  // Return an error to the user
  if (error) return interactionEmbed(3, ResultMessage.DatabaseError, interaction);
  const unban = await client.channels.fetch(channels.unban);
  if (!unban || !unban.isTextBased()) return interactionEmbed(3, ResultMessage.Unknown, interaction);
  // Send a message to the unban channel
  (unban as GuildTextBasedChannel).send({
    embeds: [
      {
        title: `${(interaction.member as GuildMember).nickname || interaction.user.username} unbanned => ${
          id.user.name
        }`,
        description: `**${interaction.user.id}** has removed a ban for ${id.user.name} (${id.user.id}) on ${gameName} (${gameId})`,
        color: 0x00ff00,
        fields: [
          {
            name: 'Game',
            value: `${gameName} (${gameId})`,
            inline: true
          },
          {
            name: 'User',
            value: `${id.user.name} (${id.user.id})`,
            inline: true
          },
          {
            name: 'Reason',
            value: options.getString('reason'),
            inline: true
          },
          {
            name: 'Original Ban Reason',
            value: bans[0].reason,
            inline: false
          }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  });

  // Return a success message to the user
  return interactionEmbed(
    1,
    `Removed ban for ${id.user.name} (${id.user.id}) on ${gameName} (${gameId})\n> Reason: ${options.getString(
      'reason'
    )}`,
    interaction
  );
}
