import {
  ChatInputCommandInteraction,
  CommandInteractionOptionResolver,
  type GuildTextBasedChannel,
  Message,
  SlashCommandBuilder
} from 'discord.js';
import { default as config } from '../config.json' assert { type: 'json' };
import { ResultMessage, getRowifi, interactionEmbed, toConsole } from '../functions.js';
import { CustomClient, RobloxUserPresenceData } from '../typings/Extensions.js';
const { channels, discord, roblox } = config;
const cooldown = new Map();

export const name = 'request';
export const ephemeral = false;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Requests a division to assist you (Cooldown: 15 minutes)')
  .setDMPermission(false)
  .addStringOption((option) => {
    return option
      .setName('division')
      .setDescription('Division you are requesting')
      .addChoices(
        { name: 'Ministry of Admissions', value: 'Admissions' },
        { name: 'Game Moderation', value: 'Game Administrator' },
        { name: '3rd Guard Tanks', value: '3rd Guard Tanks' },
        { name: 'National Defense', value: 'National Defense' },
        { name: 'Military Police', value: 'Military Police' },
        { name: 'Internal Affairs', value: 'Internal Affairs' },
        { name: '98th Airborne', value: '98th Airborne' },
        { name: '3rd Guard Tanks', value: '3rd Guard Tanks' },
        { name: 'Ministry of Labor', value: 'Labour' },
        { name: 'Royal Guard', value: 'Royal Guard Backup Ping' }
      )
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option.setName('reason').setDescription('Reason for request').setAutocomplete(true).setRequired(true);
  });
export async function run(
  client: CustomClient,
  interaction: ChatInputCommandInteraction,
  options: CommandInteractionOptionResolver
): Promise<void> {
  if (cooldown.has(interaction.user.id)) {
    interactionEmbed(
      3,
      `You can request <t:${Math.floor((cooldown.get(interaction.user.id) + 900000) / 1000)}:R>`,
      interaction
    );
    return;
  }
  // Used extensively in the checks below
  const division = options.getString('division', true);
  // TODO: Remove hardcoded ID
  if (interaction.guild.id != '466432774182666240' && division === 'Royal Guard Backup Ping') {
    interactionEmbed(3, 'You must request Royal Guard from their server', interaction);
    return;
  } else if(interaction.guild.id != '1292166020814868654' && division === 'National Defense') {
    interactionEmbed(3, 'You must request National Defense from their server', interaction);
    return;
  } else if (interaction.guild.id != discord.mainServer && !['National Defense', 'Royal Guard Backup Ping'].includes(division)) {
    interactionEmbed(3, 'You must request this division in the Federation Network server', interaction);
    return;
  }
  await interaction.guild.roles.fetch();
  const role = interaction.guild.roles.cache.find((r) => r.name === options.getString('division', true)).toString();
  const reason = options.getString('reason');
  const rowifi = await getRowifi(interaction.user.id, client);
  if (!rowifi.success) {
    interactionEmbed(3, 'You must verify with RoWifi before using this command', interaction);
    return;
  }

  const presenceCheck: RobloxUserPresenceData | object[] = await fetch(
    'https://presence.roblox.com/v1/presence/users',
    {
      method: 'POST',
      body: JSON.stringify({
        userIds: [rowifi.roblox]
      }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `.ROBLOSECURITY=${roblox.validationToken || 'abcdef123456'}`
      }
    }
  )
    .then((r) => r.json())
    .then((r) => r.errors || r.userPresences[0])
    .catch(() => null);
  if (Array.isArray(presenceCheck) || !presenceCheck) {
    toConsole(
      `Presence check failed for ${interaction.user.tag} (${interaction.user.id})\n\`\`\`json\n${JSON.stringify(
        presenceCheck,
        null,
        2
      )}\n\`\`\``,
      new Error().stack!,
      client
    );
    interactionEmbed(3, 'An error occurred while checking your presence. Try again later', interaction);
    return;
  }
  if (presenceCheck.userPresenceType !== 2 || presenceCheck.gameId === null) {
    interactionEmbed(
      3,
      'You must be in-game and your profile must be public in order to use this command. Please try again later',
      interaction
    );
    return;
  }

  const channelId = division === 'Royal Guard Backup Ping' ? '749034267291418785' : (division === 'National Defense' ? '1292529882416287866' : channels.request);
  const request = await interaction.guild.channels.fetch(channelId, { cache: true });
  if (!request || !request.isTextBased()) {
    interactionEmbed(3, ResultMessage.Unknown, interaction);
    return;
  }
  (request as GuildTextBasedChannel)
    .send({
      content: role,
      embeds: [
        {
          title: `${rowifi.username} is requesting ${division}`,
          color: 0xde2821,
          description: `${interaction.member.toString()} is requesting ${role} due to: __${reason}__\n\n**Profile Link:** https://www.roblox.com/users/${
            rowifi.roblox
          }/profile\n\n**React if you are handling this request**`
        }
      ]
    })
    .then((m: Message) => m.react('✅'))
    .then(() => {
      interaction.editReply({
        embeds: [
          {
            title: 'Request Sent',
            color: 0xde2821,
            description: `Your request has been sent and ${division} has been called`
          }
        ]
      });
    })
    .catch(() => {
      interactionEmbed(3, 'An error occurred while sending the request. Try again later', interaction);
    });

  cooldown.set(interaction.user.id, Date.now());
  setTimeout(() => {
    cooldown.delete(interaction.user.id);
  }, 900000); // 15 minutes
}
