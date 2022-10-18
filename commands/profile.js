// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } = require("discord.js");
const { interactionEmbed } = require("../functions.js");
const { default: fetch } = require("node-fetch");

module.exports = {
  name: "profile",
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Returns a user's profile")
    .addStringOption(option => {
      return option
        .setName("roblox")
        .setDescription("Roblox username")
        .setRequired(true);
    }),
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   * @param {CommandInteractionOptionResolver} options
   */
  run: async (client, interaction, options) => {
    await interaction.deferReply(); // In case of overload
    let user = options.getString("roblox");
    if(!isNaN(options.getString("roblox_username"))) {
      user = await fetch(`https://api.roblox.com/users/get-by-username?username=${options.getString("roblox")}`)
        .then(res => res.json());

      if(user.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("roblox")}\` as username but found no user`, interaction, client, [true, 15]);
    } else {
      user = await fetch(`https://api.roblox.com/users/${options.getString("roblox")}`)
        .then(async res => JSON.parse((await res.text()).trim()));
      // IDs that don't exist will return an error with spaces, causing normal parses to fail

      if(user.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("roblox")}\` as ID but found no user`, interaction, client, [true, 15]);
    }

    const avatar = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${user.Id}&size=720x720&format=Png&isCircular=false`)
      .then(r => r.json())
      .then(r => r.data[0].imageUrl);
    await interaction.editReply({ embeds: [{
      title: `${user.Username}'s Profile`,
      color: 0xDE2821,
      description: `https://roblox.com/users/${user.Id}/profile`,
      image: {
        url: avatar
      }
    }] });
  }
};