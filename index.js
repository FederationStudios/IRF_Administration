const { Client, Collection, InteractionType, IntentsBitField } = require("discord.js");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { default: fetch } = require("node-fetch");
const { interactionEmbed, toConsole, getRowifi, ids } = require("./functions.js");
const config = require("./config.json");
const fs = require("node:fs");
const rest = new REST({ version: 9 }).setToken(config.bot.token);
const Sequelize = require("sequelize");
const wait = require("node:util").promisify(setTimeout);
let ready = false;

//#region Setup
// Database
const sequelize = new Sequelize(config.mysql.database, config.mysql.user, config.mysql.password, {
  dialect: "mysql",
  logging: process.env.environment === "development" ? console.log : false,
});
if(!fs.existsSync("./models")) {
  console.warn("[DB] No models detected");
} else {
  console.info("[DB] Models detected");
  const models = fs.readdirSync("models").filter(file => file.endsWith(".js"));
  console.info(`[DB] Expecting ${models.length} models`);
  for(const model of models) {
    try {
      const file = require(`./models/${model}`);
      file.import(sequelize);
      console.info(`[DB] Loaded ${model}`);
    } catch(e) {
      console.error(`[DB] Unloaded ${model}`);
      console.error(`[DB] ${e}`);
    }
  }
  console.info("[DB] Loaded models");
  try {
    sequelize.authenticate();
    console.info("[DB] Authenticated connection successfully");
  } catch(e) {
    console.error("[DB] Failed to authenticate connection");
    console.error(`[DB] ${e}`);
    ready = "fail";
  }
  try {
    if(ready === "fail") throw new Error("Connection authentication failed");
    sequelize.sync({ alter: process.env.environment === "development" });
    console.info("[DB] Synced models");
  } catch(e) {
    console.error("[DB] Failed to sync models");
    console.error(`[DB] ${e}`);
  }
  ready = false; // Reset ready state
}

// Discord bot
const client = new Client({
  intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent]
});
const slashCommands = [];
client.sequelize = sequelize;
client.models = sequelize.models;
client.commands = new Collection();
client.modals = new Collection();

(async () => {
  if(!fs.existsSync("./commands")) await fs.mkdirSync("./commands");
  const commands = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));
  console.info(`[CMD-LOAD] Loading commands, expecting ${commands.length} commands`);

  for(let file of commands) {
    try {
      console.info(`[CMD-LOAD] Loading file ${file}`);
      let command = require(`./commands/${file}`);

      if(command.name) {
        console.info(`[CMD-LOAD] Loaded: ${file}`);
        slashCommands.push(command.data.toJSON());
        client.commands.set(command.name, command);
      }
    } catch(e) {
      console.warn(`[CMD-LOAD] Unloaded: ${file}`);
      console.warn(`[CMD-LOAD] ${e}`);
    }
  }

  console.info("[CMD-LOAD] Loaded commands");

  if(!fs.existsSync("./modals")) await fs.mkdirSync("./modals");
  const modals = fs.readdirSync("./modals").filter(file => file.endsWith(".js"));
  console.info(`[MDL-LOAD] Loading modals, expecting ${modals.length} modals`);
  for(let file of modals) {
    try {
      console.info(`[MDL-LOAD] Loading file ${file}`);
      let modal = require(`./modals/${file}`);

      if(modal.name) {
        console.info(`[MDL-LOAD] Loaded: ${file}`);
        client.modals.set(modal.name, modal);
      }
    } catch(e) {
      console.warn(`[MDL-LOAD] Unloaded: ${file}`);
      console.warn(`[MDL-LOAD] ${e}`);
    }
  }
  console.info("[MDL-LOAD] Loaded modals");
  await wait(500); // Artificial wait to prevent instant sending
  const now = Date.now();

  try {
    console.info("[APP-CMD] Started refreshing application (/) commands.");

    // Refresh based on environment
    if(process.env.environment === "development") {
      await rest.put(
        Routes.applicationGuildCommands(config.bot.applicationId, config.bot.guildId),
        { body: slashCommands }
      );
    } else {
      await rest.put(
        Routes.applicationCommands(config.bot.applicationId),
        { body: slashCommands }
      );
    }
    
    const then = Date.now();
    console.info(`[APP-CMD] Successfully reloaded application (/) commands after ${then - now}ms.`);
  } catch(error) {
    console.error("[APP-CMD] An error has occurred while attempting to refresh application commands.");
    console.error(`[APP-CMD] ${error}`);
  }
  console.info("[FILE-LOAD] All files loaded successfully");
  toConsole(`[READY] Finished loading commands at <t:${Math.floor(Date.now()/1000)}:T>`, new Error().stack, client);
  ready = true;

  setInterval(async () => {
    if(!ready) return;
    const parseBans = await client.models.Ban.findAll({ where: { reason: { [Sequelize.Op.like]: "%___irf" } } });
    for(const ban of parseBans) {
      const id = await fetch(`https://api.roblox.com/users/${ban.userID}`).then(r => r.text()).then(r => JSON.parse(r.trim()));
      if(id.errors) continue; // Doesn't exist for some reason
      const reason = ban.reason.replace("___irf", "");
      const discord = await client.guilds.cache.get(config.discord.mainServer).members.fetch({ query: reason.split("Banned by ")[1].trim(), limit: 1 }).then(coll => coll.first());
      if(!discord) continue;
      const rowifi = await getRowifi(discord.id);
      if(rowifi.success !== undefined) continue; // User doesn't exist in Discord
      await client.models.Ban.update({
        reason: reason.replace(reason.split("Banned by ")[1], discord.toString()) + ` (${rowifi.roblox})`
      }, {
        where: {
          banId: ban.banId
        }
      });
      client.channels.cache.get(config.discord.banLogs).send({
        embeds: [{
          title: `${discord.nickname ?? discord.user.username} has added a ban for ${id.Username} (In Game)`,
          description: `**${discord.user.id}** has added a ban for ${id.Username} (${id.Id}) on ${ids.filter(pair => pair[1] == ban.gameID)[0][0]}`,
          color: 0x00FF00,
          fields: [
            {
              name: "Game",
              value: ids.filter(pair => pair[1] == ban.gameID)[0][0],
              inline: true 
            },
            {
              name: "User",
              value: `${id.Username} (${id.Id})`,
              inline: true
            },
            {
              name: "Reason",
              value: `${ban.reason} - Banned by ${discord.user.toString()} (${rowifi.roblox})`,
              inline: true
            }
          ],
          timestamp: ban.createdAt
        }]
      });
    }
  }, 20000);
})();
//#endregion

