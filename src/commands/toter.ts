import {
  CommandInteraction,
  CommandInteractionOptionResolver,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { default as config } from '../config.json' with { type: 'json' };
import { getGroup, getRoblox, getRowifi, parseTime } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';
const { roblox } = config;

export const name = 'toter';
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Manages Toter blocking')
  .addSubcommand((sc) => {
    return sc
      .setName('block')
      .setDescription('Blocks a user from accessing Toter perks')
      .addIntegerOption((opt) =>
        opt.setName('roblox').setDescription('Roblox ID of the user to block').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('end').setDescription('Time for block to last (format: 1d2h3m4s').setRequired(true)
      )
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason for blocking').setRequired(true))
      .addUserOption((opt) => opt.setName('discord').setDescription('Discord user to block').setRequired(false));
  })
  .addSubcommand((sc) => {
    return sc
      .setName('unblock')
      .setDescription('Unblocks a user from accessing Toter perks')
      .addIntegerOption((opt) => opt.setName('roblox').setDescription('Roblox ID of the user to unblock'));
  })
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);
export async function run(
  client: CustomClient,
  interaction: CommandInteraction,
  options: CommandInteractionOptionResolver
): Promise<void> {
  // Get Rowifi
  const rowifi = await getRowifi(interaction.user.id, client);
  if (rowifi.success === false) {
    interaction.editReply({ content: rowifi.error });
    return;
  }
  // Get the target
  const target = await getRoblox(options.getInteger('roblox', true));
  if (target.success === false) {
    interaction.editReply({ content: target.error });
    return;
  }
  // Get their ranks
  const targetToter = await getGroup(target.user.name, roblox.toterGroup);
  const modToter = await getGroup(rowifi.roblox, roblox.toterGroup);
  if (targetToter.success === false || modToter.success === false) {
    interaction.editReply({
      content: `Failed to fetch Toter group ranks for ${targetToter.success ? 'target' : 'mod'}`
    });
    return;
  }
  // Compare as needed
  if (targetToter.data.role.rank >= modToter.data.role.rank || roblox.toterRank > modToter.data.role.rank) {
    interaction.editReply({ content: 'You cannot manage this user (Insufficient permissions)' });
    return;
  }
  // Grab database entry if any (We'll use it later)
  const block = await client.models.toter_block.findOne({
    where: {
      targetRoblox: target.user.id
    }
  });

  // Switch case
  switch (options.getSubcommand()) {
    case 'block': {
      if (block) {
        interaction.editReply({ content: 'This user is already blocked' });
        return;
      }
      // Create the entry
      const targetDiscord = options.getUser('discord');
      const end = new Date(Date.now() + parseTime(options.getString('end')) * 1000);
      await client.models.toter_block.create({
        targetRoblox: target.user.id,
        targetDiscord: targetDiscord ? targetDiscord.id : null,
        mod: interaction.user.id,
        end: end,
        reason: options.getString('reason')
      });
      interaction.editReply({ content: 'User successfully blocked' });
      if (targetDiscord) {
        targetDiscord
          .send({
            content: `Greetings. You are temporarily blocked from accessing Toter perks.\n\n> Reason: ${options.getString(
              'reason'
            )}\n> End: <t:${end}:F> (<t:${end}:R>)`
          })
          .catch(null);
      }
      break;
    }
    case 'unblock': {
      if (!block) {
        interaction.editReply({ content: 'This user is not blocked' });
        return;
      }
      await block.destroy();
      interaction.editReply({ content: 'User successfully unblocked' });
      break;
    }
  }
}
