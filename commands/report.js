// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");

module.exports = {
  name: "report",
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("Starts the Military Police (MP) reporting process"),
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const nsc_report = new ModalBuilder({ title: "Military Police Report", custom_id: "report" });
    const components = [
      new TextInputBuilder({ label: "What is your Roblox username?", custom_id: "reporter_roblox", min_length: 3, max_length: 16, style: TextInputStyle.Short }),
      new TextInputBuilder({ label: "What is the Roblox username of the offender?", custom_id: "offender_roblox", min_length: 3, max_length: 16, style: TextInputStyle.Short }),
      new TextInputBuilder({ label: "Where and when did this incident occur?", placeholder: "Example: 2 minutes ago on Sevastopol", custom_id: "incident_place", min_length: 3, max_length: 32, style: TextInputStyle.Short }),
      new TextInputBuilder({ label: "What occurred during this incident?", placeholder: "Please provide as much detail as possible", custom_id: "incident_description", min_length: 3, max_length: 1024, style: TextInputStyle.Paragraph }),
      new TextInputBuilder({ label: "Please provide all relevant proof", placeholder: "Please post links only. This bot cannot see attachments!", custom_id: "incident_proof", min_length: 3, max_length: 2048, style: TextInputStyle.Paragraph }),
    ];

    for(let component of components) {
      const row = new ActionRowBuilder();
      row.addComponents(component);
      nsc_report.addComponents(row);
    }

    await interaction.showModal(nsc_report);
  }
};