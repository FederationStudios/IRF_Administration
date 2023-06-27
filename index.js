const { Client, Collection, InteractionType, IntentsBitField } = require("discord.js");
const { default: fetch } = require("node-fetch");
const { interactionEmbed, toConsole, ids } = require("./functions.js");
const config = require("./config.json");
const fs = require("node:fs");
const Sequelize = require("sequelize");
const wait = require("node:util").promisify(setTimeout);
let ready = false;

//#region Setup
// Database
const sequelize = new Sequelize(config.mysql.database, config.mysql.user, config.mysql.password, {
  host: config.mysql.host,
  dialect: "mysql",
  logging: process.env.environment === "development" ? console.log : false,
  port: config.mysql.port
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
  intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent]
});
const slashCommands = [];
client.sequelize = sequelize;
client.models = sequelize.models;
client.commands = new Collection();
client.modals = new Collection();
//#endregion

//#region Events
client.on("ready", async () => {
  console.info("[READY] Client is ready");
  console.info(`[READY] Logged in as ${client.user.tag} (${client.user.id}) at ${new Date()}`);
  toConsole(`[READY] Logged in as ${client.user.tag} (${client.user.id}) at <t:${Math.floor(Date.now()/1000)}:T> and **${ready ? "can" : "cannot"}** receive commands`, new Error().stack, client);
  client.user.setActivity("users of the IRF", { type: "LISTENING" });

  if(!fs.existsSync("./commands")) await fs.mkdirSync("./commands");
  const commands = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));
  console.info(`[CMD-LOAD] Loading commands, expecting ${commands.length} commands`);
  for(const file of commands) {
    try {
      const command = require(`./commands/${file}`);
      client.commands.set(command.name, command);
      slashCommands.push(command.data.toJSON());
      console.info(`[CMD-LOAD] Loaded command ${command.name}`);
    } catch(err) {
      console.error(`[CMD-LOAD] Failed to load command ${file}: ${err}`);
    }
  }
  const modals = fs.readdirSync("./modals").filter(file => file.endsWith(".js"));
  console.info(`[CMD-LOAD] Loading modals, expecting ${modals.length} modals`);
  for(const file of modals) {
    try {
      const modal = require(`./modals/${file}`);
      client.modals.set(modal.name, modal);
      console.info(`[CMD-LOAD] Loaded modal ${modal.name}`);
    } catch(err) {
      console.error(`[CMD-LOAD] Failed to load modal ${file}: ${err}`);
    }
  }
  try {
    client.application.commands.set(slashCommands);
  } catch(err) {
    console.error(`[CMD-LOAD] Failed to load commands: ${err}`);
  }

  ready = true;

  setInterval(async () => {
    if(!ready) return;
    client.channels.cache.get(config.discord.banLogs) || await client.channels.fetch(config.discord.banLogs);
    client.guilds.cache.get(config.discord.mainServer) || await client.guilds.fetch(config.discord.mainServer);
    const parseBans = await client.models.Ban.findAll({ where: { reason: { [Sequelize.Op.like]: "%___irf" } } });
    for(const ban of parseBans) {
      /**
       * @type {[string, string]} Reason added by user and moderator
       */
      const reason = ban.reason.replace("___irf", "").split(" - Banned by ");

      /**
       * @type {{id:number,name:string,displayName:string}}
       */
      const victim = await fetch(`https://users.roblox.com/v1/users/${ban.userID}`).then(r => r.json());

      /**
       * @type {{id:number,name:string,displayName:string}}
       */
      let moderator = {};
      if(reason[1].includes("FairPlay"))
        reason[1] = "FairPlay_AntiCheat"; // Rewrite name
      // Fetch from Roblox
      moderator = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST", body: JSON.stringify({ usernames: [reason[1]] }), headers: { "Content-Type": "application/json" }
      }).then(r => r.json()).then(r => r.data[0]);
      /**
       * @type {{user:{username:string,id:string},nickname:string}}
       */
      let discord;

      // Find them in the server
      if(moderator.id !== 0) {
        // Attempt #1: Query via Discord
        discord = (await client.guilds.cache.get(config.discord.mainServer).members.search({ query: moderator.name, limit: 1 })).first();
        if(!discord) {
          // Attempt #2: Query via RoWifi
          const rowifiData = await fetch(`https://api.rowifi.xyz/v2/guilds/${config.discord.mainServer}/members/roblox/${moderator.id}`, {
            headers: { "Authorization": `Bot ${config.bot.rowifiApiKey}` }
          });
          if(rowifiData.ok) {
            const json = await rowifiData.json();
            discord = await client.guilds.cache.get(config.discord.mainServer).members.fetch(json[0].discord_id);
          }
        }
      }
      // Can't find them, use Roblox data
      if(!discord)
        discord = {
          user: {
            id: 0,
            username: moderator.name
          },
          nickname: moderator.displayName
        };

      const gameName = ids.find(pair => pair[1]) ? ids.find(pair => pair[1])[0] : ban.gameId;
      client.channels.cache.get(config.discord.banLogs).send({
        embeds: [{
          title: `${moderator.name} banned => ${victim.name} (In Game)`,
          description: `**${discord.user.id}** has added a ban for ${victim.name} (${victim.id}) on ${gameName}`,
          color: 0x00FF00,
          fields: [
            {
              name: "Game",
              value: ids.filter(pair => pair[1] == ban.gameID)[0][0],
              inline: true 
            },
            {
              name: "User",
              value: `${victim.name} (${victim.id})`,
              inline: true
            },
            {
              name: "Reason",
              value: `${reason[0]} - Banned by <@${discord.user.id}> (${moderator.id})`,
              inline: true
            }
          ],
          timestamp: ban.createdAt
        }]
      });
      // Post new ban data
      await ban.update({ reason: `${reason[0]} - Banned by ${discord.id === 0 ? moderator.name : `<@${discord.id}>`} (${moderator.id})` });
    }
  }, 20000);
});

