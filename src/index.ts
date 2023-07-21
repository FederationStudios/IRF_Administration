import {
  ActivityType,
  Client,
  Collection,
  GuildMember,
  IntentsBitField,
  InteractionType,
  Message,
  RESTPostAPIChatInputApplicationCommandsJSONBody
} from 'discord.js';
import * as fs from 'node:fs';
import { Op, Sequelize } from 'sequelize';
import { default as config } from './config.json' assert { type: 'json' };
import { CommandFile, CustomClient, ModalFile, ServerList } from './typings/Extensions.js';
import { IRFGameId, ResultType, interactionEmbed, toConsole } from './functions.js';
import { Ban, initModels } from './models/init-models.js';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const wait = promisify(setTimeout);
let ready = false;

//#region Setup
//#region Database
const sequelize = new Sequelize(config.mysql.database, config.mysql.user, config.mysql.password, {
  host: config.mysql.host,
  dialect: 'mysql',
  logging: process.env.environment === 'development' ? console.log : false,
  port: config.mysql.port
});
// Check for existing models folder
if (!fs.existsSync(join(dirname(fileURLToPath(import.meta.url)), 'models'))) console.warn('[SQL] No models detected');
// Load database models
const file = await import('./models/init-models.js');
try {
  file.initModels(sequelize);
  sequelize.authenticate();
  sequelize.sync({ alter: process.env.environment === 'development' });
} catch (e) {
  console.error(`[SQL] ${e}`);
}
ready = false; // Reset ready state
//#endregion
//#region Discord bot
const client: CustomClient = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.MessageContent
  ]
});
client.sequelize = sequelize;
client.models = initModels(sequelize);
client.commands = new Collection();
client.modals = new Collection();
//#endregion
//#endregion

