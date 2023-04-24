// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");

module.exports = {
  name: "nsc_report",
  modal: true,
  data: new SlashCommandBuilder()
    .setName("nsc_report")
    .setDescription("Report a user for severe conduct (i.e. personal safety concerns)"),
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const nsc_report = new ModalBuilder({ title: "NSC Report", custom_id: "nsc_report" });
    const components = [
      new TextInputBuilder({ label: "Your Roblox username?", custom_id: "reporter_roblox", min_length: 3, max_length: 16, style: TextInputStyle.Short }),
      new TextInputBuilder({ label: "Roblox username of the offender(s)?", custom_id: "offender_roblox", min_length: 3, max_length: 128, style: TextInputStyle.Paragraph }),
      new TextInputBuilder({ label: "Location of the incident?", placeholder: "Example: 2 minutes ago on Sevastopol", custom_id: "incident_place", min_length: 3, max_length: 32, style: TextInputStyle.Short }),
      new TextInputBuilder({ label: "What occurred during this incident?", placeholder: "Please provide as much detail as possible", custom_id: "incident_description", min_length: 3, max_length: 2000, style: TextInputStyle.Paragraph }),
      new TextInputBuilder({ label: "Relevant proof", placeholder: "Post links ONLY. This bot cannot see attachments!", custom_id: "incident_proof", min_length: 3, max_length: 4000, style: TextInputStyle.Paragraph }),
    ];

    for(let component of components) {
      const row = new ActionRowBuilder();
      row.addComponents(component);
      nsc_report.addComponents(row);
    }

    await interaction.showModal(nsc_report);
  }
};