import { ChatInputCommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder } from 'discord.js';
import { default as config } from '../config.json' with { type: 'json' };
import { IRFGameId, getGroup, getRowifi, interactionEmbed, toConsole } from '../functions.js';
import { CustomClient, ServerList } from '../typings/Extensions.js';
const { roblox, urls } = config;

export const name = 'shutdown';
export const ephemeral = true;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Shuts down a server')
  .setDMPermission(false)
  .addStringOption((option) => {
    return option
      .setName('target')
      .setDescription("Target server's JobId to shut down")
      .setRequired(true)
      .setAutocomplete(true);
  })
  .addStringOption((option) => {
    return option.setName('reason').setDescription('Reason for shutting down').setRequired(true);
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
  // Check Federation Studios rank
  const robloxData = await getGroup(rowifi.username, 4899462);
  if (robloxData.success === false) {
    interactionEmbed(3, robloxData.error, interaction);
    return;
  }
  if (robloxData.data.role.rank < 200) {
    interactionEmbed(3, 'You do not have permission to use this command (Engineer+)', interaction);
    return;
  }
  // Fetch servers
  const servers: { success: boolean; servers: ServerList } = await fetch(urls.servers)
    .then((r: Response) => r.json())
    .catch(() => ({ success: false }));
  if (!servers.success) {
    interactionEmbed(
      3,
      'The remote access system is having issues. Please try again later (Status code: 503)',
      interaction
    );
    return;
  }
  const target = options.getString('target');
  const reason = options.getString('reason');
  // If target does not equal *, find the gameId which matches the target
  let server = false;
  // Set up request options
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': roblox.mainOCtoken
    },
    body: `{"message": '{"type": "shutdown", "target": "${target}", "reason": "${reason}"}'}`,
    method: 'POST'
  };
  // Loop through servers
  for (const [PlaceId, game] of Object.entries(servers.servers)) {
    if (target === '*') break; // Not handled here, but later on
    for (const [JobId] of Object.entries(game)) {
      // If JobId matches
      if (JobId === target) {
        // Fetch universeId
        const universeId = await fetch(`https://apis.roblox.com/universes/v1/places/${PlaceId}/universe`)
          .then((r) => r.json())
          .then((r) => r.universeId)
          .catch(() => 0);
        // Send primary request to shutdown server
        const resp = await fetch(
          `https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/remoteAdminCommands`,
          params
        );
        if (!resp.ok) {
          // Try using secondary OpenCloud token
          params.headers['x-api-key'] = roblox.altOCtoken;
          // Send secondary request to shutdown server
          const att2 = await fetch(
            `https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/remoteAdminCommands`,
            params
          );
          // If secondary request fails, return error
          if (!att2.ok) {
            interactionEmbed(
              3,
              'The remote access system is having issues. Please try again later (Status code: 400)',
              interaction
            );
            return;
          }
        }
        // Set server to true
        server = true;
        // Break out of loop
        break;
      }
    }
  }
  // If server is false and target is not *, return error
  if (!server && target !== '*') {
    interactionEmbed(
      3,
      'The server you are trying to shut down does not exist. Try using the autocomplete menu',
      interaction
    );
    return;
  }
  // If target is *, shut down all servers
  if (target === '*') {
    for (const id of Object.values(IRFGameId)) {
      // ID 0 is Global
      if (id === 0) continue;
      // Fetch universeId
      const universeId = await fetch(`https://apis.roblox.com/universes/v1/places/${id}/universe`)
        .then((r) => r.json())
        .then((r) => r.universeId)
        .catch(() => 0);
      // Restore primary OpenCloud token
      params.headers['x-api-key'] = roblox.mainOCtoken;
      // Send primary request to shutdown server
      const resp = await fetch(
        `https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/remoteAdminCommands`,
        params
      );
      if (!resp.ok) {
        // Try using secondary OpenCloud token
        params.headers['x-api-key'] = roblox.altOCtoken;
        // Send secondary request to shutdown server
        await fetch(
          `https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/remoteAdminCommands`,
          params
        );
      }
    }
  }
  toConsole(
    `[REMOTE ADMIN] ${interaction.user.username} (${interaction.user.id}) shut down server ${target}`,
    new Error().stack!,
    client
  );
  interactionEmbed(1, `Executed shutdown on server ${target} successfully`, interaction);
  return;
}
