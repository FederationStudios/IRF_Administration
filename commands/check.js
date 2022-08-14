// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } = require("discord.js");
const Table = require("cli-table");
const { default: fetch } = require("node-fetch");
const { interactionEmbed, stripConfig } = require("../functions.js");

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
      
      if(id.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${id}\` as a username and found no users with that username`, interaction, client, [true, 15]);
    } else {
      id = await fetch(`https://api.roblox.com/users/${id}`)
        .then(async r => JSON.parse((await r.text()).trim()));

      if(id.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${id}\` as a user ID and found no users with that ID`, interaction, client, [true, 15]);
    }

    const table = new Table({ head: ["Game ID", "Reason", "Date"], colAligns: ["middle", "middle", "middle"], chars: stripConfig });
    const bans = await client.models.Ban.findAll({ where: { userID: id.Id } });
    for(const ban of bans) {
      const date = new Date(Math.floor(ban.unixtime*1000));

      table.push([ban.gameID, ban.reason, `${date.toLocaleString()} ${date.toString().match(/GMT([+-]\d{2})(\d{2})/)[0]}`]);
    }
    if(bans.length === 0) table.push(["-", " No bans found for that user!", "-"]);
    return interaction.editReply({ content: `__**Bans for ${id.Username}**__\n\`\`\`\n${table.toString()}\n\`\`\`` });
  }
};