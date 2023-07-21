import { EmbedBuilder, ModalSubmitFields, ModalSubmitInteraction } from 'discord.js';
import { default as config } from '../config.json' assert { type: 'json' };
const { channels } = config;
import { ResultMessage, getRowifi, interactionEmbed } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';

export const name = 'nsc_report';
export async function run(
  client: CustomClient,
  interaction: ModalSubmitInteraction,
  fields: ModalSubmitFields
): Promise<void> {
  // Filing
  const rowifi = await getRowifi(interaction.user.id, client);
  const embed = new EmbedBuilder({
    title: 'NSC Report',
    color: 0xde2821,
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
      text: `NSC Report - Secure Transmission | Filed at ${new Date().toLocaleTimeString()} ${
        new Date().toString().match(/GMT([+-]\d{2})(\d{2})/)[0]
      }`,
      iconURL: client.user.displayAvatarURL()
    }
  });
  // Get NSC report channel
  const nsc_report = await client.channels.fetch(channels.nsc_report);
  if (!nsc_report || !nsc_report.isTextBased()) return interactionEmbed(3, ResultMessage.Unknown, interaction);
  // Send NSC copy
  await nsc_report.send({
    content: `Incoming NSC report from ${interaction.user.tag} (ID: ${interaction.user.id})`,
    embeds: [embed]
  });
  // Remove RoWifi field for user's copy
  embed.data.fields.splice(2, 1);
  // DM copy to the user
  interaction.user
    .send({
      content: `Here is a copy of a **NSC report** you filed <t:${Math.floor(Date.now() / 1000)}:R>`,
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
