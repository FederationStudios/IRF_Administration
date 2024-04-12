import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  Interaction,
  InteractionEditReplyOptions,
  InteractionType
} from 'discord.js';
import { default as config } from './config.json' assert { type: 'json' };
import { CustomClient } from './typings/Extensions.js';

//#region Enums
enum IRFGameId {
  'Global' = 0,
  'Papers, Please!' = 583507031,
  'Sevastopol Military Academy' = 603943201,
  'Triumphal Arch of Moscow' = 2506054725,
  'Tank Training Grounds' = 2451182763,
  'Ryazan Airbase' = 4424975098,
  'Prada Offensive' = 4683162920
}
enum ResultMessage {
  DatabaseError = 'An error has occurred while communicating with the database',
  Cooldown = 'You are on cooldown!',
  UserPermission = 'You do not have the proper permissions to execute this command',
  BotPermission = 'This bot does not have proper permissions to execute this command',
  BadArgument = 'You have not supplied the correct parameters. Please check again',
  Unknown = 'An unknwon error occurred. Please report this to a developer',
  NotFound = "The requested information wasn't found",
  NoDM = "This command isn't available in Direct Messages. Please run this in a server",
  NonexistentCommand = 'The requested slash command was not found. Please refresh your Discord client and try again',
  Development = 'This command is in development. This should not be expected to work'
}
enum ResultType {
  Success,
  Warning,
  Error,
  Information
}
//#endregion
//#region Types
export type RobloxGroupUserData = {
  group: RobloxGroupGroupData;
  role: RobloxGroupRoleData;
};
/**
 * @prop {string} id Group ID
 * @prop {string} name Name of the group
 * @prop {number} memberCount Member count of the group
 */
export type RobloxGroupGroupData = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  owner: {
    username: string;
    displayName: string;
    userId: number;
  };
};
/**
 * @prop {number} id Numeric identifier of the role
 * @prop {string} name Name of the role
 * @prop {number} rank Rank of the role (0-255)
 */
export type RobloxGroupRoleData = {
  id: number;
  name: string;
  rank: number;
};
/**
 * @prop {string} requestedUsername Username that was requested
 * @prop {boolean} hasVerifiedBadge Whether or not the user has a verified badge
 * @prop {number} id User ID
 * @prop {string} name Username of the user
 * @prop {string} displayName Display name of the user
 */
export type RobloxUserData = {
  requestedUsername: string;
  hasVerifiedBadge: boolean;
  id: number;
  isOnline: boolean;
  name: string;
  displayName: string;
  description: string;
  created: string;
  createdAt: string;
};
//#endregion

//#region Functions
/**
 * @async
 * @description Sends a message to the console
 * @example toConsole(`Hello, World!`, new Error().stack, client);
 */
async function toConsole(message: string, source: string, client: CustomClient): Promise<void> {
  const channel = await client.channels.fetch(config.discord.logChannel).catch(() => null);
  if (source.split('\n').length < 2)
    return console.error('[ERR] toConsole called but Error.stack was not used\n> Source: ' + source);
  source = /(?:[A-Za-z0-9._]+:[0-9]+:[0-9]+)/.exec(source)![0];
  if (!channel || !channel.isTextBased())
    return console.warn('[WARN] toConsole called but bot cannot find logging channel\n', message, '\n', source);

  await channel.send(`Incoming message from \`${source}\` at <t:${Math.floor(Date.now() / 1000)}:F>`);
  const check = await channel
    .send({
      embeds: [
        new EmbedBuilder({
          title: 'Message to Console',
          color: 0xde2821,
          description: `${message}`,
          timestamp: new Date()
        })
      ]
    })
    .then(() => false)
    .catch(() => true); // Supress errors
  if (check) return console.error(`[ERR] At ${new Date().toString()}, toConsole called but message failed to send`);

  return;
}

/**
 * @async
 * @description Replies with a Embed to the Interaction
 * @example interactionEmbed(1, "", `Removed ${removed} roles`, interaction)
 * @example interactionEmbed(3, `[ERR-UPRM]`, `Missing: \`Manage Messages\``, interaction)
 * @returns {Promise<void>}
 */
async function interactionEmbed(
  type: ResultType,
  content: ResultMessage | string,
  interaction: Exclude<Interaction, { type: InteractionType.ApplicationCommandAutocomplete }>
): Promise<void> {
  if (!interaction.deferred) await interaction.deferReply();
  const embed = new EmbedBuilder()
    .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL({ size: 4096 })! })
    .setDescription(content)
    .setTimestamp();

  switch (type) {
    case ResultType.Success:
      embed.setTitle('Success').setColor(0x7289da);

      break;
    case ResultType.Warning:
      embed.setTitle('Warning').setColor(0xffa500);

      break;
    case ResultType.Error:
      embed.setTitle('Error').setColor(0xff0000);

      break;
    case ResultType.Information:
      embed.setTitle('Information').setColor(0x7289da);

      break;
  }
  // Utilise invisible character to remove message content
  await interaction.editReply({ content: '​', embeds: [embed] });
  return;
}

