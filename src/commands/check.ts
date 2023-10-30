import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  CommandInteractionOptionResolver,
  ComponentType,
  EmbedBuilder,
  MessageComponentInteraction,
  SlashCommandBuilder,
  TextChannel
} from 'discord.js';
import { default as config } from '../config.json' assert { type: 'json' };
import { IRFGameId, getRoblox, interactionEmbed } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';
const { discord } = config;

export const name = 'check';
export const ephemeral = false;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Checks for bans associated with a user')
  .setDMPermission(false)
  .addStringOption((option) => {
    return option.setName('user_id').setDescription("User's Roblox ID").setRequired(true);
  });
export async function run(
  client: CustomClient,
  interaction: ChatInputCommandInteraction,
  options: CommandInteractionOptionResolver
): Promise<void> {
  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;
  const user_id = options.getString('user_id', true);
  const roblox = await getRoblox(user_id);
  if (roblox.success === false) return interactionEmbed(3, roblox.error, interaction);

  let bans = (await client.models.bans.findAll({ where: { user: roblox.user.id }, paranoid: false })).sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
  // Get the user's avatar
  const avatar = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar?userIds=${roblox.user.id}&size=720x720&format=Png&isCircular=false`
  )
    .then((r: Response) => r.json())
    .then((r) => r.data[0].imageUrl);
  // Create array holder for bans
  const embeds: EmbedBuilder[] = [];
  for (const ban of bans) {
    // Check if proof is valid
    if (!/.+\/([0-9]{0,20})\/([0-9]{0,20})$/.exec(ban.data.proof || discord.defaultProofURL)) {
      // If not, add an embed with an error message
      embeds.push(
        new EmbedBuilder({
          title: 'Error Parsing Proof',
          description: `Proof given was invalid and could not be parsed. Report this to a developer.\n\nRegEx failed on \`${ban.data.proof}\` (ID: ${ban.banId})`
        })
      );
      continue;
    }
    // Get the evidence message
    const evid = await client.channels
      .fetch(/.+\/([0-9]{0,20})\/([0-9]{0,20})$/.exec(ban.data.proof || discord.defaultProofURL)![1])
      .then((c) =>
        (c as TextChannel).messages.fetch(
          /.+\/([0-9]{0,20})\/([0-9]{0,20})$/g.exec(ban.data.proof || discord.defaultProofURL)![2]
        )
      );
    // First attachment
    const fa = evid.attachments.first();
    // If the evidence message is not found, add an embed with an error message
    if (!fa || !fa.contentType) {
      embeds.push(
        new EmbedBuilder({
          title: 'Error Parsing Proof',
          description: `Proof given was invalid and could not be parsed. Report this to a developer.\n\nAttachment failed on \`${evid.url}\` (ID: ${ban.banId})`
        })
      );
      continue;
    }
    // Try to get the image, else set to undefined
    const image = fa.contentType.startsWith('video') ? undefined : { url: fa.url, proxyURL: fa.proxyURL };
    // Create the fields so we can modify later
    const f = [
      { name: 'Game', value: IRFGameId[ban.game], inline: true },
      { name: 'Status', value: ban.isSoftDeleted() ? `Revoked` : 'Active', inline: true },
      { name: 'Moderator', value: `Roblox ID: ${ban.mod.roblox}\nDiscord: <@${ban.mod.discord}>`, inline: false }
    ];
    // If the proof isn't an image, it's a video, so add a field for it
    if (typeof image === 'undefined') {
      f.push({ name: 'Evidence', value: `[Video provided by moderator](${evid.url})`, inline: true });
    }
    // Add the embed to the array
    embeds.push(
      new EmbedBuilder({
        title: `__**Bans for ${roblox.user.name} (${roblox.user.displayName})**__`,
        description: `**Reason**: ${ban.reason}${ban.isSoftDeleted() ? `\n**Unban Reason**: ${ban.unbanReason}` : ''}`,
        color: ban.isSoftDeleted() ? 0x00ff00 : 0xff0000,
        thumbnail: {
          url: avatar
        },
        fields: f,
        image: image,
        footer: {
          text: `Ban ${bans.indexOf(ban) + 1} of ${bans.length} - Ban created:`
        },
        timestamp: ban.createdAt
      })
    );
  }
  if (bans.length === 0)
    embeds.push(
      new EmbedBuilder({
        title: `__**Bans for ${roblox.user.name} (${roblox.user.displayName})**__`,
        description: `No bans found for this user`,
        color: 0xaaaaaa,
        thumbnail: {
          url: avatar
        },
        footer: {
          text: 'Ban 0 of 0'
        },
        timestamp: new Date()
      })
    );

  let page = 0;
  const paginationRow: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder({
    components: [
      new ButtonBuilder({ customId: 'previous', label: '◀️', style: ButtonStyle.Primary }),
      new ButtonBuilder({ customId: 'cancel', label: '🟥', style: ButtonStyle.Danger }),
      new ButtonBuilder({ customId: 'next', label: '▶️', style: ButtonStyle.Primary })
    ]
  });
  const data = { embeds: [embeds[page]], components: [paginationRow] };
  if (embeds.length < 2) data.components = [];
  const coll = await interaction
    .editReply(data)
    .then((r) => r.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 120_000 }));

  coll.on('collect', (i) => {
    if (i.customId === 'next') {
      page = page + 1;
      if (page > embeds.length - 1) page = 0;
      i.update({ embeds: [embeds[page]], components: [paginationRow] });
    } else if (i.customId === 'previous') {
      page = page - 1;
      if (page < 0) page = embeds.length - 1;
      i.update({ embeds: [embeds[page]], components: [paginationRow] });
    } else {
      coll.stop();
    }
  });

  coll.once('end', () => {
    interaction.deleteReply();
  });

  return;
}
