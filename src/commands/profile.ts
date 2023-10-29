import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  CommandInteractionOptionResolver,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction
} from 'discord.js';
import { default as config } from '../config.json' assert { type: 'json' };
import { getRoblox, interactionEmbed } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';
const { roblox } = config;

export const name = 'profile';
export const ephemeral = false;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Returns a user's profile")
  .addStringOption((option) => {
    return option.setName('roblox').setDescription('Roblox username').setRequired(true);
  });
export async function run(
  client: CustomClient,
  interaction: ChatInputCommandInteraction,
  options: CommandInteractionOptionResolver
): Promise<void> {
  const robloxData = await getRoblox(options.getString('roblox', true));
  if (robloxData.success === false) return interactionEmbed(3, robloxData.error, interaction);

  const avatar = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar?userIds=${robloxData.user.id}&size=720x720&format=Png&isCircular=false`
  )
    .then((r) => r.json())
    .then((r) => r.data[0].imageUrl);
  const bans = await client.models.bans.findAll({ where: { user: robloxData.user.id } });

  //#region Fetching data
  const data: { [key: string]: any } = {};
  const promises: Promise<unknown>[] = [];
  // We fetch the relevant data about the user
  promises.push(
    fetch(`https://users.roblox.com/v1/users/${robloxData.user.id}`)
      .then((r) => r.json())
      .then((r: unknown) => (data.user = r))
  );
  promises.push(
    fetch(`https://friends.roblox.com/v1/users/${robloxData.user.id}/friends`)
      .then((r) => r.json())
      .then((r) => (data.friends = r.data))
  );
  promises.push(
    fetch(`https://groups.roblox.com/v1/users/${robloxData.user.id}/groups/roles`)
      .then((r) => r.json())
      .then((r) => (data.groups = r.data))
  );
  promises.push(
    fetch(`https://users.roblox.com/v1/users/${robloxData.user.id}/username-history?limit=50`)
      .then((r) => r.json())
      .then((r) => (data.history = r.data.map((u) => u.name)))
  );
  promises.push(
    fetch('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      body: JSON.stringify({ userIds: [robloxData.user.id] }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `.ROBLOSECURITY=${roblox.validationToken || 'abcdef123456'}`
      }
    })
      .then((r) => r.json())
      .then((r) => (data.presence = r.userPresences[0]))
  );
  await Promise.allSettled(promises);
  data.user.createdAt = new Date(data.user.created).toUTCString();
  //#endregion

  //#region Data Parsing
  const categories: { [key: string]: EmbedBuilder[] } = { overview: [], friends: [], groups: [], activity: [] };
  let embeds: EmbedBuilder[] = [];
  let page = 0;
  //#region Overview
  categories.overview = [
    new EmbedBuilder({
      title: 'Overview',
      color: 0xde2821,
      thumbnail: {
        url: client.user!.avatarURL()!
      },
      description:
        data.user.description + '\n\n[Visit Profile](https://www.roblox.com/users/' + robloxData.user.id + '/profile)',
      image: {
        url: avatar
      },
      fields: [
        {
          name: 'Username',
          value: robloxData.user.name,
          inline: true
        },
        {
          name: 'ID',
          value: robloxData.user.id,
          inline: true
        },
        {
          name: 'Created',
          value:
            new Date(data.user.createdAt).getTime() > 0
              ? `<t:${Math.floor(new Date(data.user.createdAt).getTime() / 1000)}:F>`
              : 'Unknown',
          inline: true
        },
        {
          name: 'IRF Game Bans',
          value: bans.length,
          inline: true
        },
        {
          name: 'Friends',
          value: data.friends.length,
          inline: true
        },
        {
          name: 'Groups',
          value: data.groups.length,
          inline: true
        },
        {
          name: 'Previous Usernames',
          value: data.history ? data.history.join('\n') : 'None',
          inline: false
        }
      ],
      timestamp: new Date()
    })
  ];
  //#endregion
  //#region Friends
  const friendFields = data.friends.map((friend) => {
    return {
      name: friend.displayName,
      value: `Username: ${friend.name}\nID: ${friend.id}\nOnline: ${friend.isOnline ? 'Yes' : 'No'}`,
      inline: true
    };
  });
  if (friendFields.length === 0)
    categories.friends.push(
      new EmbedBuilder({
        title: `${robloxData.user.name}'s Friends`,
        color: 0xde2821,
        thumbnail: {
          url: client.user!.avatarURL()!
        },
        description: `https://roblox.com/users/${robloxData.user.id}/profile`,
        image: {
          url: avatar
        },
        fields: [{ name: 'No friends', value: 'This user has no friends!' }],
        footer: {
          text: 'Page 1 of 1'
        },
        timestamp: new Date()
      })
    );
  for (let i = 0; i < friendFields.length; i += 9) {
    categories.friends.push(
      new EmbedBuilder({
        title: `${robloxData.user.name}'s Friends`,
        color: 0xde2821,
        thumbnail: {
          url: client.user!.avatarURL()!
        },
        description: `https://roblox.com/users/${robloxData.user.id}/profile`,
        image: {
          url: avatar
        },
        fields: friendFields.slice(i, i + 9),
        footer: {
          text: `Page ${Math.floor(i / 9) + 1} of ${Math.ceil(friendFields.length / 9)}`
        },
        timestamp: new Date()
      })
    );
  }
  //#endregion
  //#region Groups
  data.groups.forEach((group, index) => {
    categories.groups.push(
      new EmbedBuilder({
        title: `${group.group.name} (${group.group.id})`,
        color: 0xde2821,
        thumbnail: {
          url: client.user!.avatarURL()!
        },
        description:
          group.group.description.length > 2048
            ? `${group.group.description.slice(0, 2045)}...`
            : group.group.description,
        fields: [
          {
            name: 'Owner',
            value: `${group.group.owner.username || 'NO_USERNAME_WAS_RETURNED'} "${
              group.group.owner.displayName || 'NO_DISPLAY_NAME_WAS_RETURNED'
            }" (${group.group.owner.userId || 'NO_USERID_WAS_RETURNED'})`,
            inline: true
          },
          {
            name: 'Members',
            value: group.group.memberCount,
            inline: true
          },
          {
            name: "User's Rank",
            value: group.role.name,
            inline: true
          }
        ],
        footer: {
          text: `Group ${index + 1} of ${data.groups.length}`
        },
        timestamp: new Date()
      })
    );
  });
  if (data.groups.length === 0)
    categories.groups.push(
      new EmbedBuilder({
        title: `${robloxData.user.name}'s Groups`,
        color: 0xde2821,
        thumbnail: {
          url: client.user!.avatarURL()!
        },
        description: `https://roblox.com/users/${robloxData.user.id}/profile`,
        image: {
          url: avatar
        },
        fields: [{ name: 'No groups', value: 'This user is not in any groups!' }],
        footer: {
          text: 'Page 1 of 1'
        },
        timestamp: new Date()
      })
    );
  //#endregion
  //#region Activity
  categories.activity = [
    new EmbedBuilder({
      title: `${robloxData.user.name}'s Activity`,
      color: 0xde2821,
      thumbnail: {
        url: client.user!.avatarURL()!
      },
      description: `https://roblox.com/users/${robloxData.user.id}/profile`,
      image: {
        url: avatar
      },
      fields: [
        {
          name: 'Status',
          value:
            data.presence.userPresenceType === 0
              ? '💤 Offline'
              : data.presence.userPresenceType === 1
              ? '🌐 Online'
              : data.presence.userPresenceType === 2
              ? '🟢 In Game'
              : '❔ Unknown',
          inline: true
        },
        {
          name: 'Last Online',
          value:
            new Date(data.presence.lastOnline).getTime() > 0
              ? `<t:${Math.floor(new Date(data.presence.lastOnline).getTime() / 1000)}:F>`
              : 'Unknown',
          inline: true
        },
        {
          name: 'Last Location',
          value: data.presence.lastLocation ?? 'Unknown',
          inline: true
        }
      ],
      timestamp: new Date()
    })
  ];
  if (data.presence.userPresenceType === 2 && data.presence.placeId) {
    categories.activity[1][0].addFields([
      {
        name: 'Game',
        value: `[${data.presence.lastLocation}](https://roblox.com/games/${data.presence.placeId}) ([https://roblox.com/games/${data.presence.placeId}](https://roblox.com/games/${data.presence.placeId}))`,
        inline: true
      }
    ]);
  } else if (data.presence.userPresenceType === 2 && !data.presence.placeId) {
    categories.activity[1][0].addFields([
      {
        name: 'Game',
        value: '❗ Profile is private, unable to fetch current game',
        inline: true
      }
    ]);
  }
  //#endregion
  //#endregion

  const selectorRow: ActionRowBuilder<StringSelectMenuBuilder> = new ActionRowBuilder({
    components: [
      new StringSelectMenuBuilder({
        customId: 'profile-category',
        placeholder: 'Select a category to review',
        options: [
          {
            label: 'Overview',
            value: 'overview',
            description: `View general information on ${robloxData.user.name}`,
            emoji: '🔍'
          },
          {
            label: 'Friends',
            value: 'friends',
            description: `${robloxData.user.name}'s friends`,
            emoji: '👥'
          },
          {
            label: 'Groups',
            value: 'groups',
            description: `${robloxData.user.name}'s groups`,
            emoji: '🎖️'
          },
          {
            label: 'Activity',
            value: 'activity',
            description: `${robloxData.user.name}'s status`,
            emoji: '📊'
          },
          {
            label: 'Cancel',
            value: 'cancel',
            description: 'Cancel the command',
            emoji: '❌'
          }
        ],
        min_values: 1,
        max_values: 1
      })
    ]
  });
  const paginationRow: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder({
    components: [
      new ButtonBuilder({ customId: 'previous', label: '◀️', style: ButtonStyle.Primary }),
      new ButtonBuilder({ customId: 'cancel', label: '🟥', style: ButtonStyle.Danger }),
      new ButtonBuilder({ customId: 'next', label: '▶️', style: ButtonStyle.Primary })
    ]
  });

  //#region Pagination
  const coll = await interaction
    .editReply({ embeds: [categories.overview[0]], components: [selectorRow] })
    .then((m) =>
      m.createMessageComponentCollector({ filter: (i) => i.user.id === interaction.user.id, time: 180_000 })
    );

  coll.on('collect', (i: ButtonInteraction | StringSelectMenuInteraction) => {
    const selectors: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [selectorRow];
    // If they select the menu, switch category
    if (i.isStringSelectMenu()) {
      // If they cancel, stop the collector
      if (i.values[0] === 'cancel') return coll.stop();
      // Get the category
      embeds = categories[i.values[0]];
      // New category, so page #0
      page = 0;
      // If the length is greater than 2, add pagination row
      if (embeds.length > 1) selectors.unshift(paginationRow);
      // Update the message
      i.update({ embeds: [embeds[page]], components: selectors });
      return;
    }
    // Pagination row
    switch (i.customId) {
      // Cancel
      case 'cancel': {
        coll.stop();
        break;
      }
      // Previous
      case 'previous': {
        page = page - 1;
        // If the page is less than 0, set it to the last page
        if (page < 0) page = embeds.length - 1;
        // If the length is greater than the length, add pagination row
        if (embeds.length > 1) selectors.unshift(paginationRow);
        // Update the message
        i.update({ embeds: [embeds[page]], components: selectors });
        break;
      }
      // Next
      case 'next': {
        page = page + 1;
        // If the page is greater than the length, set it to the first page
        if (page > embeds.length - 1) page = 0;
        // If the length is greater than 2, add pagination row
        if (embeds.length > 1) selectors.unshift(paginationRow);
        // Update the message
        i.update({ embeds: [embeds[page]], components: selectors });
        break;
      }
      // Handled above
      case 'profile-category': {
        // Handled above
        break;
      }
      // Theoretically impossible to reach
      default: {
        i.update({
          content: "You shouldn't be seeing this! Report this to an Engineer\n\n**CUSTOMID**: " + i.customId,
          embeds: [],
          components: []
        });
      }
    }
  });
  coll.on('end', () => {
    interaction
      .fetchReply()
      .then((m) =>
        m.edit({
          content: `This embed has timed out. Please run the command again: </profile:${interaction.commandId}>`,
          components: []
        })
      )
      .catch(() => null);
  });
  //#endregion
}