//#region Events
client.on("ready", async () => {
  console.info("[READY] Client is ready");
  console.info(`[READY] Logged in as ${client.user.tag} (${client.user.id}) at ${new Date()}`);
  toConsole(`[READY] Logged in as ${client.user.tag} (${client.user.id}) at <t:${Math.floor(Date.now()/1000)}:T> and **${ready ? "can" : "cannot"}** receive commands`, new Error().stack, client);
  // Set the status to new Date();
  client.guilds.cache.each(g => g.members.fetch());
  client.user.setActivity(`${client.users.cache.size} users across ${client.guilds.cache.size} servers`, { type: "LISTENING" });

  setInterval(() => {
    client.guilds.cache.each(g => g.members.fetch());
    client.user.setActivity(`${client.users.cache.size} users across ${client.guilds.cache.size} servers`, { type: "LISTENING" });
  }, 60000);
});

client.on("interactionCreate", async (interaction) => {
  if(!ready) return interactionEmbed(4, "", "The bot is starting up, please wait", interaction, client, [true, 10]);
  
  if(interaction.type === InteractionType.ApplicationCommand) {
    let command = client.commands.get(interaction.commandName);
    if(command) {
      const ack = command.run(client, interaction, interaction.options)
        .catch((e) => {
          interaction.editReply("Something went wrong while executing the command. Please report this to <@409740404636909578> (Tavi#0001)");
          return toConsole(e.stack, new Error().stack, client);
        });
      
      await wait(1e4);
      if(ack != null) return; // Already executed
      interaction.fetchReply()
        .then(m => {
          if(m.content === "" && m.embeds.length === 0) interactionEmbed(3, "[ERR-UNK]", "The command timed out and failed to reply in 10 seconds", interaction, client, [true, 15]);
        });
    }
  } if(interaction.type === InteractionType.ModalSubmit) {
    let modal = client.modals.get(interaction.customId);
    if(modal) {
      await interaction.deferReply({ ephemeral: true });
      const ack = modal.run(client, interaction, interaction.fields)
        .catch((e) => {
          interaction.editReply("Something went wrong while executing the modal. Please report this to <@409740404636909578> (Tavi#0001)");
          return toConsole(e.stack, new Error().stack, client);
        });

      await wait(1e4);
      if(ack != null) return; // Already executed
      interaction.fetchReply()
        .then(m => {
          if(m.content === "" && m.embeds.length === 0) interactionEmbed(3, "[ERR-UNK]", "The modal timed out and failed to reply in 10 seconds", interaction, client, [true, 15]);
        });
    }
  } else if(interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    const value = interaction.options.getString("reason");
    if(!value) return;
    if(interaction.commandName === "ban") {
      const commonReasons = [
        // ROBLOX TOS //
        { name: "TOS - Chat bypass", value: "Roblox TOS - Bypassing chat filter" },
        { name: "TOS - Clothes bypass", value: "Roblox TOS - Bypassed clothing" },
        { name: "TOS - Username bypass", value: "Roblox TOS - Bypassed username" },
        { name: "TOS - Nudity", value: "Roblox TOS - Nudity" },
        { name: "TOS - Exploit", value: "Roblox TOS - Exploiting" },
        { name: "TOS - Impersonation", value: "Roblox TOS - Impersonation" },
        { name: "TOS - Racism", value: "Roblox TOS - Racism" },
        { name: "TOS - Nazism", value: "Roblox TOS - Nazism" },
        { name: "TOS - NSFW", value: "Roblox TOS - NSFW content or actions (PDA included)" },
        // TBAN //
        { name: "TBan - Evasion", value: "Temp Ban - Evasion of moderation action" },
        { name: "TBan - Nudity", value: "Temp Ban - Nudity" },
        { name: "TBan - NSFW", value: "Temp Ban - NSFW content or actions (PDA included)" },
        { name: "TBan - Spamming", value: "Temp Ban - Spamming" },
        { name: "TBan - SS Insignia", value: "Temp Ban - SS Insignia" },
        { name: "TBan - Chat bypass", value: "Temp Ban - Bypassing chat filter" },
        // GAME RULES //
        { name: "Rules - Glitching", value: "Game Rules - Glitching" },
        { name: "Rules - RK", value: "Game Rules - Mass random killing (RK)" },
        { name: "Rules - Ban Bypass (Alt)", value: "Rules - Bypassing ban using alternative account" }
      ];
      const matches = commonReasons.filter(r => r.value.toLowerCase().includes(value.toLowerCase()));
      if(matches.length === 0) return interaction.respond([{ name: value.length > 25 ? value.slice(0, 22) + "..." : value, value: value }]);
      return interaction.respond(matches);
    } else if(interaction.commandName === "request") {
      const reasons = [
        // GAME RULES //
        { name: "Random killing", value: "User is mass random killing" },
        { name: "Gamepass Admissions abuse", value: "Admissions is abusing their powers (Gamepass)" },
        // RAIDS //
        { name: "Immigrant Raid", value: "Immigrant(s) are raiding against Military personnel" },
        { name: "Small Raid (1-7 raiders)", value: "There is chaos at the border and we are struggling to maintain control (1-7 raiders)" },
        { name: "Big Raid (8+ raiders)", value: "There is chaos at the border and we are struggling to maintain control (8+ raiders)" },
        { name: "Exploiter", value: "A user is exploiting" },
        // AUTHORITY //
        { name: "Higher authority needed (Kick)", value: "Need someone to kick a user" },
        { name: "Higher authority needed (Server Ban)", value: "Need someone to server ban a user" },
        { name: "Higher authority needed (Temp Ban)", value: "Need someone to temp ban a user" },
        { name: "Higher authority needed (Perm Ban)", value: "Need someone to perm ban a user" },
        // BACKUP //
        { name: "General backup", value: "Control has been lost, general backup is needed" },
      ];
      const matches = reasons.filter(r => r.value.toLowerCase().includes(value.toLowerCase()));
      if(matches.length === 0) return interaction.respond([{ name: value.length > 25 ? value.slice(0, 22) + "..." : value, value: value }]);
      return interaction.respond(matches);
    } else {
      return;
    }
  } else {
    interaction.deleteReply();
  }
});

