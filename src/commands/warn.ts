import { ChatInputCommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } from 'discord.js';
import { getRoblox, getRowifi, interactionEmbed, IRFGameId, paginationRow } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';

const options = Object.entries(IRFGameId)
  .map(([k, v]) => {
    return { name: k, value: Number(v) };
  })
  .filter((v) => !isNaN(v.value));

export const name = 'warning';
export const ephemeral = false;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Adds or views warnings against a user')
  .addSubcommand((subcommand) => {
    return subcommand
      .setName('add')
      .setDescription('Adds a warning to a user')
      .addStringOption((option) => {
        return option.setName('user').setDescription('The user to add the warning to').setRequired(true);
      })
      .addNumberOption((option) => {
        return option
          .setName('game')
          .setDescription('The game to add the warning to')
          .setRequired(true)
          .addChoices(...options);
      })
      .addStringOption((option) => {
        return option.setName('reason').setDescription('The reason for the warning').setRequired(true).setMinLength(16);
      });
  })
  .addSubcommand((subcommand) => {
    return subcommand
      .setName('view')
      .setDescription('Views warnings against a user')
      .addStringOption((option) => {
        return option.setName('user').setDescription('The user to view the warnings of').setRequired(true);
      });
  })
  .setDMPermission(false);
export async function run(
  client: CustomClient,
  interaction: ChatInputCommandInteraction,
  options: CommandInteractionOptionResolver
): Promise<void> {
  const rowifi = await getRowifi(interaction.user.id, client);
  if (rowifi.success === false) {
    interaction.editReply({ content: rowifi.error });
    return;
  }
  const target = await getRoblox(options.getString('user', true));
  if (target.success === false) {
    interaction.editReply({ content: target.error });
    return;
  }
  switch (options.getSubcommand()) {
    case 'add': {
      const [gameName, gameId] = [IRFGameId[options.getNumber('game', true)], options.getNumber('game', true)];
      const warnings = await client.models.warns.findAll({ where: { user: target.user.id } });
      if (warnings.length > 0) {
        await interactionEmbed(2, 'This user already has an existing warning (5s)', interaction);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      await client.models.warns.create({
        user: target.user.id,
        game: options.getNumber('game', true),
        mod: {
          discord: interaction.user.id,
          roblox: rowifi.roblox
        },
        data: {
          proof: '', // TODO: Add proof as an internal field
          privacy: 'Public'
        },
        reason: options.getString('reason', true)
      });
      const embed = {
        title: 'Warning Added',
        description: `${interaction.user.toString()} has issued a warning against ${target.user.name} (${target.user.id})`,
        color: 0x00ff00,
        fields: [
          {
            name: 'User',
            value: `${target.user.name} "${target.user.displayName}" (${target.user.id})`,
            inline: true
          },
          { name: 'Game', value: `${gameName} (${gameId})`, inline: true },
          { name: 'Reason', value: options.getString('reason', true), inline: true }
        ]
      };
      interaction.editReply({
        content: 'Warning pushed! User will be notified if they are in-game',
        embeds: [embed]
      });
      break;
    }
    case 'view': {
      const embeds = [];
      const warnings = await client.models.warns.findAll({ where: { user: target.user.id }, paranoid: false });
      for (const warn of warnings) {
        embeds.push({
          title: `Warning ${warnings.indexOf(warn) + 1}`,
          color: warn.isSoftDeleted() ? 0x00ff00 : 0xff0000,
          fields: [
            { name: 'Game', value: warn.game, inline: true },
            { name: 'Reason', value: warn.reason, inline: true },
            { name: 'Moderator', value: `Roblox ID: ${warn.mod.roblox}\nDiscord: <@${warn.mod.discord}>`, inline: true }
          ],
          timestamp: warn.createdAt,
          footer: {
            text: `ID: ${warn.warnId} - Item ${warnings.indexOf(warn) + 1} of ${warnings.length}`
          }
        });
      }
      paginationRow(interaction, new Array(embeds.length).fill([]), { content: '' }, embeds);
      break;
    }
    default: {
      interaction.editReply({ content: 'Please refresh your Discord. That command does not exist' });
      break;
    }
  }
}
