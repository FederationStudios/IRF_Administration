import {
  Attachment,
  ChatInputCommandInteraction,
  CommandInteractionOptionResolver,
  GuildMember,
  GuildMemberRoleManager,
  Message,
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
  interactionEmbed,
  toConsole
} from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';
const { channels, discord } = config;
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
  if (!(interaction.member!.roles as GuildMemberRoleManager).cache.find((r) => r.name === 'Administration Access'))
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
  const bans = await client.models.bans.findAll({
    where: {
      user: id.id,
      game: options.getString('game_id', true)
    }
  });
  // If the user is already banned, show a warning
  if (bans.length > 0) {
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
  const nsc_report = (await client.channels.fetch(channels.nsc_report, { cache: true })) as TextChannel;
  const ban = (await client.channels.fetch(channels.ban, { cache: true })) as TextChannel;
  if (!image_host || !nsc_report || !ban)
    return interactionEmbed(3, 'One or more channels could not be fetched. Please try again later', interaction);
  // Validate the evidence
  let rawEvidence: Attachment = options.getAttachment('evidence');
  // If no evidence was provided, fetch the default proof
  if (!rawEvidence) {
    rawEvidence = await image_host.messages
      .fetch(discord.defaultProofURL.split('/')[6])
      .then((m) => m.attachments.first());
  }
  if (
    rawEvidence.contentType.split('/')[0] !== 'image' &&
    rawEvidence.contentType.split('/')[1] === 'gif' &&
    rawEvidence.contentType.split('/')[0] === 'video'
  ) {
    interactionEmbed(3, 'Evidence must be an image (PNG, JPG, JPEG, or MP4)', interaction);
    return;
  }
  let evidence: Message | undefined | void;
  // Add variable for checking for errors
  let error = false;
  // If attachments are present, send to image_host
  if (options.getAttachment('evidence')) {
    const image_host = client.channels.cache.get(channels.image_host) as TextChannel;
    evidence = await image_host
      .send({
        content: `Evidence from ${interaction.user.toString()} (${interaction.user.tag} - ${interaction.user.id})`,
        files: [
          {
            attachment: rawEvidence.proxyURL.split('?')[0],
            name: `EvidenceFrom_${rowifi.username}+${rowifi.roblox}.${
              rawEvidence.proxyURL.split('.').splice(-1)[0].split('?')[0]
            }`
          }
        ]
      })
      .catch((err) => {
        // Throw error and safely exit
        error = true;
        // Detect too large files
        if (String(err).includes('Request entity too large')) {
          return interactionEmbed(
            3,
            'Discord rejected the evidence (File too large). Try compressing the file first!',
            interaction
          );
        }
        return interactionEmbed(3, 'Failed to upload evidence to image host', interaction);
      });
    // Drop further handling - we've already responded
    if (error) return;
  } else {
    // Extract the message ID and channel ID from the URL
    const pChnlId = discord.defaultProofURL.split('/')[5];
    const pMsgId = discord.defaultProofURL.split('/')[6];
    // Fetch evidence
    evidence = await (client.channels.cache.get(pChnlId) as TextChannel).messages.fetch(pMsgId);
  }
  // If the evidence failed to upload, return an error
  if (!evidence || !evidence.attachments.first()) {
    interactionEmbed(3, 'Failed to upload evidence to image host', interaction);
    return;
  }
  try {
    // If the user is already banned, update the ban
    if (bans.length > 0) {
      await client.models.bans.update(
        {
          user: id.id,
          game: Number(options.getString('game_id', true)),
          reason: options.getString('reason', true),
          data: {
            proof: evidence.url,
            privacy: 'Public'
          },
          mod: {
            discord: interaction.user.id,
            roblox: rowifi.roblox
          }
        },
        {
          where: {
            user: id.id,
            game: Number(options.getString('game_id', true))
          }
        }
      );
    } else {
      await client.models.bans.create({
        user: id.id,
        game: Number(options.getString('game_id')),
        reason: options.getString('reason'),
        data: {
          privacy: 'Public',
          proof: evidence.url
        },
        mod: {
          discord: interaction.user.id,
          roblox: rowifi.roblox
        }
      });
    }
  } catch (e) {
    toConsole(
      `An error occurred while adding a ban for ${id.name} (${id.id})\n> ${String(e)}`,
      new Error().stack!,
      client
    );
    error = true;
  }
  if (error) return interactionEmbed(3, ResultMessage.DatabaseError, interaction);

  await ban.send({
    embeds: [
      {
        title: `${(interaction.member as GuildMember).nickname || interaction.user.username} banned => ${id.name}`,
        description: `**${interaction.user.id}** has added a ban for ${id.name} (${id.id}) on ${
          IRFGameId[options.getString('game_id', true)]
        } (${options.getString('game_id')})`,
        color: 0x00ff00,
        fields: [
          {
            name: 'Game',
            value: `${IRFGameId[options.getString('game_id', true)]} (${options.getString('game_id')})`,
            inline: true
          },
          {
            name: 'User',
            value: `${id.name} (${id.id})`,
            inline: true
          },
          {
            name: 'Reason',
            // Attachment will always be present, checks are above
            value: `${options.getString('reason')}\n\n**Evidence:** ${
              evidence.attachments.first()!.proxyURL.split('?')[0]
            }`,
            inline: true
          }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  });
  await interaction.editReply({
    content: 'Ban added successfully!',
    embeds: [
      {
        title: 'Ban Details',
        color: 0xde2821,
        fields: [
          {
            name: 'User',
            value: `${id.name} (${id.id})`,
            inline: true
          },
          {
            name: 'Game',
            value: getEnumKey(IRFGameId, Number(options.getString('game_id', true)))!,
            inline: true
          },
          {
            name: 'Reason',
            // Attachment will always be present, checks are above
            value: `${options.getString('reason')}\n\n**Evidence:** ${
              evidence.attachments.first()!.proxyURL.split('?')[0]
            }`,
            inline: false
          }
        ]
      }
    ]
  });
  return;
}