client.on("messageCreate", async (message) => {
  if(message.guild.id != config.discord.mainServer) return;
  if(message.author.bot) return;
  if(!message.channel.name.includes("reports")) return;
  if(!/((Mass )?([^\w\d]RK))|(Random kill.*)/i.test(message.content)) return;
  await message.react("790001925411700746");
  return message.reply({ content: "<:NoVote:790001925411700746> | Random killing reports are **not allowed**. Read the pinned messages and request Game Administrators for help if you find a random killer.\n\n> *This was an automated action. If you think this was a mistake, react to this with ❓.*" });
});
//#endregion

client.login(config.bot.token);

//#region Error handling
process.on("uncaughtException", (err, origin) => {
  if(!ready) {
    console.warn("Exiting due to a [uncaughtException] during start up");
    console.error(err, origin);
    return process.exit(14);
  }
  // eslint-disable-next-line no-useless-escape
  toConsole(`An [uncaughtException] has occurred.\n\n> ${String(err)}\n> ${String(origin.replaceAll(/:/g, "\:"))}`, new Error().stack, client);
});
process.on("unhandledRejection", async (promise) => {
  if(!ready) {
    console.warn("Exiting due to a [unhandledRejection] during start up");
    console.error(promise);
    return process.exit(15);
  }
  const suppressChannel = await client.channels.fetch(process.env.SUPRESS).catch(() => { return undefined; });
  if(!suppressChannel) return console.error(`An [unhandledRejection] has occurred.\n\n> ${promise}`);
  if(String(promise).includes("Interaction has already been acknowledged.") || String(promise).includes("Unknown interaction") || String(promise).includes("Unknown Message") || String(promise).includes("Cannot read properties of undefined (reading 'ephemeral')")) return suppressChannel.send(`A suppressed error has occured at process.on(unhandledRejection):\n>>> ${promise}`);
  // eslint-disable-next-line no-useless-escape
  toConsole(`An [unhandledRejection] has occurred.\n\n> ${String(promise).replaceAll(/:/g, "\:")}`, new Error().stack, client);
});
process.on("warning", async (warning) => {
  if(!ready) {
    console.warn("[warning] has occurred during start up");
    console.warn(warning);
  }
  toConsole(`A [warning] has occurred.\n\n> ${warning}`, new Error().stack, client);
});
process.on("exit", (code) => {
  console.error("[EXIT] The process is exiting!");
  console.error(`[EXIT] Code: ${code}`);
});
//#endregion
