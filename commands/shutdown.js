const { interactionEmbed, getGroup, getRowifi } = require("../functions.js");
// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } = require("discord.js");

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
    const servers = await fetch("https://localhost/test_servers").then(r => r.json());
    if(!servers.sucess) return interactionEmbed(3, "", "The remote access system is having issues. Please try again later (Status code: 503)", interaction, client, [true, 10]);
    const target = options.getString("target");
    const reason = options.getString("reason");
    const server = servers.servers[target];
    if(!server && target !== "*") return interactionEmbed(3, "", "The server you are trying to shut down does not exist. Try using the autocomplete menu", interaction, client, [true, 10]);
    const resp = await fetch("https://apis.roblox.com/messaging-service/v1/universes/4126170162/topics/devMessages", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "AIOzEC6KeEq/rhheho4rqY17sSfbLQ2cdceWdurCXnyiqwvr"
      },
      body: `{"content": "${JSON.stringify({ type: "shutdown", target, reason }).replace(/"/g, "\"")}"}`,
      method: "POST"
    });
    if(!resp.ok) return interactionEmbed(3, "", "The remote access system is having issues. Please try again later (Status code: 400)", interaction, client, [true, 10]);
    return interactionEmbed(1, "", `Shut down server ${server.JobId} with ${server.players.length}`, interaction, client, [true, 10]);
  }
};