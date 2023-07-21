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
import { getRoblox, interactionEmbed } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';

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

  let bans = await client.models!.Ban.findAll({ where: { userID: roblox.user.id } });
  const avatar = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar?userIds=${roblox.user.id}&size=720x720&format=Png&isCircular=false`
  )
    .then((r: Response) => r.json())
    .then((r) => r.data[0].imageUrl);
  const embeds: EmbedBuilder[] = [];
  for (const ban of bans) {
    if (
      !/.+\/([0-9]{0,20})\/([0-9]{0,20})$/.exec(
        ban.proof || 'https://discord.com/channels/989558770801737778/1059784888603127898/1063318255265120396'
      )
    ) {
      embeds.push(
        new EmbedBuilder({
          title: 'Error Parsing Proof',
          description: `Proof given was invalid and could not be parsed. Report this to a developer.\n\nRegEx failed on \`${ban.proof}\` (ID: ${ban.banId})`
        })
      );
      continue;
    }
    const evid = await client.channels
      .fetch(
        /.+\/([0-9]{0,20})\/([0-9]{0,20})$/.exec(
          ban.proof || 'https://discord.com/channels/989558770801737778/1059784888603127898/1063318255265120396'
        )![1]
      )
      .then((c) =>
        (c as TextChannel).messages.fetch(
          /.+\/([0-9]{0,20})\/([0-9]{0,20})$/g.exec(
            ban.proof || 'https://discord.com/channels/989558770801737778/1059784888603127898/1063318255265120396'
          )![2]
        )
      );
    const image = evid.attachments.first()!.contentType!.startsWith('video')
      ? undefined
      : { url: evid.attachments.first()!.url, proxyURL: evid.attachments.first()!.proxyURL };
    embeds.push(
      new EmbedBuilder({
        title: `__**Bans for ${roblox.user.name} (${roblox.user.displayName})**__`,
        thumbnail: {
          url: avatar
        },
        fields: [
          { name: 'Game ID', value: String(ban.gameID), inline: true },
          {
            name: 'Reason',
            value: evid.attachments.first()!.contentType!.startsWith('video')
              ? `${ban.reason}\n\n**Evidence**: ${evid.attachments.first()!.proxyURL}`
              : ban.reason,
            inline: true
          },
          { name: 'Date', value: `<t:${ban.unixtime}>`, inline: true }
        ],
        image: image,
        footer: {
          text: `Ban ${bans.indexOf(ban) + 1} of ${bans.length}`
        },
        timestamp: new Date()
      })
    );
  }
  if (bans.length === 0)
    embeds.push(
      new EmbedBuilder({
        title: `__**Bans for ${roblox.user.name} (${roblox.user.displayName})**__`,
        thumbnail: {
          url: avatar
        },
        fields: [
          { name: 'Game ID', value: '-', inline: true },
          { name: 'Reason', value: 'No bans found!', inline: true },
          { name: 'Date', value: '-', inline: true }
        ],
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