//#region Events
client.on('ready', async () => {
  console.info('[READY] Client is ready');
  console.info(`[READY] Logged in as ${client.user!.tag} (${client.user!.id}) at ${new Date()}`);
  toConsole(
    `[READY] Logged in as ${client.user?.tag} (${client.user!.id}) at <t:${Math.floor(Date.now() / 1000)}:T> and **${
      ready ? 'can' : 'cannot'
    }** receive commands`,
    new Error().stack!,
    client
  );
  client.user!.setActivity('users of the IRF', { type: ActivityType.Listening });

  // Create directory if doesn't exist, then read all files
  if (!fs.existsSync('./commands')) return console.error('[CMD] No command file detected');
  const commands = fs.readdirSync('./commands').filter((file) => file.endsWith('.js'));
  const slashCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
  for (const file of commands) {
    try {
      // Load the command
      const command: CommandFile = await import(`./commands/${file}`);
      // Set command & push data
      client.commands!.set(command.name, command);
      slashCommands.push(command.data!.toJSON());
      console.info(`[CMD-LOAD] Loaded command ${command.name}`);
    } catch (err) {
      // Log error
      console.error(`[CMD-LOAD] Failed to load command ${file}: ${err}`);
    }
  }
  // Read all modal files
  const modals = fs.readdirSync('./modals').filter((file) => file.endsWith('.js'));
  console.info(`[CMD-LOAD] Loading modals, expecting ${modals.length} modals`);
  for (const file of modals) {
    try {
      // Load the modal
      const modal: ModalFile = await import(`./modals/${file}`);
      // Set modal & log
      client.modals!.set(modal.name, modal);
      console.info(`[CMD-LOAD] Loaded modal ${modal.name}`);
    } catch (err) {
      // Log error
      console.error(`[CMD-LOAD] Failed to load modal ${file}: ${err}`);
    }
  }
  try {
    client.application!.commands.set(slashCommands);
  } catch (err) {
    console.error(`[CMD-LOAD] Failed to load commands: ${err}`);
  }

  ready = true;

  setInterval(async () => {
    if (!ready) return;
    client.channels.cache.get(config.channels.ban) || (await client.channels.fetch(config.channels.ban));
    client.guilds.cache.get(config.discord.mainServer) || (await client.guilds.fetch(config.discord.mainServer));
    const parseBans: Ban[] = await client.models!.Ban.findAll({ where: { reason: { [Op.like]: '%___irf' } } });
    for (const ban of parseBans) {
      // Extract data from ban
      const reason: string[] = ban.reason.replace('___irf', '').split(' - Banned by ');
      const victim: { id: number; name: string; displayName: string } = await fetch(
        `https://users.roblox.com/v1/users/${ban.userID}`
      ).then((r) => r.json());
      // Add placeholder data
      let moderator: { id: number; name: string; displayName: string } = {
        id: 0,
        name: 'Unknown',
        displayName: 'Unknown'
      };
      if (reason[1].includes('FairPlay')) reason[1] = 'FairPlay_AntiCheat'; // Rewrite name
      // Fetch from Roblox
      moderator = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        body: JSON.stringify({ usernames: [reason[1]] }),
        headers: { 'Content-Type': 'application/json' }
      })
        .then((r: Response) => r.json())
        .then((r: { data: (typeof moderator)[] }) => r.data[0]);
      // Fetch Discord information
      let discord: GuildMember | { user: { username: string; id: string }; nickname: string } | undefined;
      if (moderator.id !== 0) {
        // Attempt #1: Query via Discord
        discord = (
          await client.guilds.cache.get(config.discord.mainServer)!.members.search({ query: moderator.name, limit: 1 })
        ).first();
        if (!discord) {
          // Attempt #2: Query via RoWifi
          const rowifiData = await fetch(
            `https://api.rowifi.xyz/v2/guilds/${config.discord.mainServer}/members/roblox/${moderator.id}`,
            {
              headers: { Authorization: `Bot ${config.bot.rowifiApiKey}` }
            }
          );
          if (rowifiData.ok) {
            const json = await rowifiData.json();
            discord = await client.guilds.cache.get(config.discord.mainServer)!.members.fetch(json[0].discord_id);
          }
        }
      }
      // Can't find them, use Roblox data
      if (!discord)
        discord = {
          user: {
            id: '0',
            username: moderator.name
          },
          nickname: moderator.displayName
        };

      const gameName = IRFGameId[ban.gameID] || ban.gameID;
      if (gameName === ban.gameID)
        toConsole(`[BAN] Failed to find game name for \`${ban.gameID}\``, new Error().stack!, client);
      // Check logging channel exists
      const banLog = client.channels.cache.get(config.channels.ban);
      if (!banLog || !banLog.isTextBased()) break;
      banLog.send({
        embeds: [
          {
            title: `${moderator.name} banned => ${victim.name} (In Game)`,
            description: `**${discord.user.id}** has added a ban for ${victim.name} (${victim.id}) on ${gameName}`,
            color: 0x00ff00,
            fields: [
              {
                name: 'Game',
                value: String(gameName),
                inline: true
              },
              {
                name: 'User',
                value: `${victim.name} (${victim.id})`,
                inline: true
              },
              {
                name: 'Reason',
                value: `${reason[0]} - Banned by <@${discord.user.id}> (${moderator.id})`,
                inline: true
              }
            ],
            timestamp: ban.createdAt.toString()
          }
        ]
      });
      // Post new ban data
      await ban.update({
        reason: `${reason[0]} - Banned by ${discord.user.id === '0' ? moderator.name : `<@${discord.user.id}>`} (${
          moderator.id
        })`
      });
    }
  }, 20000);
});

