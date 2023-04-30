// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } = require("discord.js");
const { interactionEmbed } = require("../functions.js");
const { default: fetch } = require("node-fetch");

module.exports = {
  name: "username",
  ephemeral: false,
  data: new SlashCommandBuilder()
    .setName("username")
    .setDescription("Provides a Roblox username when given a Roblox ID")
    .addIntegerOption(option => {
      return option
        .setName("id")
        .setDescription("Roblox ID")
        .setRequired(true);
    }),
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   * @param {CommandInteractionOptionResolver} options
   */
  run: async (client, interaction, options) => {
    let id = options.getInteger("id");
    id = await fetch(`https://users.roblox.com/v1/users/${id}`)
      .then(r => r.json());

    if(id.errors) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getInteger("id")}\` as a user ID but Roblox API returned: \`${id.errors[0].message}\``, interaction, client, [true, 15]);
    const avatar = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${id.id}&size=720x720&format=Png&isCircular=false`)
      .then(r => r.json())
      .then(r => r.data[0].imageUrl);
    return interaction.editReply({ embeds: [{
      title: `Roblox Username for ${id.id}`,
      color: 0xDE2821,
      description: `${id.name} (${id.displayName})`,
      thumbnail: {
        url: avatar
      }
    }] });
  }
};