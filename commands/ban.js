// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder, Collection } = require("discord.js");
const { default: fetch } = require("node-fetch");
const { interactionEmbed, toConsole, ids, getRowifi } = require("../functions.js");
const { channels, discord } = require("../config.json");

module.exports = {
  name: "ban",
  ephemeral: false,
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bans a user from an IRF game")
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
        .setDescription("Reason for banning the user")
        .setAutocomplete(true)
        .setRequired(true);
    })
    .addAttachmentOption(option => {
      return option
        .setName("evidence")
        .setDescription("Evidence of the user's ban (Add when possible, please!)")
        .setRequired(false);
    }),
  /**
   * @param {Client} client 
   * @param {CommandInteraction} interaction 
   * @param {CommandInteractionOptionResolver} options 
   */
  run: async (client, interaction, options) => {
    if(!interaction.member.roles.cache.find(r => r.name === "Administration Access")) return interactionEmbed(3, "[ERR-UPRM]", "You are not authorized to use this command", interaction, client, [true, 10]);
    let id = options.getString("user_id");
    if(isNaN(options.getString("user_id"))) {
      id = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [options.getString("user_id")] })
      })
        .then(res => res.json())
        .then(r => r.data[0]);

      if(!id) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("user_id")}\` as username but found no user`, interaction, client, [true, 15]);
    } else {
      id = await fetch(`https://users.roblox.com/v1/users/${options.getString("user_id")}`)
        .then(async res => JSON.parse((await res.text()).trim()));

      if(id.errors) return interactionEmbed(3, "[ERR-ARGS]", `Interpreted \`${options.getString("user_id")}\` as ID but Roblox API returned: \`${id.errors[0].message}\``, interaction, client, [true, 15]);
    }
    if(isNaN(options.getString("game_id"))) return interactionEmbed(3, "[ERR-ARGS]", "Arg `game_id` must be a number", interaction, client, [true, 15]);
    if(!ids.some(pair => pair[1] == options.getString("game_id"))) return interactionEmbed(3, "[ERR-ARGS]", "Arg `game_id` must be a Military game ID. Use `/ids` to see all recognised games", interaction, client, [true, 15]);

    const bans = await client.models.Ban.findAll({
      where: {
        userID: id.id,
        gameID: options.getString("game_id")
      }
    });
    if(bans.length > 0) {
      interactionEmbed(2, "", `A ban already exists for ${id.name} (${id.id}) on ${ids.filter(pair => pair[1] == options.getString("game_id"))[0][0]}. This will overwrite the ban!\n(Adding ban in 5 seconds)`, interaction, client, [false, 0]);
      await require("node:util").promisify(setTimeout)(5000); // Show warning
    }
    const rowifi = await getRowifi(interaction.user.id, client);
    if(!rowifi.success) return interactionEmbed(3, "[ERR-UPRM]", rowifi.error ?? "Unknown error (Report this to a developer)", interaction, client, [true, 10]);

    const toFetch = [channels.image_host, channels.nsc_report, channels.banLogs];
    const p = [];
    for(const channel of toFetch) {
      p.push(client.channels.fetch(channel, { cache: true }));
    }
    await Promise.allSettled(p);
    let error = false;
    let evidence = options.getAttachment("evidence") || { proxyURL: "https://media.discordapp.net/attachments/1059784888603127898/1059808550840451123/unknown.png", contentType: "image/png" };
    if(evidence.contentType.split("/")[0] !== "image" && evidence.contentType.split("/")[1] === "gif" && evidence.contentType.split("/")[0] === "video") {
      return interactionEmbed(3, "[ERR-ARGS]", "Evidence must be an image (PNG, JPG, JPEG, or MP4)", interaction, client, [true, 15]);
    }
    console.info(evidence);
    // If no attachment, do not send to image_host
    if(options.getAttachment("evidence")) {
      evidence = await client.channels.cache.get(channels.image_host).send({
        content: `Evidence from ${interaction.user.toString()} (${interaction.user.tag} - ${interaction.user.id})`,
        files: [
          {
            attachment: evidence.proxyURL || evidence.url,
            name: `EvidenceFrom_${rowifi.username}+${rowifi.roblox}.${evidence.name.split(".").splice(-1)[0]}`
          }
        ]
      })
        .catch(err => {
          error = true;
          if(String(err).includes("Request entity too large")) return interactionEmbed(3, "[ERR-UPRM]", "Discord rejected the evidence (File too large). Try compressing the file first!", interaction, client, [true, 10]);
          return interactionEmbed(3, "[ERR-UPRM]", "Failed to upload evidence to image host", interaction, client, [true, 10]);
        });
      if(error) return;
    } else {
      const coll = new Collection();
      coll.set("0", {
        proxyURL: "https://media.discordapp.net/attachments/1059784888603127898/1059808550840451123/unknown.png"
      });
      evidence = {
        attachments: coll,
        url: "https://discord.com/channels/989558770801737778/1059784888603127898/1063318255265120396"
      };
    }
    try {
      if(bans.length > 0) {
        await client.models.Ban.update({
          userID: id.id,
          gameID: options.getString("game_id"),
          reason: `${options.getString("reason")} - Banned by ${interaction.user.toString()} (${rowifi.roblox})`,
          proof: evidence.url,
          unixtime: Math.floor(Date.now()/1000)
        }, {
          where: {
            userID: id.id,
            gameID: options.getString("game_id")
          }
        });
      } else {
        await client.models.Ban.create({
          userID: id.id,
          gameID: options.getString("game_id"),
          reason: `${options.getString("reason")} - Banned by ${interaction.user.toString()} (${rowifi.roblox})`,
          proof: evidence.url,
          unixtime: Math.floor(Date.now()/1000)
        });
      }
    } catch (e) {
      toConsole(`An error occurred while adding a ban for ${id.name} (${id.id})\n> ${String(e)}`, new Error().stack, client);
      error = true;
    }
    if(error) return interactionEmbed(3, "[SQL-ERR]", "An error occurred while adding the ban. This has been reported to the bot developers", interaction, client, [true, 15]);

    await client.channels.cache.get(discord.banLogs).send({ embeds: [{
      title: `${interaction.member.nickname ?? interaction.user.username} banned => ${id.name}`,
      description: `**${interaction.user.id}** has added a ban for ${id.name} (${id.id}) on ${ids.filter(pair => pair[1] == options.getString("game_id"))[0][0]}`,
      color: 0x00FF00,
      fields: [
        {
          name: "Game",
          value: ids.filter(pair => pair[1] == options.getString("game_id"))[0][0],
          inline: true 
        },
        {
          name: "User",
          value: `${id.name} (${id.id})`,
          inline: true
        },
        {
          name: "Reason",
          value: `${options.getString("reason")} - Banned by ${interaction.user.toString()} (${rowifi.roblox})\n\n**Evidence:** ${evidence.attachments.first().proxyURL}`,
          inline: true
        }
      ],
      timestamp: new Date()
    }] });
    await interaction.editReply({ content: "Ban added successfully!", embeds: [{
      title: "Ban Details",
      color: 0xDE2821,
      fields: [
        {
          name: "User",
          value: `${id.name} (${id.id})`,
          inline: true,
        }, {
          name: "Game",
          value: ids.filter(pair => pair[1] == options.getString("game_id")).map(pair => `${pair[0]} (${pair[1]})`)[0],
          inline: true,
        }, {
          name: "Reason",
          value: `${options.getString("reason")} - Banned by ${interaction.user.toString()} (${rowifi.roblox})\n\n**Evidence:** ${evidence.attachments.first().proxyURL}`,
          inline: false
        }
      ]
    }] });
    return interaction;
  }
};