function parseTime(time: string): number {
  let duration = 0;
  if (!time.match(/[1-9]{1,3}[dhms]/g)) return NaN;

  for (const period of time.match(/[1-9]{1,3}[dhms]/g)!) {
    const [amount, unit] = period.match(/^(\d+)([dhms])$/)!.slice(1);
    duration +=
      unit === 'd'
        ? Number(amount) * 24 * 60 * 60
        : unit === 'h'
          ? Number(amount) * 60 * 60
          : unit === 'm'
            ? Number(amount) * 60
            : Number(amount);
  }

  return duration;
}

/**
 * @async
 */
async function getGroup(
  username: string | number,
  groupId: number
): Promise<{ success: false; error: string } | { success: true; data: RobloxGroupUserData }> {
  const roblox = await getRoblox(username);
  if (roblox.success === false) return { success: false, error: roblox.error };
  username = roblox.user.id; // Set username to the ID of the user
  // Fetch the group data from Roblox API
  const group = await fetch(`https://groups.roblox.com/v2/users/${username}/groups/roles`)
    .then((r: Response) => r.json())
    .catch(() => ({ errorMessage: 'Failed to fetch group data' }));
  // If the group is not found, return an error
  if (group.errorMessage) return { success: false, error: `No group found with ID \`${groupId}\`` };
  // Find the group specified
  const role = group.data.find((g) => g.group.id === groupId);
  // If the user is not in the group, return an error
  if (!role) return { success: false, error: 'User is not in the group specified' };
  // Return the role
  return { success: true, data: role };
}

/**
 * @async
 */
async function getRowifi(
  user: string,
  client: CustomClient
): Promise<{ success: true; roblox: number; username: string } | { success: false; error: string }> {
  const discord = await client.users.fetch(user).catch(() => false);
  if (typeof discord === 'boolean') return { success: false, error: 'Invalid Discord user ID' };
  // Check if user is in the Commissariat group
  const commGroup = await getGroup(discord.username, config.roblox.commissariatGroup);
  if (commGroup.success === true) {
    // Fetch their roblox ID
    return (
      fetch(`https://users.roblox.com/v1/usernames/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [discord.username] })
      })
        .then((r: Response) => r.json())
        // Typings are slightly incorrect, but the property we want is there
        .then((r: { data: { id: number }[] }) => r.data[0])
        .then((r: { id: number }) => {
          // Return their roblox ID and username
          return { success: true, roblox: r.id, username: discord.username } as {
            // v TS interprets "true" as a boolean for some odd reason!
            success: true;
            roblox: number;
            username: string;
          };
        })
        .catch(() => ({ success: false, error: 'Failed to fetch Roblox ID' }))
    );
  }
  // Fetch their Roblox ID from Rowifi
  const userData = await fetch(`https://api.rowifi.xyz/v2/guilds/${config.discord.mainServer}/members/${user}`, {
    headers: { Authorization: `Bot ${config.bot.rowifiApiKey}` }
  })
    .then((r: Response) => {
      // If response is not OK, return the error
      if (!r.ok) return { success: false, error: `Rowifi returned status code \`${r.status}\`` };
      // Return the JSON
      return r.json();
    })
    .catch(() => ({ success: false, error: 'Failed to fetch Rowifi data' }));
  // If success is present, return an error
  if (userData.success !== undefined)
    return {
      success: false,
      error: 'Rowifi failed to return any data! Please check you are signed in with Rowifi'
    };

  // Fetch their Roblox username from the Roblox API
  const roblox = await fetch(`https://users.roblox.com/v1/users/${userData.roblox_id}`)
    .then((r: Response) => r.json())
    .catch(() => ({ errors: [{ message: 'Failed to fetch Roblox data' }] }));

  // If the Roblox API returns an error, return the error
  if (roblox.errors) return { success: false, error: `\`${roblox.errors[0].message}\`` };
  // Return their roblox ID and username
  return { success: true, roblox: userData.roblox_id, username: roblox.name };
}

/**
 * @async
 * @example getRoblox(1) => { success: true, id: 1, username: 'Roblox' }
 * @example getRoblox('Roblox') => { success: true, id: 1, username: 'Roblox' }
 * @returns {Promise<{success: false; error: string}|{success: true; user: {requestedUsername: string; hasVerifiedBadge: boolean; id: number; name: string; displayName: string;}}>}
 */
async function getRoblox(
  input: string | number
): Promise<{ success: false; error: string } | { success: true; user: RobloxUserData }> {
  if (!Number.isNaN(Number(input))) {
    // If input is a number, fetch the user from Roblox API
    const user = await fetch(`https://users.roblox.com/v1/users/${input}`)
      .then((r: Response) => r.json())
      .catch(() => ({ errors: ['Failed to fetch'] }));

    // If the user is not found, return an error
    if (user.errors && user.errors[0] && user.errors[0].message && user.errors[0].message === "Too many requests")
      return { success: false, error: 'Roblox is ratelimiting us. Please try again later, or visit the user\'s profile yourself' };
    if (user.errors) return { success: false, error: `Interpreted ${input} as user ID but found no user` };
    // Return the user
    return { success: true, user };
  } else {
    const user = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [input] })
    })
      .then((r: Response) => r.json())
      .then((r: { data: RobloxUserData[] }) => r.data[0])
      .catch(() => null);

    // If the user is not found, return an error
    if (user.errors && user.errors[0] && user.errors[0].message && user.errors[0].message === "Too many requests")
      return { success: false, error: 'Roblox is ratelimiting us. Please try again later, or visit the user\'s profile yourself' };
    if (!user) return { success: false, error: `Interpreted ${input} as username but found no user` };
    // Return the user
    return { success: true, user };
  }
}

