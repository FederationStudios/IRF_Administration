const { interactionEmbed, getGroup, getRowifi, ids } = require("../functions.js");
// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } = require("discord.js");
const { default: fetch } = require("node-fetch");
const { bot } = require("../config.json");

module.exports = {
  name: "shutdown",
  data: new SlashCommandBuilder()
    .setName("shutdown")
    .setDescription("Shuts down a Papers, Please server")
    .setDMPermission(false)
    .addStringOption(option => {
      return option
        .setName("target")
        .setDescription("Target server's JobId to shut down")
        .setRequired(true)
        .setAutocomplete(true);
    })
    .addStringOption(option => {
      return option
        .setName("reason")
        .setDescription("Reason for shutting down")
        .setAutocomplete(true);
    }),
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   * @param {CommandInteractionOptionResolver} options
   */
  run: async (client, interaction, options) => {
    const rowifi = await getRowifi(interaction.user.id, client);
    if(rowifi.error) return interactionEmbed(3, "", rowifi.error, interaction, client, [true, 10]);
    const roblox = await getGroup(rowifi.username, 872876);
    if(roblox.error) return interactionEmbed(3, "", roblox.error, interaction, client, [true, 10]);
    if(roblox.role.rank < 240) return interactionEmbed(3, "[ERR-UPRM]", "You do not have permission to use this command (Engineer+)", interaction, client, [true, 10]);
    const servers = await fetch("https://tavis.page/test_servers").then(r => r.json());
    if(!servers.success) return interactionEmbed(3, "", "The remote access system is having issues. Please try again later (Status code: 503)", interaction, client, [true, 10]);
    const target = options.getString("target");
    const reason = options.getString("reason");
    // If target does not equal *, find the gameId which matches the target
    let server = false;
    for(const [PlaceId, game] of Object.entries(servers.servers)) {
      if(target === "*") break; // Not handled here, but later on
      for(const [JobId, Players] of Object.entries(game)) {
        if(JobId === target) {
          const universeId = await fetch(`https://apis.roblox.com/universes/v1/places/${PlaceId}/universe`).then(r => r.json()).then(r => r.universeId);
          const resp = await fetch(`https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/remoteAdminCommands`, {
            headers: {
              "Content-Type": "application/json",
              "x-api-key": bot.mainOCtoken
            },
            body: `{"content": "${JSON.stringify({ type: "shutdown", target, reason }).replace(/"/g, "\"")}"}`,
            method: "POST"
          });
          if(!resp.ok) {
            const att2 = await fetch(`https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/remoteAdminCommands`, {
              headers: {
                "Content-Type": "application/json",
                "x-api-key": bot.altOCtoken
              },
              body: `{"content": "${JSON.stringify({ type: "shutdown", target, reason }).replace(/"/g, "\"")}"}`,
              method: "POST"
            });
            if(!att2.ok) return interactionEmbed(3, "", "The remote access system is having issues. Please try again later (Status code: 400)", interaction, client, [true, 10]);
          }
          server = {JobId, Players: Players[0]};
        }
      }
      if(server) break;
    }
    if(!server && target !== "*") return interactionEmbed(3, "", "The server you are trying to shut down does not exist. Try using the autocomplete menu", interaction, client, [true, 10]);
    if(target === "*") {
      for(const [, id] of ids) {
        if(id === 0) continue;
        const universeId = await fetch(`https://apis.roblox.com/universes/v1/places/${id}/universe`).then(r => r.json()).then(r => r.universeId);
        const resp = await fetch(`https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/remoteAdminCommands`, {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": bot.mainOCtoken
          },
          body: `{"content": "${JSON.stringify({ type: "shutdown", target: "*", reason }).replace(/"/g, "\"")}"}`,
          method: "POST"
        });
        if(!resp.ok) {
          await fetch(`https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/remoteAdminCommands`, {
            headers: {
              "Content-Type": "application/json",
              "x-api-key": bot.altOCtoken
            },
            body: `{"content": "${JSON.stringify({ type: "shutdown", target: "*", reason }).replace(/"/g, "\"")}"}`,
            method: "POST"
          });
        }
      }
    }
    return interactionEmbed(1, "", `Shut down server ${target === "*" ? "*" : server.JobId} with ${server.Players.length}`, interaction, client, [true, 10]);
  }
};