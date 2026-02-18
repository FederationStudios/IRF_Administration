import { ChatInputCommandInteraction, CommandInteractionOptionResolver, EmbedBuilder, GuildMemberRoleManager, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getGroup, getRoblox, getRowifi, interactionEmbed, IRFGameId, paginationRow } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';
const { channels, roblox } = config;
import { default as config } from '../config.json' with { type: 'json' };

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
  .addSubcommand((subcommand) => {
    return subcommand
      .setName('alter')
      .setDescription('Alters the warning database')
      .addStringOption((option) => {
        return option
          .setName('warnId')
          .setDescription('Unique ID of the warning to edit')
          .setMinLength(36)
          .setMaxLength(36)
      })
      .addStringOption((option) => {
        return option
          .setName('action')
          .setDescription('The action to perform on the warning (delete, edit)')
          .setRequired(true)
          .addChoices(
            // The warning remains. No edits are performed
            { name: 'Keep', value: 'Keep' },
            // The warning text has a strike through on Discord to represent that it was removed. It will say who removed it.
            { name: 'Remove', value: 'Remove' },
            // The warning is restricted to NSC+. This means it won't be publicly accessible, but NSC can always see it
            { name: 'Redact', value: 'Redact' },
            // The warning is permanently deleted from the DB. This means it never existed and should be reserved for wrong username/userid warnings only
            { name: 'Delete', value: 'Delete' }
          );
      })
  })
  .setContexts(InteractionContextType.Guild);
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
        if (warn.data.privacy && warn.data.privacy !== 'Public') {
          warn.reason = 'Hidden. Contact a developer for more information';
          warn.mod = {
            discord: 'XXX',
            roblox: -1
          }
          // Don't let Sequelize know what we did
          warn.changed('reason', false);
          warn.changed('mod', false);
        }
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
    case 'alter': {
      if (!(interaction.member.roles as GuildMemberRoleManager).cache.find((r) => r.id === roblox.gaAppealRole)) {
        return interactionEmbed(3, 'You are not authorized to alter a warning. Contact GA Appeals if you need your record changed', interaction);
      }

      const warnId = options.getString('warnId');
      const action = options.getString('action');
      const warn = await client.models.warns.findOne({ where: { warnId }, paranoid: false });
      if (!warn) {
        interactionEmbed(3, 'Warning does not exist', interaction);
        return;
      }

      switch (action) {
        case 'Keep': {
          interactionEmbed(1, 'No changes have been made to the warning', interaction);
          break;
        }
        case 'Remove': {
          if (warn.reason.startsWith('~~')) {
            interactionEmbed(3, 'This warning is already removed', interaction);
            return;
          }

          warn.reason = `~~${warn.reason}~~ (Removed on appeal)`
          await warn.save();
          interactionEmbed(1, 'Warning has been removed', interaction);
          break;
        }
        case 'Redact': {
          if (warn.data.privacy !== 'Public') {
            interactionEmbed(3, 'This warning is already redacted', interaction);
            return
          }

          warn.data.privacy = 'Restricted';
          await warn.save();
          interactionEmbed(1, 'Warning has been redacted', interaction);
          break;
        }
        case 'Delete': {
          await warn.destroy({ force: true });
          interactionEmbed(1, 'Warning has been deleted', interaction);
          break;
        }
        default: {
          interaction.editReply({ content: 'Please refresh your Discord. That action does not exist' });
          break;
        }
      }
    }
    default: {
      interaction.editReply({ content: 'Please refresh your Discord. That command does not exist' });
      break;
    }
  }
}