function getEnumKey(enumObj: object, value: number): string | undefined {
  for (const key in enumObj) {
    if (Object.prototype.hasOwnProperty.call(enumObj, key) && enumObj[key] === (value as number)) {
      return key;
    }
  }
  return undefined;
}

async function paginationRow(
  interaction: Exclude<Interaction, { type: InteractionType.ApplicationCommandAutocomplete }>,
  buttonRows: ButtonBuilder[][],
  args: InteractionEditReplyOptions,
  embeds?: EmbedBuilder[]
): Promise<ButtonInteraction> {
  // Create the row
  const paginationRow: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder({
    components: [
      new ButtonBuilder({ customId: 'prev', style: ButtonStyle.Primary, emoji: '⬅️' }),
      new ButtonBuilder({ customId: 'cancel', style: ButtonStyle.Danger, emoji: '🟥' }),
      new ButtonBuilder({ customId: 'next', style: ButtonStyle.Primary, emoji: '➡️' })
    ]
  });
  // Pair the embed with the buttons
  const rows: [ActionRowBuilder<ButtonBuilder>, EmbedBuilder?][] = buttonRows.map((r, i) => {
    // Create the row
    const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder({ components: r });
    // If no embeds exist, just return the row
    if (!embeds) return [row];
    // Else, return the row and the embed
    else return [row, embeds[i]];
  });
  // Configure message
  if (rows.length === 0 || (embeds && embeds.length !== rows.length)) return Promise.reject('No rows were provided');
  let index = 0,
    returnedInteraction;
  if (embeds && embeds.length > 0) args.embeds = [rows[index][1]];
  while (typeof returnedInteraction === 'undefined') {
    // Create message
    const coll = await interaction
      // Edit the reply
      .editReply({
        content: args.content || 'Please select an option below',
        embeds: args.embeds || undefined,
        components: [rows[index][0], paginationRow]
      })
      // Add listener
      .then((m) =>
        m.awaitMessageComponent({
          time: 15_000,
          filter: (i) => i.user.id === interaction.user.id,
          componentType: ComponentType.Button
        })
      )
      // Handle no response
      .catch((e) => e);
    // Check the custom id
    if (coll instanceof Error && coll.name === 'Error [InteractionCollectorError]') {
      returnedInteraction = null; // Timeout
      break;
    } else if (coll instanceof Error) {
      throw coll; // Not an error we can handle
    }
    // Drop the update
    await coll.update({});
    // If it's anything other than
    // next or prev, return it
    if (!/next|prev/.test(coll.customId)) {
      // Return the interaction
      returnedInteraction = coll;
      break;
    }
    // Configure index
    if (coll.customId === 'next') {
      if (index === rows.length - 1) index = 0;
      else index++;
    } else {
      if (index === 0) index = rows.length - 1;
      else index--;
    }
    // Configure message
    if (embeds && embeds.length > 0) args.embeds = [rows[index][1]];
    else args.embeds = [];
    args.components = [rows[index][0], paginationRow];
    // And the loop continues...
  }
  // Remove embeds and components
  await interaction.editReply({ content: args.content || 'Please select an option below', embeds: [], components: [] });
  return Promise.resolve(returnedInteraction);
}
//#endregion

export {
  IRFGameId,
  ResultMessage,
  ResultType,
  getEnumKey,
  getGroup,
  getRoblox,
  getRowifi,
  interactionEmbed,
  paginationRow,
  parseTime,
  toConsole
};
