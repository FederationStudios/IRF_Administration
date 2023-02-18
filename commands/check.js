// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require("discord.js");
const { ButtonStyle, ComponentType } = require("discord-api-types/v10");
const { default: fetch } = require("node-fetch");
const { interactionEmbed } = require("../functions.js");

module.exports = {
  name: "check",
  data: new SlashCommandBuilder()
    .setName("check")
    .setDescription("Checks for bans associated with a user")
    .setDMPermission(false)
    .addStringOption(option => {
      return option
        .setName("user_id")
        .setDescription("User's Roblox ID")
        .setRequired(true);
    }),
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   * @param {CommandInteractionOptionResolver} options
   */
  run: async (client, interaction, options) => {
    await interaction.deferReply(); // In case of overload
    const filter = (i) => i.user.id === interaction.user.id;
    let id = options.getString("user_id");
    if(isNaN(id)) {
      id = await fetch(`https://api.roblox.com/users/get-by-username?username=${id}`)
        .then(r => r.json());
      
      if(id.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("user_id")}\` as a username and found no users with that username`, interaction, client, [true, 15]);
    } else {
      if(Math.floor(id) != id) return interactionEmbed(3, "[ERR-ARGS]", "Invalid user ID", interaction, client, [true, 15]);
      id = await fetch(`https://api.roblox.com/users/${Math.floor(id)}`)
        .then(async r => JSON.parse((await r.text()).trim()));

      if(id.errors) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("user_id")}\` as a user ID and found no users with that ID`, interaction, client, [true, 15]);
    }
    if(!id.Id) return interactionEmbed(3, "[ERR-ARGS]", "Invalid user ID provided", interaction, client, [true, 15]);

    let bans = await client.models.Ban.findAll({ where: { userID: id.Id } });
    const avatar = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${id.Id}&size=720x720&format=Png&isCircular=false`)
      .then(r => r.json())
      .then(r => r.data[0].imageUrl);
    const embeds = [];
    for(const ban of bans) {
      if(!/.+\/([0-9]{0,20})\/([0-9]{0,20})$/.exec(ban.proof || "https://discord.com/channels/989558770801737778/1059784888603127898/1063318255265120396").length[1]) {
        embeds.push(new EmbedBuilder({ title: "Error", description: `Proof invalid. RegEx could not find channel ID in \`${ban.proof}\` (ID: ${ban.banId})` }));
        continue;
      }
      const evid = await client.channels.fetch(/.+\/([0-9]{0,20})\/([0-9]{0,20})$/.exec(ban.proof || "https://discord.com/channels/989558770801737778/1059784888603127898/1063318255265120396")[1])
        .then(c => c.messages.fetch(/.+\/([0-9]{0,20})\/([0-9]{0,20})$/g.exec(ban.proof || "https://discord.com/channels/989558770801737778/1059784888603127898/1063318255265120396")[2]));
      const image = evid.attachments.first().url.endsWith("mp4") ? null : { url: evid.attachments.first().url, proxyURL: evid.attachments.first().proxyURL };
      embeds.push(new EmbedBuilder({
        title: `__**Bans for ${id.Username}**__`,
        thumbnail: {
          url: avatar
        },
        fields: [
          { name: "Game ID", value: String(ban.gameID), inline: true },
          { name: "Reason", value: evid.attachments.first().url.endsWith("mp4") ? `${ban.reason}\n\n**Evidence**: ${evid.attachments.first().proxyURL}` : ban.reason, inline: true },
          { name: "Date", value: `<t:${ban.unixtime}>`, inline: true },
        ],
        image: image,
        footer: {
          text: `Ban ${bans.indexOf(ban) + 1} of ${bans.length}`
        },
        timestamp: new Date()
      }));
    } // 
    if(bans.length === 0) embeds.push(new EmbedBuilder({
      title: `__**Bans for ${id.Username}**__`,
      thumbnail: {
        url: avatar
      },
      fields: [
        { name: "Game ID", value: "-", inline: true },
        { name: "Reason", value: "No bans found!", inline: true },
        { name: "Date", value: "-", inline: true }
      ],
      footer: {
        text: "Ban 0 of 0"
      },
      timestamp: new Date()
    }));

    let page = 0;
    const paginationRow = new ActionRowBuilder().setComponents(
      new ButtonBuilder({ customId: "previous", label: "◀️", style: ButtonStyle.Primary }),
      new ButtonBuilder({ customId: "cancel", label: "🟥", style: ButtonStyle.Danger }),
      new ButtonBuilder({ customId: "next", label: "▶️", style: ButtonStyle.Primary }),
    );
    const data = { embeds: [embeds[page]], components: [paginationRow] };
    if(embeds.length < 2) delete data.components;
    const coll = await interaction.editReply(data)
      .then(r => r.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 120_000 }));
      
    coll.on("collect", (i) => {
      if(i.customId === "next") {
        page = page + 1;
        if(page > embeds.length - 1) page = 0;
        i.update({ embeds: [embeds[page]], components: [paginationRow] });
      } else if(i.customId === "previous") {
        page = page - 1;
        if(page < 0) page = embeds.length - 1;
        i.update({ embeds: [embeds[page]], components: [paginationRow] });
      } else {
        coll.stop();
      }
    });

    coll.once("end", () => {
      interaction.deleteReply();
    });

    return;
  }
};