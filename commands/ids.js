// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, Embed, SlashCommandBuilder } = require("discord.js");
const { ids } = require("../functions");

module.exports = {
  name: "ids",
  data: new SlashCommandBuilder()
    .setName("ids")
    .setDescription("Returns all IRF Game IDs"),
  /**
    * @param {Client} client 
    * @param {CommandInteraction} interaction 
    */
  run: async (client, interaction) => {
    await interaction.deferReply(); // In case of overload
    return interaction.editReply({ embeds: [new Embed({
      color: 0xDE2821,
      title: "IRF Game IDs",
      description: `\`\`\`\n${ids.map(pair => `${pair[1]} -> ${pair[0]}`).join("\n")}\n\`\`\``,
      timestamp: new Date()
    })] });
  }
};