// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { ids } = require("../functions");

module.exports = {
  name: "ids",
  ephemeral: false,
  data: new SlashCommandBuilder()
    .setName("ids")
    .setDescription("Returns all IRF Game IDs")
    .setDMPermission(false),
  /**
    * @param {Client} client 
    * @param {CommandInteraction} interaction 
    */
  run: async (client, interaction) => {
    return interaction.editReply({ embeds: [new EmbedBuilder({
      color: 0xDE2821,
      title: "IRF Game IDs",
      description: `\`\`\`\n${ids.map(pair => `${pair[1]} -> ${pair[0]}`).join("\n")}\n\`\`\``,
      timestamp: new Date()
    })] });
  }
};