client.on('interactionCreate', async (interaction): Promise<void> => {
  if (!ready && interaction.isRepliable())
    return interaction
      .reply({ content: 'Please wait for the bot to finish loading', ephemeral: true })
      .then(() => void Promise); // Hacky method to return void promise

  if (interaction.type === InteractionType.ApplicationCommand) {
    let command = client.commands!.get(interaction.commandName);
    if (command) {
      // If the command is not a modal, defer reply and fetch user
      if (!command.modal) {
        await interaction.deferReply({ ephemeral: command.ephemeral });
        // Can't Promise.all(...), deferReply must be first
        await interaction.user.fetch();
      }
      const ack = command.run(client, interaction, interaction.options).catch((e) => {
        interaction.editReply({
          content: 'Something went wrong. Please contact an Engineer',
          embeds: []
        });
        return toConsole(e.stack, new Error().stack!, client);
      });

      // Wait for 10 seconds, if the command hasn't been executed, send a timeout message
      await wait(10_000);
      if (ack != null) return; // Already executed
      interaction.fetchReply().then((m) => {
        // If the message is empty and there are no embeds, it's a timeout
        if (m.content === '' && m.embeds.length === 0)
          interactionEmbed(3, 'The command timed out. Please contact an Engineer', interaction);
      });
    }
  }
  if (interaction.type === InteractionType.ModalSubmit) {
    let modal = client.modals!.get(interaction.customId);
    if (modal) {
      // Defer reply
      await interaction.deferReply({ ephemeral: true });
      // Run modal handler
      const ack = modal.run(client, interaction, interaction.fields).catch((e) => {
        interaction.editReply({
          content: 'Something went wrong. Please contact an Engineer',
          embeds: []
        });
        return toConsole(e.stack, new Error().stack!, client);
      });

      // Wait for 10 seconds, if the command hasn't been executed, send a timeout message
      await wait(10_000);
      if (ack != null) return; // Already executed
      interaction.fetchReply().then((m) => {
        // If the message is empty and there are no embeds, it's a timeout
        if (m.content === '' && m.embeds.length === 0)
          interactionEmbed(ResultType.Error, 'The modal timed out. Please contact an Engineer', interaction);
      });
    }
  }
  if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    switch (interaction.commandName) {
      case 'ban': {
        // If command is ban, offer a list of common reasons
        const value = interaction.options.getString('reason');
        const commonReasons = [
          // ROBLOX TOS //
          { name: 'TOS - Chat bypass', value: 'Roblox TOS - Bypassing chat filter' },
          { name: 'TOS - Clothes bypass', value: 'Roblox TOS - Bypassed clothing' },
          { name: 'TOS - Username bypass', value: 'Roblox TOS - Bypassed username' },
          { name: 'TOS - Nudity', value: 'Roblox TOS - Nudity' },
          { name: 'TOS - Exploit', value: 'Roblox TOS - Exploiting' },
          { name: 'TOS - Impersonation', value: 'Roblox TOS - Impersonation' },
          { name: 'TOS - Racism', value: 'Roblox TOS - Racism' },
          { name: 'TOS - Nazism', value: 'Roblox TOS - Nazism' },
          { name: 'TOS - NSFW', value: 'Roblox TOS - NSFW content or actions (PDA included)' },
          // TBAN //
          { name: 'TBan - Evasion', value: 'Temp Ban - Evasion of moderation action' },
          { name: 'TBan - Nudity', value: 'Temp Ban - Nudity' },
          { name: 'TBan - NSFW', value: 'Temp Ban - NSFW content or actions (PDA included)' },
          { name: 'TBan - Spamming', value: 'Temp Ban - Spamming' },
          { name: 'TBan - SS Insignia', value: 'Temp Ban - SS Insignia' },
          { name: 'TBan - Chat bypass', value: 'Temp Ban - Bypassing chat filter' },
          // GAME RULES //
          { name: 'Rules - Glitching', value: 'Game Rules - Glitching' },
          { name: 'Rules - RK', value: 'Game Rules - Mass random killing (RK)' },
          // RULES //
          { name: 'Rules - Ban Bypass (Alt)', value: 'Rules - Bypassing ban using alternative account' },
          { name: 'Rules - DDoS Attack', value: 'Rules - Attempting or causing a Distributed Denial of Service attack' }
        ];
        // If no value, return the list of common reasons
        if (!value) return interaction.respond(commonReasons);
        // If value, filter the list of common reasons
        const matches = commonReasons.filter((r) => r.value.toLowerCase().includes(value.toLowerCase()));
        // If no matches, return the value the user entered
        if (matches.length === 0 && value.length <= 100)
          return interaction.respond([{ name: value.length > 25 ? value.slice(0, 22) + '...' : value, value: value }]);
        if (value.length > 100) return; // Timeout, too long value
        return interaction.respond(matches);
      }
      case 'request': {
        // If command is request, offer a list of common reasons
        const value = interaction.options.getString('reason');
        const reasons = [
          // DIVISIONS //
          { name: 'GA - Random killing', value: 'User is mass random killing' },
          { name: 'MP - Military Law', value: 'User is violating Military Law' },
          { name: 'FSS - Bolshevik Law', value: 'User is violating Bolshevik Law' },
          { name: 'MoA - No admissions', value: 'There is no Admissions in the server' },
          { name: 'MoA - Gamepass Admissions abuse', value: 'Admissions is abusing their powers (Gamepass)' },
          // RAIDS //
          { name: 'Immigrant Raid', value: 'Immigrant(s) are raiding against Military personnel' },
          {
            name: 'Small Raid (1-7 raiders)',
            value: 'There is chaos at the border and we are struggling to maintain control (1-7 raiders)'
          },
          {
            name: 'Big Raid (8+ raiders)',
            value: 'There is chaos at the border and we are struggling to maintain control (8+ raiders)'
          },
          { name: 'Exploiter', value: 'A user is exploiting' },
          // AUTHORITY //
          { name: 'Higher authority needed (Kick)', value: 'Need someone to kick a user' },
          { name: 'Higher authority needed (Server Ban)', value: 'Need someone to server ban a user' },
          { name: 'Higher authority needed (Temp/Perm Ban)', value: 'Need someone to temp/perm ban a user' },
          // BACKUP //
          { name: 'General backup', value: 'Control has been lost, general backup is needed' },
          { name: 'DDoS Attack', value: 'There is a DDoS attack on the server' }
        ];
        // If no value, return the list of common reasons
        if (!value) return interaction.respond(reasons);
        // If value, filter the list of common reasons
        const matches = reasons.filter((r) => r.value.toLowerCase().includes(value.toLowerCase()));
        // If no matches, return the value the user entered
        if (matches.length === 0 && value.length <= 100)
          return interaction.respond([{ name: value.length > 25 ? value.slice(0, 22) + '...' : value, value: value }]);
        if (value.length > 100) return; // Timeout, too long value
        return interaction.respond(matches);
      }
      case 'shutdown': {
        // If the command is shutdown, offer the list of active servers
        let { name, value = 'Papers' } = interaction.options.getFocused(true);
        if (name !== 'target') return; // Not focused on the server list
        const servers: { success: boolean; servers: ServerList } = await fetch(config.urls.servers).then(
          (r: Response) => r.json()
        );
        const matches: { name: string; value: string }[] = [];
        const idMap = new Map();
        let matchedGame = 0;
        // Loop through game IDs and find the ID from the name
        for (const name of Object.keys(IRFGameId)) {
          // Push to map
          idMap.set(IRFGameId[name], name);
          // If we have a partial match, set matchedGame to the ID
          if (name.toLowerCase().includes(value.toLowerCase())) matchedGame = Number(IRFGameId[name]);
        }
        // Push all servers with the game ID in matchedGame to matches
        for (const [placeId, jobs] of Object.entries(servers.servers)) {
          if (Number(placeId) == matchedGame) {
            for (const [jobId, [players, _date]] of Object.entries(jobs)) {
              // RTT if we don't know the name
              matches.push({ name: `${jobId} - ${idMap.get(placeId) || 'RTT'} (${players.length})`, value: jobId });
            }
          }
        }
        matches.unshift({ name: 'All servers - DANGEROUS (*)', value: '*' });
        return interaction.respond(matches);
      }
      default: {
        return interaction.respond([]); // Invalid commandName
      }
    }
  }
});

