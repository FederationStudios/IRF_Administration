// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { interactionEmbed, getRowifi } = require("../functions.js");
const { channels } = require("../config.json");
const cooldown = new Map();

module.exports = {
  name: "request",
  data: new SlashCommandBuilder()
    .setName("request")
    .setDescription("Requests a division to assist you (Cooldown: 15 minutes)")
    .setDMPermission(false)
    .addStringOption(option => {
      return option
        .setName("division")
        .setDescription("Division you are requesting")
        .addChoices(
          { name: "Admissions", value: "Admissions" },
          { name: "Game Administration", value: "Game Administrator" },
          { name: "National Defense", value: "National Defense" },
          // { name: "Military Police", value: "Military Police" }
        )
        .setRequired(true);
    })
    .addStringOption(option => {
      return option
        .setName("reason")
        .setDescription("Reason for request")
        .setRequired(true);
    }),
  /**
    * @param {Client} client
    * @param {CommandInteraction} interaction
    * @param {CommandInteractionOptionResolver} options
    */
  run: async (client, interaction, options) => {
    await interaction.deferReply(); // In case of overload
    if(cooldown.has(interaction.user.id)) return interactionEmbed(3, "[ERR-CLD]", `You can request <t:${Math.floor((cooldown.get(interaction.user.id)+900000)/1000)}:R>`, interaction, client, [false, 0]);
    const division = options.getString("division");
    const role = interaction.guild.roles.cache.find(r => r.name === options.getString("division")).toString();
    const reason = options.getString("reason");
    const rowifi = await getRowifi(interaction.user.id);
    if(rowifi.error) return interactionEmbed(3, "[ERR-UPRM]", "You must verify with RoWifi before using this command", interaction, client, [true, 15]);

    await client.channels.cache.get(channels.request).send({ content: role, embeds: [{
      title: `${rowifi.username} is requesting ${division}`,
      color: 0xDE2821,
      description: `${interaction.member.toString()} is requesting ${role} due to: __${reason}__\n\n**Profile Link:** https://www.roblox.com/users/${rowifi.roblox}/profile\n\n**React if you are handling this request**`
    }] })
      .then(m => m.react("✅"));
    
    interaction.editReply({ embeds: [{
      title: "Request Sent",
      color: 0xDE2821,
      description: `Your request has been sent and ${division} has been called`
    }] });

    cooldown.set(interaction.member.id, Date.now());
    setTimeout(() => {
      cooldown.delete(interaction.member.id);
    }, 900000); // 15 minutes
  }
};