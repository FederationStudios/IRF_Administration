// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } = require("discord.js");
const { interactionEmbed, getRowifi, toConsole } = require("../functions.js");
const { default: fetch } = require("node-fetch");
const { bot, channels, discord } = require("../config.json");
const cooldown = new Map();

module.exports = {
  name: "request",
  ephemeral: false,
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
          { name: "Military Police", value: "Military Police" },
          { name: "State Security (NKVD)", value: "State Security" }
        )
        .setRequired(true);
    })
    .addStringOption(option => {
      return option
        .setName("reason")
        .setDescription("Reason for request")
        .setAutocomplete(true)
        .setRequired(true);
    }),
  /**
    * @param {Client} client
    * @param {CommandInteraction} interaction
    * @param {CommandInteractionOptionResolver} options
    */
  run: async (client, interaction, options) => {
    if(cooldown.has(interaction.user.id)) return interactionEmbed(3, "[ERR-CLD]", `You can request <t:${Math.floor((cooldown.get(interaction.user.id)+900000)/1000)}:R>`, interaction, client, [false, 0]);
    if(interaction.guild.id != discord.mainServer) return interactionEmbed(3, "[ERR-ARGS]", "This command can only be used in the main server", interaction, client, [true, 15]);
    const division = options.getString("division");
    await interaction.guild.roles.fetch({ cache: true });
    const role = interaction.guild.roles.cache.find(r => r.name === options.getString("division")).toString();
    const reason = options.getString("reason");
    const rowifi = await getRowifi(interaction.user.id, client);
    if(!rowifi.success) return interactionEmbed(3, "[ERR-UPRM]", "You must verify with RoWifi before using this command", interaction, client, [true, 15]);

    const presenceCheck = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      body: JSON.stringify({
        userIds: [rowifi.roblox]
      }),
      headers: {
        "Content-Type": "application/json",
        "Cookie": `.ROBLOSECURITY=${bot.validationToken || "abcdef123456"}`
      }
    })
      .then(r => r.json())
      .then(r => r.errors || r.userPresences[0]);
    if(!Array.isArray(presenceCheck) && presenceCheck.userPresenceType !== 2) return interactionEmbed(3, "[ERR-UPRM]", "You must be in-game in order to use this command. Try again later when you're in-game", interaction, client, [false, 0]);
    if(bot.validationToken && presenceCheck.gameId === null) return interactionEmbed(3, "[ERR-UPRM]", "You must have your profile set to public in order to use this command. Try again later when your profile is public", interaction, client, [false, 0]);
    if(Array.isArray(presenceCheck)) toConsole(`Presence check failed for ${interaction.user.tag} (${interaction.user.id})\n\`\`\`json\n${JSON.stringify(presenceCheck, null, 2)}\n\`\`\``, new Error().stack, client);

    await client.channels.fetch(channels.request, { cache: true });
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
