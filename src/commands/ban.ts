import {
  ChatInputCommandInteraction,
  CommandInteractionOptionResolver,
  GuildMemberRoleManager,
  SlashCommandBuilder,
  TextChannel
} from 'discord.js';
import { promisify } from 'node:util';
import { default as config } from '../config.json' assert { type: 'json' };
import {
  IRFGameId,
  ResultMessage,
  ResultType,
  getEnumKey,
  getRoblox,
  getRowifi,
  interactionEmbed
} from '../functions.js';
import { execute as logBan } from '../functions/logBan.js';
import { execute as parseEvidence } from '../functions/parseEvidence.js';
import { CustomClient } from '../typings/Extensions.js';
const { channels } = config;
const wait = promisify(setTimeout);

export const name = 'ban';
export const ephemeral = false;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Bans a user from an IRF game')
  .setDMPermission(false)
  .addStringOption((option) => {
    return option.setName('user_id').setDescription('Roblox username or ID').setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('game_id')
      .setDescription('Roblox game ID')
      .setRequired(true)
      .addChoices(
        { name: 'Global', value: '0' },
        { name: 'Papers, Please!', value: '583507031' },
        { name: 'Sevastopol Military Academy', value: '603943201' },
        { name: 'Triumphal Arch of Moscow', value: '2506054725' },
        { name: 'Tank Training Grounds', value: '2451182763' },
        { name: 'Ryazan Airbase', value: '4424975098' },
        { name: 'Prada Offensive', value: '4683162920' }
      );
  })
  .addStringOption((option) => {
    return option
      .setName('reason')
      .setDescription('Reason for banning the user')
      .setAutocomplete(true)
      .setRequired(true);
  })
  .addAttachmentOption((option) => {
    return option
      .setName('evidence')
      .setDescription("Evidence of the user's ban (Add when possible, please!)")
      .setRequired(false);
  });
export async function run(
  client: CustomClient,
  interaction: ChatInputCommandInteraction,
  options: CommandInteractionOptionResolver
): Promise<void> {
  if (!(interaction.member.roles as GuildMemberRoleManager).cache.find((r) => r.name === 'Administration Access'))
    return interactionEmbed(ResultType.Error, ResultMessage.UserPermission, interaction);
  const user_id = options.getString('user_id', true);
  // Check if the user ID is a valid ID
  const roblox = await getRoblox(user_id);
  if (roblox.success === false) {
    interactionEmbed(3, roblox.error, interaction);
    return;
  }
  const id = roblox.user;
  // Ensure the game ID is valid
  if (!IRFGameId[options.getString('game_id', true)])
    return interactionEmbed(
      3,
      'Arg `game_id` must be a registered game ID. Use `/ids` to see all recognised games',
      interaction
    );

  // Check if the user is already banned
  const banCheck = await client.models.bans.findOne({
    where: {
      user: id.id,
      game: options.getString('game_id', true)
    }
  });
  // If the user is already banned, show a warning
  if (typeof banCheck !== 'undefined' && banCheck !== null) {
    interactionEmbed(
      2,
      `A ban already exists for ${id.name} (${id.id}) on ${getEnumKey(
        IRFGameId,
        Number(options.getString('game_id', true))
      )}. This will overwrite the ban!\n(Adding ban in 5 seconds)`,
      interaction
    );
    await wait(5000); // Show warning
  }
  // Get the user's rowifi data
  const rowifi = await getRowifi(interaction.user.id, client);
  if (rowifi.success === false) {
    interactionEmbed(3, rowifi.error ?? 'Unknown error (Report this to a developer)', interaction);
    return;
  }
  // Fetch the channels that will be used
  const image_host = (await client.channels.fetch(channels.image_host, { cache: true })) as TextChannel;
  const ban_logs = (await client.channels.fetch(channels.ban, { cache: true })) as TextChannel;
  if (!image_host || !ban_logs)
    return interactionEmbed(3, 'One or more channels could not be fetched. Please try again later', interaction);
  // Send to evidence parser
  const evidence = await parseEvidence(client, interaction);
  if (!evidence) return interactionEmbed(3, 'Failed to parse evidence', interaction);
  // Log the ban, creating one or updating an existing ban
  const ban = !banCheck
    ? await client.models.bans.create({
        user: id.id,
        game: Number(options.getString('game_id', true)),
        mod: {
          roblox: rowifi.roblox,
          discord: interaction.user.id
        },
        data: {
          proof: evidence.url,
          privacy: 'Public'
        },
        reason: options.getString('reason', true)
      })
    : await banCheck.update({
        data: {
          proof: evidence.url,
          privacy: 'Public'
        },
        mod: {
          roblox: rowifi.roblox,
          discord: interaction.user.id
        },
        reason: options.getString('reason', true)
      });
  await logBan(client, ban, id, interaction);
  return;
}
