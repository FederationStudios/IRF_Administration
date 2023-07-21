import { EmbedBuilder, ModalSubmitFields, ModalSubmitInteraction } from 'discord.js';
import { default as config } from '../config.json' assert { type: 'json' };
const { channels } = config;
import { ResultMessage, getRowifi, interactionEmbed } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';

export const name = 'report';
export async function run(
  client: CustomClient,
  interaction: ModalSubmitInteraction,
  fields: ModalSubmitFields
): Promise<void> {
  // Filing
  const rowifi = await getRowifi(interaction.user.id, client);
  const embed = new EmbedBuilder({
    title: 'MP Report',
    color: 0x400080,
    fields: [
      {
        name: 'Reporter Username',
        value: fields.getTextInputValue('reporter_roblox'),
        inline: false
      },
      {
        name: 'Reporter ID',
        value: interaction.user.id,
        inline: false
      },
      {
        name: 'RoWifi Link',
        value: rowifi.success === false ? `\`❌\` No, ${rowifi.error}` : `\`✅\` Yes, ${rowifi.roblox}`,
        inline: false
      },
      {
        name: 'Offender',
        value: fields.getTextInputValue('offender_roblox'),
        inline: false
      },
      {
        name: 'Place & Time of Incident',
        value: fields.getTextInputValue('incident_place'),
        inline: false
      },
      {
        name: 'Description of Incident',
        value: fields.getTextInputValue('incident_description'),
        inline: false
      },
      {
        name: 'Proof of Incident',
        value: fields.getTextInputValue('incident_proof'),
        inline: false
      }
    ],
    footer: {
      text: `MP Report - Secure Transmission | Filed at ${new Date().toLocaleTimeString()} ${
        new Date().toString().match(/GMT([+-]\d{2})(\d{2})/)[0]
      }`,
      iconURL: client.user.displayAvatarURL()
    }
  });

  // Get MP report channel
  const mp_report = client.channels.cache.get(channels.mp_report);
  if (!mp_report || !mp_report.isTextBased()) return interactionEmbed(3, ResultMessage.Unknown, interaction);
  // Send MP copy
  await mp_report.send({ embeds: [embed] });
  // Remove RoWifi field for user's copy
  embed.data.fields.splice(2, 1);
  // DM copy to uesr
  interaction.user
    .send({
      content: `Here is a copy of a **MP report** you filed <t:${Math.floor(Date.now() / 1000)}:R>`,
      embeds: [embed]
    })
    // Suppress DM errors
    .catch(() => false);
  // User copy
  interaction.followUp({
    content: '`✅` Report filed! A copy has been sent to your DMs if I can DM you',
    embeds: [embed]
  });
  return;
}
