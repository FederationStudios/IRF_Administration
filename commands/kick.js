const { interactionEmbed, getGroup, getRowifi } = require("../functions.js");
// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } = require("discord.js");
const { default: fetch } = require("node-fetch");
const { bot } = require("../config.json");

module.exports = {
  name: "kick",
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kicks a player from a server")
    .setDMPermission(false)
    .addStringOption(option => {
      return option
        .setName("target")
        .setDescription("The user you wish to kick")
        .setRequired(true)
        .setAutocomplete(true);
    })
    .addStringOption(option => {
      return option
        .setName("reason")
        .setDescription("Reason for kicking the player")
        .setRequired(true);
    }),
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   * @param {CommandInteractionOptionResolver} options
   */
  run: async (client, interaction, options) => {
    await interaction.deferReply(); // In case of overload
    const rowifi = await getRowifi(interaction.user.id, client);
    if(rowifi.error) return interactionEmbed(3, "", rowifi.error, interaction, client, [true, 10]);
    const roblox = await getGroup(rowifi.username, 4899462);
    if(!roblox.success) return interactionEmbed(3, "", roblox.error, interaction, client, [true, 10]);
    if(roblox.data.role.rank < 200) return interactionEmbed(3, "[ERR-UPRM]", "You do not have permission to use this command (Engineer+)", interaction, client, [true, 10]);
    const servers = await fetch("https://tavis.page/test_servers").then(r => r.json());
    if(!servers.success) return interactionEmbed(3, "", "The remote access system is having issues. Please try again later (Status code: 503)", interaction, client, [true, 10]);
    const target = options.getString("target");
    if(isNaN(target)) return interactionEmbed(3, "[ERR-INV]", "Invalid target (Must be a user ID)", interaction, client, [true, 10]);
    const reason = options.getString("reason");
    // For each server in each game, check if the target is in the server
    let playerFound = false;
    for(const [gameId, gameServers] in Object.entries(servers)) {
      for(const [players] in gameServers) {
        if(!players.includes(target)) continue;
        const universeId = await fetch(`https://apis.roblox.com/universes/v1/places/${gameId}/universe`).then(r => r.json()).then(r => r.universeId);
        const req = await fetch(`https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/remoteAdminCommands`, {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": bot.mainOCtoken
          },
          body: `{"message": '{"type": "kick", "userId": "${target}", "reason": "${reason}"}'}`,
          method: "POST"
        });
        if(!req.ok) return interactionEmbed(3, "", "The remote access system is having issues. Please try again later (Status code: 400)", interaction, client, [true, 10]);
      }
    }
    if(!playerFound) return interactionEmbed(3, "[ERR-ARGS]", "Invalid target (User is not in any servers)", interaction, client, [true, 10]);
    return interactionEmbed(1, "", `Kicked ${target} from the server`, interaction, client, [false, 0]);
  }
};