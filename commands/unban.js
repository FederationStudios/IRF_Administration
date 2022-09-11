// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, Embed, SlashCommandBuilder } = require("discord.js");
const { default: fetch } = require("node-fetch");
const { interactionEmbed, toConsole, ids } = require("../functions.js");
const { discord } = require("../config.json");

module.exports = {
  name: "unban",
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unbans a user from an IRF game")
    .setDMPermission(false)
    .addStringOption(option => {
      return option
        .setName("user_id")
        .setDescription("Roblox username or ID")
        .setRequired(true);
    })
    .addStringOption(option => {
      return option
        .setName("game_id")
        .setDescription("Roblox game ID")
        .setRequired(true)
        .addChoices(
          {
            name: "Papers, Please!",
            value: "583507031"
          },
          {
            name: "Sevastopol Military Academy",
            value: "603943201"
          },
          {
            name: "Prada Offensive",
            value: "4683162920"
          },
          {
            name: "Triumphal Arch of Moscow",
            value: "2506054725"
          },
          {
            name: "Moscow Parade Grounds",
            value: "6887031333"
          },
          {
            name: "Ryazan Airbase",
            value: "4424975098"
          },
          {
            name: "Tank Training Grounds",
            value: "2451182763"
          },
          {
            name: "Global",
            value: "0"
          }
        );
    })
    .addStringOption(option => {
      return option
        .setName("reason")
        .setDescription("Reason for unban")
        .setRequired(true);
    }),
  /**
   * @param {Client} client 
   * @param {CommandInteraction} interaction 
   * @param {CommandInteractionOptionResolver} options 
   */
  run: async (client, interaction, options) => {
    await interaction.deferReply(); // In case of overload
    if(!interaction.member.roles.cache.find(r => r.name === "Administration Access")) return interactionEmbed(3, "[ERR-UPRM]", "You are not authorized to use this command", interaction, client, [true, 10]);
    let id = options.getString("user_id");
    if(isNaN(options.getString("user_id"))) {
      id = await fetch(`https://api.roblox.com/users/get-by-username?username=${options.getString("user_id")}`)
        .then(res => res.json());
      
      if(id.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("user_id")}\` as username but found no user`, interaction, client, [true, 15]);
    } else {
      id = await fetch(`https://api.roblox.com/users/${options.getString("user_id")}`)
        .then(async res => JSON.parse((await res.text()).trim()));
      // IDs that don't exist will return an error with spaces, causing normal parses to fail

      if(id.errorMessage) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("user_id")}\` as ID but found no user`, interaction, client, [true, 15]);
    }
    if(isNaN(options.getString("game_id"))) return interactionEmbed(3, "[ERR-ARGS]", "Arg `game_id` must be a number", interaction, client, [true, 15]);
    if(!ids.some(pair => pair[1] == options.getString("game_id"))) return interactionEmbed(3, "[ERR-ARGS]", "Arg `game_id` must be a Military game ID. Use `/ids` to see all recognised games", interaction, client, [true, 15]);

    const bans = await client.models.Ban.findAll({
      where: {
        userID: id.Id,
        gameID: options.getString("game_id")
      }
    });
    if (bans.length === 0) {
      return interactionEmbed(3, "[ERR-ARGS]", `No bans exist for \`${id.Username}\` (${id.Id}) on ${ids.filter(pair => pair[1] == options.getString("game_id"))[0][0]}`, interaction, client, [false, 0]);
    }

    let error = false;
    try {
      await client.models.Ban.destroy({
        where: {
          userID: id.Id,
          gameID: options.getString("game_id")
        }
      });
    } catch (e) {
      toConsole(`An error occurred while removing a ban for ${id.Username} (${id.Id})\n> ${String(e)}`, new Error().stack, client);
      error = true;
    }
    if(error) return interactionEmbed(3, "[ERR-SQL]", "An error occurred while removing the ban. This has been reported to the bot developers", interaction, client, [true, 15]);
    await client.channels.cache.get(discord.unbanLogs).send({ embeds: [{
      title: `${interaction.member.nickname ?? interaction.user.username} has removed a ban for ${id.Username}`,
      description: `**${interaction.user.id}** has removed a ban for ${id.Username} (${id.Id}) on ${ids.filter(pair => pair[1] == options.getString("game_id"))[0][0]}`,
      color: 0x00FF00,
      fields: [
        {
          name: "Game",
          value: ids.filter(pair => pair[1] == options.getString("game_id"))[0][0],
          inline: true 
        },
        {
          name: "User",
          value: `${id.Username} (${id.Id})`,
          inline: true
        },
        {
          name: "Reason",
          value: `${options.getString("reason")} - Unbanned by ${interaction.member.toString()}`,
          inline: true
        }
      ],
      timestamp: new Date()
    }] });

    return interactionEmbed(1, "", `Removed ban for ${id.Username} (${id.Id}) on ${ids.filter(pair => pair[1] == options.getString("game_id"))[0][0]}\n> Reason: ${options.getString("reason")} - Unbanned by ${interaction.member.toString()}`, interaction, client, [false, 0]);
  }
};