import { ActivityType, GuildMember, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import fs from 'node:fs';
import { Op } from 'sequelize';
import { default as config } from '../config.json' assert { type: 'json' };
import { IRFGameId, toConsole } from '../functions.js';
import { bans } from '../models/bans.js';
import { CommandFile, CustomClient } from '../typings/Extensions.js';

export default async function (client: CustomClient, ready: boolean): Promise<boolean> {
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
  if (!fs.existsSync('./commands')) {
    console.error('[CMD] No command file detected');
    return Promise.reject();
  }
  const commands = fs.readdirSync('./commands').filter((file) => file.endsWith('.js'));
  const slashCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
  for (const file of commands) {
    try {
      // Load the command
      const command: CommandFile = await import(`../commands/${file}`);
      // Set command & push data
      client.commands!.set(command.name, command);
      slashCommands.push(command.data!.toJSON());
      console.info(`[CMD-LOAD] Loaded command ${command.name}`);
    } catch (err) {
      // Log error
      console.error(`[CMD-LOAD] Failed to load command ${file}: ${err}`);
    }
  }
  try {
    client.application!.commands.set(slashCommands);
  } catch (err) {
    console.error(`[CMD-LOAD] Failed to load commands: ${err}`);
  }
  return true;
}

export async function handleBans(client: CustomClient): Promise<void> {
  client.channels.cache.get(config.channels.ban) || (await client.channels.fetch(config.channels.ban));
  client.guilds.cache.get(config.discord.mainServer) || (await client.guilds.fetch(config.discord.mainServer));
  const parseBans: bans[] = await bans.findAll({ where: { reason: { [Op.endsWith]: '~~~irf' } } });
  for (const ban of parseBans) {
    // Extract data from ban
    let rblxId: string = String(ban.mod.roblox);
    // Fetch the victim's data from Roblox
    const victim: { id: number; name: string; displayName: string } = await fetch(
      `https://users.roblox.com/v1/users/${ban.user}`
    )
      .then((r) => r.json())
      .catch(() => {});
    // Add moderator placeholder data
    let moderator: { id: number; name: string; displayName: string } = {
      id: 0,
      name: 'Unknown',
      displayName: 'Unknown'
    };
    // Rewrite if FairPlay
    if (ban.mod.discord === 'FairPlay Anti-Cheat') rblxId = '4610463663';
    // Fetch from Roblox
    moderator = await fetch(`https://users.roblox.com/v1/users/${rblxId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
      .then((r: Response) => r.json())
      .then((r: typeof moderator) => {
        // If Roblox returns an error, return the placeholder
        if (!r.id) return moderator;
        // Else return the data fetched
        else return r;
      });
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
        // We found the user!
        if (rowifiData.ok) {
          const json = await rowifiData.json();
          discord = await client.guilds.cache.get(config.discord.mainServer)!.members.fetch(json[0].discord_id);
        }
      }
    }
    // Can't find them, skip and log for later
    if (!discord) {
      console.log(`[BAN] Failed to find Discord user. Dumping data at ${new Date().toLocaleTimeString()}:`);
      console.log(`[BAN] M: ${moderator.name}/${moderator.id} V: ${victim.name}/${victim.id}`);
      console.log(`[BAN] Database data: ID/${ban.banId} VIC/${ban.user} MOD/${ban.mod}`);
      continue;
    }

    // Get the game name
    const gameName = IRFGameId[ban.game] || ban.game;
    if (gameName === ban.game)
      toConsole(`[BAN] Failed to find game name for \`${ban.game}\``, new Error().stack!, client);
    // Check logging channel exists
    const banLog = client.channels.cache.get(config.channels.ban);
    if (!banLog || !banLog.isTextBased()) break;
    // Update moderator and reason data
    await ban.update({
      mod: {
        discord: discord.user.id,
        roblox: moderator.id
      },
      reason: ban.reason.replace('~~~irf', '')
    });
    // Send embed
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
              value: ban.reason.replace('~~~irf', ''),
              inline: true
            }
          ],
          timestamp: ban.createdAt.toISOString()
        }
      ]
    });
  }
}
