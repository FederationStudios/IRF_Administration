import { ChatInputCommandInteraction, GuildMember, TextChannel } from 'discord.js';
import { default as config } from '../config.json' with { type: 'json' };
import { bans } from '../models/bans.js';
import { CustomClient } from '../typings/Extensions.js';
import { IRFGameId, RobloxUserData } from '../functions.js';
const { channels, discord } = config;

export async function execute(
  client: CustomClient,
  ban: bans,
  target: RobloxUserData,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const [gameName, gameId] = [
    IRFGameId[interaction.options.getNumber('game_id', true)],
    interaction.options.getNumber('game_id', true)
  ];

  // Extract data
  const banLogs = (await client.channels.fetch(channels.ban)) as TextChannel;
  const { reason, data } = ban;
  // Set the proof to the default proof URL if it is empty
  if (data.proof === '' || typeof data.proof === 'undefined') data.proof = discord.defaultProofURL;
  // Get the evidence used
  const evidence = await client.channels
    .fetch(data.proof.split('/')[5])
    .then((c) => (c as TextChannel).messages.fetch(data.proof.split('/')[6]))
    .catch(() => null);
  if (!evidence) throw new Error('Failed to fetch evidence');
  // Send ban log
  const embed = {
    title: `${(interaction.member as GuildMember).nickname || interaction.user.username} banned => ${target.name}`,
    description: `**${interaction.user.id}** has added a ban for ${target.name} (${target.id}) on ${gameName} (${gameId})`,
    color: 0x00ff00,
    fields: [
      {
        name: 'Game',
        value: `${gameName} (${gameId})`,
        inline: true
      },
      {
        name: 'User',
        value: `${target.name} (${target.id})`,
        inline: true
      },
      {
        name: 'Reason',
        value: String(reason),
        inline: true
      }
    ]
  };
  banLogs.send({ embeds: [embed] });
  interaction.editReply({ content: 'Ban logged', embeds: [embed] });
  return;
}
