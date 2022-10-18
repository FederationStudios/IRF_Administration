// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } = require("discord.js");
const { interactionEmbed } = require("../functions.js");
const { default: fetch } = require("node-fetch");

module.exports = {
  name: "userid",
  data: new SlashCommandBuilder()
    .setName("userid")
    .setDescription("Provides a Roblox ID when given a username")
    .addStringOption(option => {
      return option
        .setName("username")
        .setDescription("Roblox username")
        .setRequired(true);
    }),
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   * @param {CommandInteractionOptionResolver} options
   */
  run: async (client, interaction, options) =>{
    await interaction.deferReply(); // In case of overload
    let username = options.getString("username");
    username = await fetch(`https://api.roblox.com/users/get-by-username?username=${username}`)
      .then(r => r.json());
    
    if(username.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("username")}\` as a username and found no users with that username`, interaction, client, [true, 15]);

    const avatar = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${username.Id}&size=720x720&format=Png&isCircular=false`)
      .then(r => r.json())
      .then(r => r.data[0].imageUrl);
    return interaction.editReply({ embeds: [{
      title: `Roblox ID for ${username.Username}`,
      color: 0xDE2821,
      description: `${username.Id}`,
      thumbnail: {
        url: avatar
      }
    }] });
  }
};