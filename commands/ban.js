// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } = require("discord.js");
const { default: fetch } = require("node-fetch");
const { interactionEmbed, toConsole, ids, getRowifi } = require("../functions.js");
const { channels } = require("../config.json");

module.exports = {
  name: "ban",
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bans a user from an IRF game")
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
        .setRequired(true);
    })
    .addStringOption(option => {
      return option
        .setName("reason")
        .setDescription("Reason for unbanning the user")
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
    if(bans.length > 0) {
      interactionEmbed(2, "", `A ban already exists for ${id.Username} (${id.Id}) on ${ids.filter(pair => pair[1] == options.getString("game_id"))[0][0]}. This will overwrite the ban!\n(Adding ban in 5 seconds)`, interaction, client, [false, 0]);
      await require("node:util").promisify(setTimeout)(5000); // Show warning
    }

    let error = false;
    try {
      if(bans.length > 0) {
        await client.models.Ban.update({
          userID: id.Id,
          gameID: options.getString("game_id"),
          reason: `${options.getString("reason")} - Banned by ${interaction.user.toString()}`,
          unixtime: Date.now()
        }, {
          where: {
            userID: id.Id,
            gameID: options.getString("game_id")
          }
        });
      } else {
        await client.models.Ban.create({
          userID: id.Id,
          gameID: options.getString("game_id"),
          reason: `${options.getString("reason")} - Banned by ${interaction.user.toString()}`,
          unixtime: Date.now()
        });
      }
    } catch (e) {
      toConsole(`An error occurred while adding a ban for ${id.Username} (${id.Id})\n> ${String(e)}`, new Error().stack, client);
      error = true;
    }
    if(error) return interactionEmbed(3, "[SQL-ERR]", "An error occurred while adding the ban. This has been reported to the bot developers", interaction, client, [true, 15]);

    // NSC Auditing
    if((await getRowifi(id.Id)).error) {
      client.channels.cache.get(channels.nsc_report).send({ content: "A ban for a user not verified with RoWifi has been added!", embeds: [{
        title: "Ban Details",
        color: 0xDE2821,
        description: `**User:** ${id.Username} (${id.Id})`,
        fields: [{
          name: "Moderator",
          value: `${interaction.user.username} (${interaction.user.id})`,
          inline: true,
        }, {
          name: "Game",
          value: ids.filter(pair => pair[1] == options.getString("game_id")).map(pair => `${pair[0]} (${pair[1]})`).toString(),
          inline: true,
        }, {
          name: "Reason",
          value: options.getString("reason"),
          inline: false
        }]
      }] });
    }

    return interaction.editReply({ content: "Ban added successfully!", embeds: [{
      title: "Ban Details",
      color: 0xDE2821,
      fields: [
        {
          name: "User",
          value: `${id.Username} (${id.Id})`,
          inline: true,
        }, {
          name: "Game",
          value: ids.filter(pair => pair[1] == options.getString("game_id")).map(pair => `${pair[0]} (${pair[1]})`).toString(),
          inline: true,
        }, {
          name: "Reason",
          value: `${options.getString("reason")} - Banned by ${interaction.user.toString()}`,
          inline: false
        }
      ]
    }] });
  }
};