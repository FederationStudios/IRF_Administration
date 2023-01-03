// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require("discord.js");

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
  run: async (client, interaction) => {
    await interaction.deferReply();
    return interaction.editReply({ content: "Due to rushed development, this command is not ready for production. We ask for your patience while we fix remaining bugs while we're working to bring you something even better!" });
  }
};