client.on('messageCreate', async (message): Promise<void> => {
  if (message.guild!.id != config.discord.mainServer || message.channel.isDMBased()) return;
  if (message.author.bot) return;
  if (!message.channel.name.includes('reports')) return;
  // Message handler
  let refMessage: Message;
  // If the message is a reply and the content matches a key string, check the referenced message
  if (message.reference && message.content === 'CHECK_IA_VIOLATIONS') {
    // Set the message to delete after 5 seconds
    setTimeout(() => message.delete(), 5000);
    refMessage = await message.channel.messages.fetch(message.reference.messageId!);
    // If the refMessage is from a bot, ignore it
    if (refMessage.author.bot) return;
  } else {
    refMessage = message;
  }
  // Check attachments for direct files
  if (refMessage.attachments.size > 0) {
    for (const attachment of Object.values(refMessage.attachments)) {
      // Check for a non-embedding file
      if (!/png|jpg|jpeg|webm|mov|mp4/i.test(attachment[1].name.split('.').pop()!)) {
        refMessage.react('1095481555431997460');
        // If message was manually checked, indicate success
        if (message.content === 'CHECK_IA_VIOLATIONS') message.react('1095484268219732028');
        // Inform the user of the violation
        refMessage.reply({
          content:
            '<:denied:1095481555431997460> | Direct recordings are **not allowed** for security reasons. Upload your files to YouTube, Medal.TV, or Streamable.com and send the link instead.\n\n> *This was an automated action. If you think this was a mistake, DM <@409740404636909578> (Tavi#0001).*'
        });
        return;
      }
    }
  }
  // RK check
  if (!/(?:Mass (?:RK|(?:kill.*)))|(?:([^\w\d]RK)|Random(ly)?(?: )?kill.*)/i.test(refMessage.content))
    if (message.content === 'CHECK_IA_VIOLATIONS') {
      // If message was manually checked, indicate success
      message.react('1095481555431997460');
      return;
    } else return;
  // React with denial emoji
  refMessage.react('1095481555431997460');
  if (message.content === 'CHECK_IA_VIOLATIONS') message.react('1095484268219732028'); // Successful RK detection
  // Inform the user
  refMessage.reply({
    content:
      '<:denied:1095481555431997460> | Random killing reports are **not allowed**. Read the pinned messages and request Game Administrators for help if you find a random killer.\n\n> *This was an automated action. If you think this was a mistake, DM <@409740404636909578> (Tavi#0001).*'
  });
  return;
});
//#endregion

