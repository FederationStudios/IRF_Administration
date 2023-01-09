// eslint-disable-next-line no-unused-vars
const { Client, ModalSubmitInteraction, ModalSubmitFields, Embed } = require("discord.js");
const { getRowifi } = require("../functions.js");
const { channels } = require("../config.json");

module.exports = {
  name: "report",
  /**
    * @param {Client} client
    * @param {ModalSubmitInteraction} interaction
    * @param {ModalSubmitFields} fields
    */
  run: async (client, interaction, fields) => {
    // Filing
    const rowifi = await getRowifi(interaction.user.id, client);
    const embed = new Embed({
      title: "MP Report",
      color: 0x400080,
      fields: [
        {
          name: "Reporter Username",
          value: fields.getTextInputValue("reporter_roblox"),
          inline: false
        },
        {
          name: "Reporter ID",
          value: interaction.user.id,
          inline: false
        },
        {
          name: "RoWifi Link",
          value: !rowifi.success ? `\`❌\` No, ${rowifi.error}` : `\`✅\` Yes, ${rowifi.roblox}`,
          inline: false
        },
        {
          name: "Offender",
          value: fields.getTextInputValue("offender_roblox"),
          inline: false
        },
        {
          name: "Place & Time of Incident",
          value: fields.getTextInputValue("incident_place"),
          inline: false
        },
        {
          name: "Description of Incident",
          value: fields.getTextInputValue("incident_description"),
          inline: false
        },
        {
          name: "Proof of Incident",
          value: fields.getTextInputValue("incident_proof"),
          inline: false
        }
      ],
      footer: {
        text: `MP Report - Secure Transmission | Filed at ${new Date().toLocaleTimeString()} ${new Date().toString().match(/GMT([+-]\d{2})(\d{2})/)[0]}`,
        iconURL: client.user.displayAvatarURL()
      }
    });
    await client.channels.fetch(channels.mp_report, { cache: true });
    await client.channels.cache.get(channels.mp_report).send({ content: `Incoming MP report from ${interaction.user.tag} (ID: ${interaction.user.id})`, embeds: [embed] }); // NSC
    embed.fields.splice(2, 1); // Remove RoWifi
    interaction.user.send({ content: `Here is a copy of a **MP report** you filed at <t:${Math.floor(Date.now()/1000.0)}:T>`, embeds: [embed] }); // DM copy
    return interaction.followUp({ content: "`✅` Report filed! A copy has been sent to your DMs if I can DM you", embeds: [embed] }); // User's copy
  }
};