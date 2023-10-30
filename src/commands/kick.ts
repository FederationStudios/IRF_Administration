import { ChatInputCommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } from 'discord.js';
import { default as config } from '../config.json' assert { type: 'json' };
import { getGroup, getRowifi, interactionEmbed, toConsole } from '../functions.js';
import { CustomClient, ServerList } from '../typings/Extensions.js';
const { roblox, urls } = config;

export const name = 'kick';
export const ephemeral = false;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Kicks a player from a server')
  .setDMPermission(false)
  .addStringOption((option) => {
    return option.setName('target').setDescription('The user you wish to kick (Roblox ID)').setRequired(true);
  })
  .addStringOption((option) => {
    return option.setName('reason').setDescription('Reason for kicking the player').setRequired(true);
  });
export async function run(
  client: CustomClient,
  interaction: ChatInputCommandInteraction,
  options: CommandInteractionOptionResolver
): Promise<void> {
  const rowifi = await getRowifi(interaction.user.id, client);
  if (rowifi.success === false) {
    interactionEmbed(3, rowifi.error, interaction);
    return;
  }
  const robloxData = await getGroup(rowifi.username, 4899462);
  if (robloxData.success === false) return interactionEmbed(3, robloxData.error, interaction);
  if (robloxData.data.role.rank <= 200)
    return interactionEmbed(3, 'You do not have permission to use this command (Engineer+)', interaction);
  const servers: { success: boolean; servers: ServerList } = await fetch(urls.servers).then((r: Response) => r.json());
  if (!servers.success)
    return interactionEmbed(
      3,
      'The remote access system is having issues. Please try again later (Status code: 503)',
      interaction
    );
  let target = Number(options.getString('target', true));
  if (isNaN(target)) return interactionEmbed(3, 'Invalid target (Must be a user ID)', interaction);
  const reason = options.getString('reason');
  // For each server in each game, check if the target is in the server
  let playerFound = false;
  for (const gameId in servers.servers) {
    for (const server in servers.servers[gameId]) {
      // Convert the players array to an array if it isn't already
      const players = servers.servers[gameId][server][0];
      // Check if the target is in the server
      if (players.findIndex((p) => p === target) === -1) continue;
      // Get the universe ID of the game
      const universeId = await fetch(`https://apis.roblox.com/universes/v1/places/${gameId}/universe`)
        .then((r) => r.json())
        .then((r) => r.universeId);
      // Send the kick request
      const req = await fetch(
        `https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/remoteAdminCommands`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': roblox.mainOCtoken
          },
          // JSON.stringify doesn't work with Roblox OpenCloud so using manual escaping
          body: `{"message": '{"type": "kick", "target": "${server}", "userId": "${target}", "reason": "${reason}"}'}`,
          method: 'POST'
        }
      );
      // Mark the player as found
      playerFound = true;
      // Check if the request was successful
      if (!req.ok)
        return interactionEmbed(
          3,
          'The remote access system is having issues. Please try again later (Status code: 400)',
          interaction
        );
    }
  }
  // Send the response body to the user
  if (!playerFound) return interactionEmbed(3, 'Invalid target (User is not in any servers)', interaction);
  await interactionEmbed(1, `Kicked ${target} from the server`, interaction);
  toConsole(
    `[REMOTE ADMIN] ${interaction.user.username} (${interaction.user.id}) kicked ${target} from the server they were in`,
    new Error().stack!,
    client
  );
  interaction.followUp({
    files: [
      {
        attachment: Buffer.from(JSON.stringify(servers, null, 2)),
        name: 'servers.json',
        description: 'List of IRF servers (DEBUGGING PURPOSES IF THIS COMMAND BACKFIRES)'
      }
    ],
    ephemeral: true
  });
  return;
}