client.login(config.bot.token);

//#region Error handling
const recentErrors: { promise: Promise<unknown>; reason: string; time: Date }[] = [];
process.on('uncaughtException', (err, origin) => {
  fs.writeSync(process.stderr.fd, `Caught exception: ${err}\n` + `Exception origin: ${origin}`);
});
process.on('unhandledRejection', async (reason, promise) => {
  if (!ready) {
    console.warn('Exiting due to a [unhandledRejection] during start up');
    console.error(reason, promise);
    return process.exit(15);
  }
  // Anti-spam System
  if (recentErrors.length > 2) {
    recentErrors.push({ promise, reason: String(reason), time: new Date() });
    recentErrors.shift();
  } else {
    recentErrors.push({ promise, reason: String(reason), time: new Date() });
  }
  // If all three errors are the same, exit
  if (
    recentErrors.length === 3 &&
    recentErrors[0].reason === recentErrors[1].reason &&
    recentErrors[1].reason === recentErrors[2].reason
  ) {
    // Write the error to a file
    fs.writeFileSync(
      './latest-error.log',
      JSON.stringify(
        {
          code: 15,
          info: {
            source: 'Anti spam triggered! Three errors with the same content have occurred recently',
            r: String(promise) + ' <------------> ' + reason
          },
          time: new Date().toString()
        },
        null,
        2
      )
    );
    return process.exit(17);
  }
});
process.on('warning', async (warning) => {
  if (!ready) {
    console.warn('[warning] has occurred during start up');
    console.warn(warning);
  }
  toConsole(`A [warning] has occurred.\n\n> ${warning}`, new Error().stack!, client);
});
process.on('exit', (code) => {
  console.error('[EXIT] The process is exiting!');
  console.error(`[EXIT] Code: ${code}`);
});
//#endregion
