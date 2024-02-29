import { Client, Collection, IntentsBitField, InteractionType, Message } from 'discord.js';
import * as fs from 'node:fs';
import { promisify } from 'node:util';
import { Sequelize } from 'sequelize';
import { default as config } from './config.json' assert { type: 'json' };
import { IRFGameId, interactionEmbed, toConsole } from './functions.js';
import { handleBans, default as readyHandler } from './functions/ready.js';
import { initModels } from './models/init-models.js';
import { CustomClient, ServerList } from './typings/Extensions.js';
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
if (!fs.existsSync('./models')) {
  console.warn('No models are present! Models will not be loaded');
} else {
  // Load database models
  const file = await import('./models/init-models.js');
  try {
    file.initModels(sequelize);
    sequelize.authenticate();
    sequelize.sync({ alter: process.env.environment === 'development' });
  } catch (e) {
    console.error(`[SQL] ${e}`);
  }
}
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
//#endregion
//#endregion

//#region Events
client.on('ready', async () => {
  ready = await readyHandler(client, ready).catch((e) => {
    console.error(e);
    return false;
  });
  // Call on startup
  if (ready) handleBans(client);
  // Setup interval
  setInterval(() => {
    if (!ready) return;
    handleBans(client);
  }, 20_000);
});

client.on('interactionCreate', async (interaction): Promise<void> => {
  if (!ready && interaction.isRepliable())
    return interaction
      .reply({ content: 'Please wait for the bot to finish loading', ephemeral: true })
      .then(() => void Promise); // Hacky method to return void promise

  if (interaction.type === InteractionType.ApplicationCommand) {
    const command = client.commands!.get(interaction.commandName);
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
        return toConsole(e.stack || e, new Error().stack!, client);
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
  } else if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
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
        const { name, value = 'Papers' } = interaction.options.getFocused(true);
        if (name !== 'target') return; // Not focused on the server list
        const servers: { success: boolean; servers: ServerList } = await fetch(config.urls.servers).then(
          (r: Response) => r.json()
        );
        if (!servers.success) return interaction.respond([]);
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
            for (const [jobId, [players]] of Object.entries(jobs)) {
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
  const denied = '<:denied:1095481555431997460>';
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
  // Test the message against the regex
  if (refMessage.content.startsWith('<:')) return; // Ignore GA accept/denial messages
  const msgContentRegex =
    // eslint-disable-next-line no-useless-escape
    /^Suspect: (?<username>[\w\-]+)\nSuspect Roblox ID: (?<id>[\d]+)\nReason: (?<reason>[ -~]+)(?:\nProof:\n(?<proof>[\S\n]*))?/;
  const result = msgContentRegex.exec(refMessage.content);
  async function deny(msg) {
    await refMessage.reactions.removeAll();
    refMessage.react(denied);
    refMessage.reply({ embeds: [{ color: 0xff0000, description: `${denied} | **Denied**. ${msg}` }] });
  }
  if (!result || !result.groups) {
    await deny('Your report does not follow the format. Please check the pinned messages for the correct format');
    return;
  }
  const matches = result.groups;
  // Check if proof is present
  if (!matches.proof && refMessage.attachments.size === 0) {
    await deny(
      'Your report does not contain proof. In order to properly process bans, we must have clear evidence of the crime'
    );
    return;
  }
  // Test links
  const links = matches.proof ? matches.proof.split('\n') : [];
  if (
    !links.every((l) =>
      // eslint-disable-next-line no-useless-escape
      /^https:\/\/(?:medal\.tv\/games\/roblox\/clips\/[\w]+\/[\w]+|youtube\.com\/watch\?v=[\w\-]+|youtu\.be\/[\w\-]+|gyazo\.com\/[\w]+|cdn\.discordapp\.com\/attachments\/[\d]{17,20}\/[\d]{17,20}\/[\w\-]+\.[a-z4]+)(?:\?[\w=]+)?/.test(
        l
      )
    )
  ) {
    await deny('Your proof does not contain valid links. Please check the pinned messages for the valid sources');
    return;
  }
  // Add reactions
  refMessage.react('⚙️');
  return;
});
//#endregion

client.login(config.bot.token);

//#region Error handling
const recentErrors: { promise: Promise<unknown>; reason: string; time: Date }[] = [];
process.on('uncaughtException', (err, origin) => {
  toConsole(`Uncaught exception: ${err}\n` + `Exception origin: ${origin}`, new Error().stack, client);
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

  toConsole('An [unhandledRejection] has occurred.\n\n> ' + reason, new Error().stack!, client);
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
