// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } = require("discord.js");
const { interactionEmbed } = require("../functions.js");
const { default: fetch } = require("node-fetch");

module.exports = {
  name: "username",
  data: new SlashCommandBuilder()
    .setName("username")
    .setDescription("Provides a Roblox username when given a Roblox ID")
    .addIntegerOption(option => {
      return option
        .setName("id")
        .setDescription("Roblox ID")
        .setRequired(true);
    }),
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   * @param {CommandInteractionOptionResolver} options
   */
  run: async (client, interaction, options) => {
    await interaction.deferReply(); // In case of overload
    let id = options.getInteger("id");
    id = await fetch(`https://api.roblox.com/users/${id}`)
      .then(async r => JSON.parse((await r.text()).trim()));
    // IDs that don't exist will return an error with spaces, causing normal parses to fail 

    if(id.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getInteger("id")}\` as a user ID and found no users with that ID`, interaction, client, [true, 15]);
    return interaction.editReply({ embeds: [{
      title: `Roblox Username for ${id.Id}`,
      color: 0xDE2821,
      description: `${id.Username}`
    }] });
  }
};