client.on("interactionCreate", async (interaction) => {
  if(!ready) return interactionEmbed(4, "", "The bot is starting up, please wait", interaction, client, [true, 10]);

  if(interaction.type === InteractionType.ApplicationCommand) {
    let command = client.commands.get(interaction.commandName);
    if(command) {
      if(!command.modal) {
        await interaction.deferReply({ ephemeral: command.ephemeral });
        // Can't Promise.all(...), deferReply must be first
        await interaction.user.fetch(false);
      }
      const ack = command.run(client, interaction, interaction.options)
        .catch((e) => {
          interaction.editReply({ content: "Something went wrong while executing the command. Please report this to <@409740404636909578> (Tavi#0001)", embeds: [] });
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
          interaction.editReply({ content: "Something went wrong while executing the modal. Please report this to <@409740404636909578> (Tavi#0001)", embeds: [] });
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
    switch(interaction.commandName) {
    case "ban": {
      const value = interaction.options.getString("reason");
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
        // RULES //
        { name: "Rules - Ban Bypass (Alt)", value: "Rules - Bypassing ban using alternative account" },
        { name: "Rules - DDoS Attack", value: "Rules - Attempting or causing a Distributed Denial of Service attack" },
      ];
      if(!value) return interaction.respond(commonReasons);
      const matches = commonReasons.filter(r => r.value.toLowerCase().includes(value.toLowerCase()));
      if(matches.length === 0 && value.length <= 100) return interaction.respond([{ name: value.length > 25 ? value.slice(0, 22) + "..." : value, value: value }]);
      if(value.length > 100) return; // Timeout, too long value
      return interaction.respond(matches);
    }
    case "request": {
      const value = interaction.options.getString("reason");
      const reasons = [
        // DIVISIONS //
        { name: "GA - Random killing", value: "User is mass random killing" },
        { name: "MP - Military Law", value: "User is violating Military Law" },
        { name: "FSS - Bolshevik Law", value: "User is violating Bolshevik Law" },
        { name: "MoA - No admissions", value: "There is no Admissions in the server" },
        { name: "MoA - Gamepass Admissions abuse", value: "Admissions is abusing their powers (Gamepass)" },
        // RAIDS //
        { name: "Immigrant Raid", value: "Immigrant(s) are raiding against Military personnel" },
        { name: "Small Raid (1-7 raiders)", value: "There is chaos at the border and we are struggling to maintain control (1-7 raiders)" },
        { name: "Big Raid (8+ raiders)", value: "There is chaos at the border and we are struggling to maintain control (8+ raiders)" },
        { name: "Exploiter", value: "A user is exploiting" },
        // AUTHORITY //
        { name: "Higher authority needed (Kick)", value: "Need someone to kick a user" },
        { name: "Higher authority needed (Server Ban)", value: "Need someone to server ban a user" },
        { name: "Higher authority needed (Temp/Perm Ban)", value: "Need someone to temp/perm ban a user" },
        // BACKUP //
        { name: "General backup", value: "Control has been lost, general backup is needed" },
        { name: "DDoS Attack", value: "There is a DDoS attack on the server" }
      ];
      if(!value) return interaction.respond(reasons);
      const matches = reasons.filter(r => r.value.toLowerCase().includes(value.toLowerCase()));
      if(matches.length === 0 && value.length <= 100) return interaction.respond([{ name: value.length > 25 ? value.slice(0, 22) + "..." : value, value: value }]);
      if(value.length > 100) return; // Timeout, too long value
      return interaction.respond(matches);
    }
    case "shutdown": {
      let { name, value = "Papers" } = interaction.options.getFocused(true);
      if(name !== "target") return;
      if(value === "") value = "Papers";
      const servers = await fetch("https://tavis.page/test_servers").then(r => r.json());
      const matches = [];
      const idMap = new Map();
      let matchedGame = 0;
      for(const [name, id] of ids) {
        idMap.set(String(id), name);
        if(name.toLowerCase().includes(value.toLowerCase())) matchedGame = id;
      }
      // Push all servers with the game ID in matchedGame to matches
      for(const [placeId, jobs] of Object.entries(servers.servers)) {
        if(placeId == matchedGame) {
          // eslint-disable-next-line no-unused-vars
          for(const [jobId, [players, date]] of Object.entries(jobs)) {
            matches.push({ name: `${jobId} - ${idMap.get(placeId) || "RTT"} (${players.length})`, value: jobId });
          }
        }
      }
      matches.unshift({ name: "All servers - DANGEROUS (*)", value: "*" });
      return interaction.respond(matches);
    }
    default: {
      return interaction.respond([]); // Invalid commandName
    }
    }
  }
});

client.on("messageCreate", async (message) => {
  if(message.guild.id != config.discord.mainServer) return;
  if(message.author.bot) return;
  if(!message.channel.name.includes("reports")) return;
  // Message handler
  let refMessage;
  if(message.reference && message.content === "CHECK_IA_VIOLATIONS") {
    setTimeout(() => message.delete(), 5000);
    refMessage = await message.channel.messages.fetch(message.reference.messageId);
    if(refMessage.author.bot) return;
  } else {
    refMessage = message;
  }
  // Check attachments for direct files
  if(refMessage.attachments.size > 0) {
    for(const attachment of refMessage.attachments) {
      if(!/png|jpg|jpeg|webm|mov|mp4/i.test(attachment[1].name.split(".").pop())) {
        refMessage.react("1095481555431997460");
        message.react("1095484268219732028");
        return refMessage.reply({ content: "<:denied:1095481555431997460> | Direct recordings are **not allowed** for security reasons. Upload your files to YouTube, Medal.TV, or Streamable.com and send the link instead.\n\n> *This was an automated action. If you think this was a mistake, DM <@409740404636909578> (Tavi#0001).*" });
      }
    }
  }
  // RK check
  if(!/(?:Mass (?:RK|(?:kill.*)))|(?:([^\w\d]RK)|Random(ly)?(?: )?kill.*)/i.test(refMessage.content))
    if(message.content === "CHECK_IA_VIOLATIONS")
      return message.react("1095481555431997460");
    else
      return;
  refMessage.react("1095481555431997460");
  if(message.content === "CHECK_IA_VIOLATIONS")
    message.react("1095484268219732028"); // Successful RK detection
  refMessage.reply({ content: "<:denied:1095481555431997460> | Random killing reports are **not allowed**. Read the pinned messages and request Game Administrators for help if you find a random killer.\n\n> *This was an automated action. If you think this was a mistake, DM <@409740404636909578> (Tavi#0001).*" });
});
//#endregion

client.login(config.bot.token);

//#region Error handling
const recentErrors = []; 
process.on("uncaughtException", (err, origin) => {
  fs.writeSync(
    process.stderr.fd,
    `Caught exception: ${err}\n`+`Exception origin: ${origin}`
  );
});
process.on("unhandledRejection", async (reason, promise) => {
  if(!ready) {
    console.warn("Exiting due to a [unhandledRejection] during start up");
    console.error(reason, promise);
    return process.exit(15);
  }
  // Anti-spam System
  if(recentErrors.length > 2) {
    recentErrors.push({ promise: String(reason), time: new Date() });
    recentErrors.shift();
  } else {
    recentErrors.push({ promise: String(reason), time: new Date() });
  }
  if(recentErrors.length === 3
    && (recentErrors[0].reason === recentErrors[1].reason && recentErrors[1].reason === recentErrors[2].reason)
    && recentErrors[0].time.getTime() - recentErrors[2].time.getTime() < 1e4) {
    fs.writeFileSync("./latest-error.log", JSON.stringify({code: 15, info: {source: "Anti spam triggered! Three errors with the same content have occurred recently", r: String(reason)+" <------------> "+reason.stack}, time: new Date().toString()}, null, 2));
    return process.exit(17);
  }
  // Regular error handling
  const suppressChannel = await client.channels.fetch(config.discord.suppressChannel).catch(() => { return undefined; });
  if(!suppressChannel) return console.error(`An [unhandledRejection] has occurred.\n\n> ${reason}`);
  if(String(reason).includes("Interaction has already been acknowledged.") || String(reason).includes("Unknown interaction") || String(reason).includes("Unknown Message") || String(reason).includes("Cannot read properties of undefined (reading 'ephemeral')")) return suppressChannel.send(`A suppressed error has occured at process.on(unhandledRejection):\n>>> ${reason}`);
  toConsole(`An [unhandledRejection] has occurred.\n\n> ${String(reason).replaceAll(/:/g, "\\:")}`, reason.stack || new Error().stack, client);
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
