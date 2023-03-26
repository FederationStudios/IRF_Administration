// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { interactionEmbed } = require("../functions.js");
const { default: fetch } = require("node-fetch");
const { bot } = require("../config.json");

module.exports = {
  name: "profile",
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Returns a user's profile")
    .addStringOption(option => {
      return option
        .setName("roblox")
        .setDescription("Roblox username")
        .setRequired(true);
    }),
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   * @param {CommandInteractionOptionResolver} options
   */
  run: async (client, interaction, options) => {
    await interaction.deferReply(); // In case of overload
    let user = options.getString("roblox");
    if(!isNaN(options.getString("roblox_username"))) {
      user = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [options.getString("roblox")] })
      })
        .then(res => res.json())
        .then(r => r.data[0]);

      if(!user) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("roblox")}\` as username but found no user`, interaction, client, [true, 15]);
    } else {
      user = await fetch(`https://api.roblox.com/users/${options.getString("roblox")}`)
        .then(async res => JSON.parse((await res.text()).trim()));
      // IDs that don't exist will return an error with spaces, causing normal parses to fail

      if(user.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("roblox")}\` as ID but found no user`, interaction, client, [true, 15]);
    }

    const avatar = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${user.Id}&size=720x720&format=Png&isCircular=false`)
      .then(r => r.json())
      .then(r => r.data[0].imageUrl);
    
    const bans = await client.models.Ban.findAll({ where: { userID: user.Id } });

    //#region Fetching data
    const data = {};
    const promises = [];
    promises.push(fetch(`https://users.roblox.com/v1/users/${user.Id}`).then(r => r.json()).then(r => data.user = r));
    promises.push(fetch(`https://friends.roblox.com/v1/users/${user.Id}/friends`).then(r => r.json()).then(r => data.friends = r.data));
    promises.push(fetch(`https://groups.roblox.com/v1/users/${user.Id}/groups/roles`).then(r => r.json()).then(r => data.groups = r.data));
    promises.push(fetch(`https://users.roblox.com/v1/users/${user.Id}/username-history`).then(r => r.json()).then(r => data.history = r.data.map(u => u.name)));
    promises.push(fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      body: JSON.stringify({userIds: [user.Id]}),
      headers: { "Content-Type": "application/json", "Cookie": `.ROBLOSECURITY=${bot.validationToken || "abcdef123456"}`}
    }).then(r => r.json()).then(r => data.presence = r.userPresences[0]));
    await Promise.allSettled(promises);
    data.user.createdAt = new Date(data.user.created).toUTCString();
    //#endregion

    //#region Data Parsing
    const categories = {"overview": [false, []], "friends": [true, []], "groups": [true, []], "activity": [false, []]};
    let embeds = [];
    let page = 0;
    // OVERVIEW //
    categories.overview[1] = [
      new EmbedBuilder({
        title: "Overview",
        color: 0xDE2821,
        thumbnail: {
          url: client.user.avatarURL()
        },
        description: data.user.description+"\n\n[Visit Profile](https://www.roblox.com/users/"+user.Id+"/profile)",
        image: {
          url: avatar
        },
        fields: [
          {
            name: "Username",
            value: user.Username,
            inline: true
          },
          {
            name: "ID",
            value: user.Id,
            inline: true
          },
          {
            name: "Created",
            value: new Date(data.user.createdAt).getTime() > 0 ? `<t:${Math.floor(new Date(data.user.createdAt).getTime()/1000)}:F>` : "Unknown",
            inline: true
          },
          {
            name: "IRF Game Bans",
            value: bans.length,
            inline: true
          },
          {
            name: "Friends",
            value: data.friends.length,
            inline: true
          },
          {
            name: "Groups",
            value: data.groups.length,
            inline: true
          },
          {
            name: "Previous Usernames",
            value: data.history.length > 0 ? data.history.join("\n") : "None",
            inline: false
          }
        ],
        timestamp: new Date()
      })
    ];
    // FRIENDS //
    const friendFields = data.friends.map(friend => {
      return {
        name: friend.displayName,
        value: `Username: ${friend.name}\nID: ${friend.id}\nOnline: ${friend.isOnline ? "Yes" : "No"}`,
        inline: true
      };
    });
    for(let i = 0; i < friendFields.length; i += 9) {
      categories.friends[1].push(new EmbedBuilder({
        title: `${user.Username}'s Friends`,
        color: 0xDE2821,
        thumbnail: {
          url: client.user.avatarURL()
        },
        description: `https://roblox.com/users/${user.Id}/profile`,
        image: {
          url: avatar
        },
        fields: friendFields.slice(i, i + 9),
        footer: {
          text: `Page ${Math.floor(i/9) + 1} of ${Math.ceil(friendFields.length/9)}`
        },
        timestamp: new Date()
      }));
    }
    // GROUPS //
    data.groups.forEach((group, index) => {
      categories.groups[1].push(
        new EmbedBuilder({
          title: `${group.group.name} (${group.group.id})`,
          color: 0xDE2821,
          thumbnail: {
            url: client.user.avatarURL()
          },
          description: group.group.description.length > 2048 ? `${group.group.description.slice(0, 2045)}...` : group.group.description,
          fields: [
            {
              name: "Owner",
              value: `${group.group.owner.username} "${group.group.owner.displayName}" (${group.group.owner.userId})`,
              inline: true
            },
            {
              name: "Members",
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
    // ACTIVITY //
    categories.activity[1] = [new EmbedBuilder({
      title: `${user.Username}'s Activity`,
      color: 0xDE2821,
      thumbnail: {
        url: client.user.avatarURL()
      },
      description: `https://roblox.com/users/${user.Id}/profile`,
      image: {
        url: avatar
      },
      fields: [
        {
          name: "Status",
          value: data.presence.userPresenceType === 0 ? "💤 Offline" : data.presence.userPresenceType === 1 ? "🌐 Online" : data.presence.userPresenceType === 2 ? "🟢 In Game" : "❔ Unknown",
          inline: true
        },
        {
          name: "Last Online",
          value: new Date(data.presence.lastOnline).getTime() > 0 ? `<t:${Math.floor(new Date(data.presence.lastOnline).getTime()/1000)}:F>` : "Unknown",
          inline: true
        },
        {
          name: "Last Location",
          value: data.presence.lastLocation ?? "Unknown",
          inline: true
        }
      ],
      timestamp: new Date()
    })];
    if(data.presence.userPresenceType === 2 && data.presence.placeId) {
      categories.activity[1][0].addFields([{
        name: "Game",
        value: `[${data.presence.lastLocation}](https://roblox.com/games/${data.presence.placeId}) ([https://roblox.com/games/${data.presence.placeId}](https://roblox.com/games/${data.presence.placeId}))`,
        inline: true
      }]);
    } else if(data.presence.userPresenceType === 2 && !data.presence.placeId) {
      categories.activity[1][0].addFields([{
        name: "Game",
        value: "❗ Profile is private, unable to fetch current game",
        inline: true
      }]);
    }
    //#endregion

    const selectorRow = new ActionRowBuilder().setComponents(
      new StringSelectMenuBuilder({
        customId: "profile-category",
        placeholder: "Select a category to review",
        options: [
          {
            label: "Overview",
            value: "overview",
            description: `View general information on ${user.Username}`,
            emoji: "🔍"
          },
          {
            label: "Friends",
            value: "friends",
            description: `${user.Username}'s friends`,
            emoji: "👥"
          },
          {
            label: "Groups",
            value: "groups",
            description: `${user.Username}'s groups`,
            emoji: "🎖️"
          },
          {
            label: "Activity",
            value: "activity",
            description: `${user.Username}'s status`,
            emoji: "📊"
          },
          {
            label: "Cancel",
            value: "cancel",
            description: "Cancel the command",
            emoji: "❌"
          }
        ],
        min_values: 1,
        max_values: 1
      })
    );
    const paginationRow = new ActionRowBuilder().setComponents(
      new ButtonBuilder({ customId: "previous", label: "◀️", style: ButtonStyle.Primary }),
      new ButtonBuilder({ customId: "cancel", label: "🟥", style: ButtonStyle.Danger }),
      new ButtonBuilder({ customId: "next", label: "▶️", style: ButtonStyle.Primary }),
    );

    //#region Pagination
    const coll = await interaction.editReply({ embeds: [categories.overview[1][0]], components: [selectorRow] })
      .then(m => m.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 180_000 }));

    coll.on("collect", i => {
      const selectors = [selectorRow];
      switch(i.customId) {
      case "cancel": {
        coll.stop();
        break;
      }
      case "previous": {
        page = page - 1;
        if(page > embeds[1].length - 1) page = 0;
        if(embeds[0]) selectors.unshift(paginationRow);
        i.update({ embeds: [embeds[1][page]], components: selectors });
        break;
      }
      case "next": {
        page = page + 1;
        if(page > embeds[1].length - 1) page = 0;
        if(embeds[0]) selectors.unshift(paginationRow);
        i.update({ embeds: [embeds[1][page]], components: selectors });
        break;
      }
      case "profile-category": {
        if(i.values[0] === "cancel") {
          coll.stop();
          break;
        }
        embeds = categories[i.values[0]];
        page = 0;
        if(embeds[0]) selectors.unshift(paginationRow);
        i.update({ embeds: [embeds[1][page]], components: selectors });
        break;
      }
      default: {
        i.update({ content: "You shouldn't be seeing this! Report this to a developer\n\n**CUSTOMID**: "+i.customId, embeds: [], components: [] });
      }
      }
    });
    coll.on("end", () => {
      interaction.editReply({ content: `This embed has timed out. Please run the command again: </profile:${interaction.commandId}>`, components: [] });
    });
    //#endregion
  }
};