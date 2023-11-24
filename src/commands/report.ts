import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getRowifi } from '../functions.js';
import { divisions, msgs, ticketsCreationAttributes } from '../models/init-models.js';
import { getDivision } from '../functions/tickets.js';
import { CustomClient } from '../typings/Extensions.js';

export const name = 'report';
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Report a member to a division or sub-division');
export const ephemeral = true;
export async function run(client: CustomClient, interaction: ChatInputCommandInteraction): Promise<void> {
  // Verify Rowifi
  const rowifi = await getRowifi(interaction.user.id, client);
  if (rowifi.success === false) {
    interaction.editReply({ content: rowifi.error });
    return;
  }
  // Create collector filter for use later
  const filter = (i) => i.user.id === interaction.user.id;
  // Get division
  const division: string | divisions = await getDivision(interaction).catch((e) => e);
  if (division === 'Cancelled') return;
  else if (typeof division !== 'object' || division instanceof Error) throw division;
  // Return data
  const gCheck = client.guilds.cache.get(division.guildId);
  if (!gCheck || !gCheck.available) {
    interaction.editReply({ content: 'The guild is not available' });
    return;
  }
  // Get contact channel
  const contactChannel = gCheck.channels.cache.get(division.contacts);
  if (!contactChannel || !contactChannel.isTextBased()) {
    interaction.editReply({ content: 'The contact channel is not available' });
    return;
  }
  // Request confirmation since modals need a raw interaction
  const confirm = await interaction
    .editReply({
      content: `You have selected ${division.division} and its sub-division ${division.name}. Is this correct?`,
      components: [
        new ActionRowBuilder({
          components: [
            new ButtonBuilder({ customId: 'yes', label: 'Yes', style: ButtonStyle.Success }),
            new ButtonBuilder({ customId: 'no', label: 'No', style: ButtonStyle.Danger })
          ]
        }) as ActionRowBuilder<ButtonBuilder>
      ]
    })
    .then((i) => i.awaitMessageComponent({ componentType: ComponentType.Button, time: 10_000, filter }))
    .catch(() => null);
  // If no confirmation, cancel
  if (!confirm || confirm.customId === 'no') {
    confirm.update({ content: 'Report cancelled', components: [] });
    return;
  }
  // Create user inputs
  const inputs = [
    new TextInputBuilder({
      custom_id: 'offender',
      label: 'Offender(s) ID?',
      placeholder: 'Enter the ID(s) of the offender(s)',
      style: TextInputStyle.Paragraph,
      min_length: 4,
      max_length: 100,
      required: true
    }),
    new TextInputBuilder({
      custom_id: 'location',
      label: 'Where did this occur? [Discord/Roblox]',
      placeholder: 'Discord/Roblox',
      style: TextInputStyle.Short,
      min_length: 6,
      max_length: 8,
      required: true
    }),
    new TextInputBuilder({
      custom_id: 'reason',
      label: 'What happened?',
      placeholder: 'Enter the reason for the report',
      style: TextInputStyle.Paragraph,
      min_length: 10,
      max_length: 500,
      required: true
    }),
    new TextInputBuilder({
      custom_id: 'evidence',
      label: 'Evidence?',
      placeholder: 'Enter evidence for the report (Use URLs, the bot cannot see any images on your computer!)',
      style: TextInputStyle.Paragraph,
      min_length: 10,
      max_length: 1000,
      required: true
    }),
    new TextInputBuilder({
      custom_id: 'acknowledgement',
      label: 'I swear this report is:',
      placeholder: 'Complete and correct [yes]',
      style: TextInputStyle.Short,
      min_length: 3,
      max_length: 3,
      required: true
    })
  ];
  // Create the modal and add the inputs
  const modal = new ModalBuilder().setTitle(`${division.name} Report Form`).setCustomId(`${division.divId}-report`);
  for (const i of inputs) {
    modal.addComponents(new ActionRowBuilder({ components: [i] }));
  }
  // Create ticket creation attributes (for later)
  const tAttr: ticketsCreationAttributes = {
    division: division.divId,
    status: 'Open',
    author: interaction.user.id
  };
  // Submit modal
  await confirm.showModal(modal);
  await confirm.editReply({
    content: 'Please submit the report within 120 seconds. Open a new report if needed',
    components: []
  });
  const mi = await confirm
    .awaitModalSubmit({
      filter,
      time: 120_000
    })
    .catch(() => null);
  if (!mi) {
    interaction.editReply({ content: 'You did not submit a report in time. Please re-run the command' });
    return;
  }
  // Defer update
  await mi.deferUpdate();
  if (mi.fields.getTextInputValue('acknowledgement') !== 'yes') {
    mi.editReply({ content: 'You must agree to the acknowledgement. Please resubmit the report' });
    return;
  }
  // Create a ticket
  const ticket = await division.createTicket(tAttr);
  // Send the report
  const reportEmbed = {
    title: 'New Report',
    description: `${interaction.user.toString()} (Rowifi: ${rowifi.username}) has submitted a report to ${
      division.name
    }'s ${division.name}. Details are listed below. Click the button to reply to the report`,
    fields: [
      { name: 'Offender(s)', value: mi.fields.getTextInputValue('offender'), inline: false },
      { name: 'Location', value: mi.fields.getTextInputValue('location'), inline: false },
      { name: 'Reason', value: mi.fields.getTextInputValue('reason'), inline: false },
      { name: 'Evidence', value: mi.fields.getTextInputValue('evidence'), inline: false },
      { name: 'Acknowledgement', value: mi.fields.getTextInputValue('acknowledgement'), inline: false }
    ]
  };
  const m = await contactChannel.send({
    embeds: [reportEmbed],
    components: [
      new ActionRowBuilder({
        components: [
          new ButtonBuilder({ customId: `claim-${ticket.ticketId}`, label: 'Claim', style: ButtonStyle.Primary })
        ]
      }) as ActionRowBuilder<ButtonBuilder>
    ]
  });
  // Suppress errors (DMs restricted)
  await interaction.user
    .send({
      content: `[\`#${ticket.ticketId}\`] This is a copy of the report you submitted at <t:${Math.floor(
        new Date().getTime() / 1000
      )}:F>. Someone will assist you soon!`,
      embeds: [reportEmbed]
    })
    .catch(() => {});
  // Create DB message
  await msgs
    .create({
      content: `**Offenders**: ${mi.fields.getTextInputValue('offender')}\n**Location**: ${mi.fields.getTextInputValue(
        'location'
      )}\n**Reason**: ${mi.fields.getTextInputValue('reason')}\n**Evidence**: ${mi.fields.getTextInputValue(
        'evidence'
      )}\n**Acknowledgement**: ${mi.fields.getTextInputValue('acknowledgement')}`,
      author: interaction.user.id,
      tick: ticket.ticketId,
      link: m.url
    })
    // Then add the message to the ticket
    .then((m) => ticket.addMsg(m));
  // Edit the original interaction
  mi.editReply({
    content: 'Report submitted. Here is a copy. A copy as also been sent to your DMs if I can DM you.',
    embeds: [reportEmbed]
  });
  // Return
  return;
}
