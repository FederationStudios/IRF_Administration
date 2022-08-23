// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { default: fetch } = require("node-fetch");
const { interactionEmbed } = require("../functions.js");

module.exports = {
  name: "check",
  data: new SlashCommandBuilder()
    .setName("check")
    .setDescription("checks a users ban status")
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
    let id = options.getString("user_id");
    if(isNaN(id)) {
      id = await fetch(`https://api.roblox.com/users/get-by-username?username=${id}`)
        .then(r => r.json());
      
      if(id.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("user_id")}\` as a username and found no users with that username`, interaction, client, [true, 15]);
    } else {
      if(id < 0 || id > 100000000 || Math.floor(id) != id) return interactionEmbed(3, "[ERR-ARGS]", "Invalid user ID", interaction, client, [true, 15]);
      id = await fetch(`https://api.roblox.com/users/${Math.floor(id)}`)
        .then(async r => JSON.parse((await r.text()).trim()));

      if(id.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("user_id")}\` as a user ID and found no users with that ID`, interaction, client, [true, 15]);
    }
    if(!id.Id) throw new Error("User ID passed validation but doesn't exist");

    let bans = await client.models.Ban.findAll({ where: { userID: id.Id } });
    const embed = new EmbedBuilder();
    for(const ban of bans) {
      if(bans.indexOf(ban) === 0)
        embed.addFields([
          { name: "Game ID", value: String(ban.gameID), inline: true },
          { name: "Reason", value: ban.reason, inline: true },
          { name: "Date", value: `<t:${ban.unixtime}>`, inline: true },
        ]);
      else
        embed.addFields([
          { name: "​", value: String(ban.gameID), inline: true },
          { name: "​", value: ban.reason, inline: true },
          { name: "​", value: `<t:${ban.unixtime}>`, inline: true }
        ]);
    }
    if(bans.length === 0) embed.addFields([
      { name: "​", value: "-", inline: true },
      { name: "​", value: "No bans found!", inline: true },
      { name: "​", value: "-", inline: true }
    ]);
    return interaction.editReply({ content: `__**Bans for ${id.Username}**__`, embeds: [embed] });
  }
};