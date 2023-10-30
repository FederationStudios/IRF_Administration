import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  GuildMember,
  Message,
  ModalBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { paginationRow } from '../functions.js';
import { departments } from '../models/departments.js';
import { divisions } from '../models/divisions.js';
import { msgs } from '../models/msgs.js';
import { tickets } from '../models/tickets.js';
import { CustomClient } from '../typings/Extensions.js';

type ticketFunctionArgs = {
  interaction: ButtonInteraction | ChatInputCommandInteraction;
  ticket: tickets;
  client: CustomClient;
};
async function transferTicket({ interaction, ticket, client }: ticketFunctionArgs): Promise<tickets> {
  // Check ticket claimer
  if (ticket.claimer !== interaction.user.id) {
    await interaction.editReply({ content: 'You are not the ticket owner' });
    return Promise.reject('Not owner');
  }
  if (ticket.status === 'Closed') {
    await interaction.editReply({ content: 'This ticket is closed' });
    return Promise.reject('Closed');
  }
  // Check if guild ID is the same as ticket's division
  const div = await ticket.getDivision_division();
  if (div.contacts !== interaction.channel.id) {
    await interaction.editReply({ content: 'This ticket is not with this department' });
    return Promise.reject('Not in guild');
  }
  // Update ticket
  ticket.status = 'Transferring';
  ticket.claimer = null;
  // Find the new department it's being transferred to
  const division = await getDivision({ interaction, ticket, client }).catch((e) => e);
  if (division === 'Cancelled') division === null;
  else if (typeof division !== 'object' || division instanceof Error) throw division;
  if (!division) {
    await interaction.editReply({
      content: "You didn't select a division to transfer the ticket to. This is required!"
    });
  } else {
    // Set division
    ticket.division = division.divId;
    await ticket.save();
    // Get the last message sent
    const m = await msgs.findOne({ where: { tick: ticket.ticketId }, order: [['createdAt', 'DESC']] });
    // Get the division guild
    const gCheck = client.guilds.cache.get(division.guildId);
    if (!gCheck || !gCheck.available) {
      await interaction.editReply({ content: 'The guild is not available' });
      return;
    }
    // Get the division channel
    const cCheck = gCheck.channels.cache.get(division.contacts);
    if (!cCheck || !cCheck.isTextBased()) {
      await interaction.editReply({ content: 'The channel is not available' });
      return;
    }
    // Send message in the channel
    const firstMsg = await client.models.msgs.findOne({
      where: { tick: ticket.ticketId },
      order: [['createdAt', 'ASC']]
    });
    await cCheck.send({
      content: `[\`#${ticket.ticketId}\`] This ticket has been transferred to this division by its previous one. The last message sent is attached below. Click the button to claim the ticket!`,
      embeds: [
        { title: 'Initial Report', description: firstMsg.content, color: 0xaae66e },
        { title: 'Last Message', description: m.content + `\n> ${interaction.user.toString()}`, color: 0xaae66e }
      ],
      components: [
        new ActionRowBuilder({
          components: [
            new ButtonBuilder({
              customId: `claim-${ticket.ticketId}`,
              label: 'Claim Ticket',
              style: ButtonStyle.Success
            })
          ]
        }) as ActionRowBuilder<ButtonBuilder>
      ]
    });
    client.users.fetch(ticket.author).then((u) =>
      u.send({
        content: `[\`#${ticket.ticketId}\`] Your ticket has been transferred to ${division.name} division. You can expect a response soon`
      })
    );
  }
  // Return (un)modified ticket
  return ticket;
}
async function closeTicket({ interaction, ticket, client }: ticketFunctionArgs): Promise<tickets> {
  // Check ticket claimer
  if (ticket.claimer !== interaction.user.id) {
    await interaction.editReply({ content: 'You are not the ticket owner' });
    return Promise.reject('Not owner');
  }
  if (ticket.status === 'Closed') {
    await interaction.editReply({ content: 'This ticket is already closed' });
    (interaction as ButtonInteraction).message.edit({ components: [] });
    return Promise.reject('Closed');
  }
  if (ticket.status !== 'Open') {
    await interaction.editReply({ content: 'This ticket is not open. Please wait for transfers to finish' });
    (interaction as ButtonInteraction).message.edit({ components: [] });
    return Promise.reject('Not open');
  }
  // Check if guild ID is the same as ticket's division
  const div = await ticket.getDivision_division();
  if (div.contacts !== interaction.channel.id) {
    await interaction.editReply({ content: 'This ticket is not with this department' });
    return Promise.reject('Not in guild');
  }
  // Update the ticket
  ticket.status = 'Closed';
  ticket.claimer = null;
  await ticket.save();
  // Fetch all buttons
  const msgs = await ticket.getMsgs();
  const mp = [];
  for (const m of msgs) {
    // Extract the channel ID and message ID
    const [, , , , , cId, mId] = m.link.split('/');
    mp.push((client.channels.cache.get(cId) as TextChannel).messages.fetch(mId));
  }
  const messages = (await Promise.all(mp)).filter((m) => m !== undefined);
  // Edit the messages
  const ep = [];
  for (const m of messages) {
    ep.push(m.edit({ components: [] }));
  }
  await Promise.all(ep);
  // Inform the user
  await interaction.editReply({ content: 'This ticket has been closed' });
  await client.users.fetch(ticket.author).then((u) =>
    u.send({
      content: `[\`#${ticket.ticketId}\`] Your ticket has been closed. If you have any further issues, please open a new ticket.`
    })
  );
}
async function replyTicket({ interaction, ticket, client }: ticketFunctionArgs): Promise<tickets> {
  const tId = (interaction as ButtonInteraction).customId.split('-').slice(1).join('-');
  // Build the modal
  const modal = new ModalBuilder().setTitle('Reply to Ticket').setCustomId(`reply-${tId}`);
  modal.setComponents(
    new ActionRowBuilder({
      components: [
        new TextInputBuilder({
          customId: 'content',
          label: 'Enter your message to the user',
          minLength: 10,
          maxLength: 2000,
          style: TextInputStyle.Paragraph
        })
      ]
    })
  );
  // Send the modal
  await interaction.showModal(modal);
  const i = await interaction.awaitModalSubmit({ filter: (mi) => mi.user.id === interaction.user.id, time: 60_000 });
  if (!i) {
    await interaction.editReply({ content: 'You did not reply in time' });
    return Promise.reject('Cancelled');
  }
  await i.deferReply({ ephemeral: true });
  // Fetch the content
  const content = i.fields.getTextInputValue('content');
  if (!content) {
    await interaction.editReply({ content: 'You did not reply with a message to the user' });
    return Promise.reject('Cancelled');
  }
  // Get ticket
  ticket = await client.models.tickets.findOne({ where: { ticketId: tId } });
  if (!ticket) {
    await i.editReply({ content: 'This ticket does not exist' });
    (interaction as ButtonInteraction).message.edit({ components: [] });
    return Promise.reject('Does not exist');
  }
  // Check ticket
  if (ticket.claimer !== interaction.user.id && ticket.author !== interaction.user.id) {
    await i.editReply({ content: 'You are not the ticket owner' });
    return Promise.reject('Not owner');
  }
  if (ticket.status !== 'Open') {
    await i.editReply({
      content: `This ticket cannot be interacted with. Please ${
        ticket.status === 'Closed' ? 'open a new ticket' : 'wait for transfers to complete'
      }`
    });
    (interaction as ButtonInteraction).message.edit({ components: [] });
    return Promise.reject('Not open');
  }
  // Check if guild ID is the same as ticket's division
  const div = await ticket.getDivision_division();
  if (interaction.inGuild() && div.contacts !== interaction.channel.id) {
    await interaction.editReply({ content: 'This ticket is not with this department' });
    return Promise.reject('Not in guild');
  }
  // Get the contact channel
  const contactChannel = client.channels.cache.get((await ticket.getDivision_division()).contacts);
  if (!contactChannel || !contactChannel.isTextBased()) {
    await i.editReply({ content: 'The contact channel is not available' });
    return Promise.reject('Unavailable');
  }
  // Send the message
  let m: Message;
  if (!interaction.inGuild()) {
    m = await contactChannel.send({
      content: `A reply has been received! Ticket is claimed by <@${ticket.claimer}>`,
      embeds: [{ description: content + `\n> ${(interaction as ButtonInteraction).user.toString()}`, color: 0xaae66e }],
      components: [
        new ActionRowBuilder({
          components: [
            new ButtonBuilder({ customId: `reply-${ticket.ticketId}`, label: 'Reply', style: ButtonStyle.Primary }),
            new ButtonBuilder({
              customId: `transfer-${ticket.ticketId}`,
              label: 'Transfer',
              style: ButtonStyle.Secondary
            }),
            new ButtonBuilder({ customId: `close-${ticket.ticketId}`, label: 'Close', style: ButtonStyle.Danger }),
            new ButtonBuilder({ customId: `unclaim-${ticket.ticketId}`, label: 'Unclaim', style: ButtonStyle.Danger })
          ]
        }) as ActionRowBuilder<ButtonBuilder>
      ],
      target: (interaction as ButtonInteraction).message
    });
  } else {
    m = await client.users.fetch(ticket.author).then((u) =>
      u.send({
        content: `[\`#${ticket.ticketId}\`] Your ticket has been replied to. You can view the reply by clicking below`,
        embeds: [{ description: content + `\n> ${interaction.user.toString()}`, color: 0xaae66e }],
        components: [
          new ActionRowBuilder({
            components: [
              new ButtonBuilder({
                customId: `reply-${ticket.ticketId}`,
                label: 'Reply',
                style: ButtonStyle.Success
              })
            ]
          }) as ActionRowBuilder<ButtonBuilder>
        ],
        target: (interaction as ButtonInteraction).message
      })
    );
  }
  // Insert message into the database
  await msgs
    .create({ tick: ticket.ticketId, content, author: interaction.user.id, link: m.url })
    .then((m) => ticket.addMsg(m));
  await i.editReply({ content: 'Your reply has been sent' });
  // Return the ticket
  return ticket;
}
async function claimTicket({ interaction, ticket, client }: ticketFunctionArgs): Promise<tickets> {
  // Check ticket
  if (ticket.claimer) {
    await interaction.editReply({ content: 'This ticket is already claimed' });
    return Promise.reject('Already claimed');
  }
  if (ticket.status === 'Closed') {
    await interaction.editReply({ content: 'This ticket is closed' });
    return Promise.reject('Closed');
  }
  // Check if channel ID is the same as ticket's division
  const div = await ticket.getDivision_division();
  if (div.contacts !== interaction.channel.id) {
    await interaction.editReply({ content: 'This ticket is not with this department' });
    return Promise.reject('Not in guild');
  }
  // Mark the ticket as claimed
  ticket.claimer = interaction.user.id;
  ticket.status = 'Open';
  await ticket.save();
  // Inform the user
  await interaction.editReply({ content: `Ticket claimed successfully!` });
  await client.users.fetch(ticket.author).then((u) =>
    u.send({
      content: `[\`#${ticket.ticketId}\`] Your ticket has been claimed by ${
        (interaction.member as GuildMember).nickname || interaction.user.username
      } (${interaction.user.toString()}). You can expect a response shortly!`
    })
  );
  await (interaction as ButtonInteraction).message.edit({
    content: `Ticket claimed by ${interaction.user.toString()}`,
    components: [
      new ActionRowBuilder({
        components: [
          new ButtonBuilder({ customId: `reply-${ticket.ticketId}`, label: 'Reply', style: ButtonStyle.Primary }),
          new ButtonBuilder({
            customId: `transfer-${ticket.ticketId}`,
            label: 'Transfer',
            style: ButtonStyle.Secondary
          }),
          new ButtonBuilder({ customId: `close-${ticket.ticketId}`, label: 'Close', style: ButtonStyle.Danger }),
          new ButtonBuilder({ customId: `unclaim-${ticket.ticketId}`, label: 'Unclaim', style: ButtonStyle.Danger })
        ]
      }) as ActionRowBuilder<ButtonBuilder>
    ]
  });
  // Return the ticket
  return ticket;
}
async function unclaimTicket({ interaction, ticket, client }: ticketFunctionArgs): Promise<tickets> {
  // Check ticket
  if (!ticket.claimer) {
    await interaction.editReply({ content: 'This ticket is not claimed' });
    return Promise.reject('Not claimed');
  }
  if (ticket.claimer !== interaction.user.id) {
    await interaction.editReply({ content: 'You are not the ticket owner' });
    (interaction as ButtonInteraction).message.edit({ components: [] });
    return Promise.reject('Not owner');
  }
  if (ticket.status === 'Closed') {
    await interaction.editReply({ content: 'This ticket is closed' });
    (interaction as ButtonInteraction).message.edit({ components: [] });
    return Promise.reject('Closed');
  }
  // Check if guild ID is the same as ticket's division
  const div = await ticket.getDivision_division();
  if (div.contacts !== interaction.channel.id) {
    await interaction.editReply({ content: 'This ticket is not with this department' });
    (interaction as ButtonInteraction).message.edit({ components: [] });
    return Promise.reject('Not in guild');
  }
  // Mark the ticket as unclaimed
  ticket.claimer = null;
  await ticket.save();
  // Inform the user
  await interaction.editReply({ content: 'You have unclaimed this ticket' });
  await client.users.fetch(ticket.author).then((u) =>
    u.send({
      content: `[\`#${ticket.ticketId}\`] Your ticket has been released. A new member will be assisting you soon!`
    })
  );
  // Return the ticket
  return ticket;
}
async function getDivision(interaction): Promise<divisions> {
  // Fetch all divisions and departments
  // We use Promise.all for shorthanding and running the requests asynchronously
  const [dep, div] = await Promise.all([
    departments.findAll({ paranoid: false }),
    divisions.findAll({ paranoid: false })
  ]);
  // Split the divisions and departments
  const deps = dep.filter((d) => d.department === null);
  // Create variables for use later
  const depEmbeds = [],
    divEmbeds = [];
  const depButtons = [],
    divButtons = [];
  // Create buttons for each department
  for (const d of deps) {
    depEmbeds.push({
      title: d.name,
      description: 'Click the relevant division for your report'
    });
    depButtons.push(
      dep
        .filter((dp) => dp.department === d.name)
        .map((d) =>
          new ButtonBuilder()
            .setCustomId(d.name)
            .setLabel(d.name)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(d.emoji)
            .setDisabled(d.isSoftDeleted())
        )
    );
  }
  // Get the requested division
  const divInteraction = await paginationRow(interaction, depButtons, {}, depEmbeds);
  if (!divInteraction || divInteraction.customId === 'cancel') {
    interaction.editReply({ content: 'Cancelled' });
    return Promise.reject('Cancelled');
  }
  /** @desc Division from departments */
  const division = dep.find((d) => d.name === divInteraction.customId);
  // Get the requested sub division, if any
  for (const s of div.filter((d) => d.division === division.name)) {
    // Push the embed
    divEmbeds.push({
      title: s.name,
      description: 'Select the relevant sub-division using the arrows'
    });
    // Push the button
    // We use an embed since this isn't being mapped
    divButtons.push([
      new ButtonBuilder()
        .setCustomId(String(s.divId))
        .setLabel(s.name)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(s.emoji)
        .setDisabled(s.isSoftDeleted())
    ]);
  }
  const sdInteraction = await paginationRow(interaction, divButtons, {}, divEmbeds);
  if (!sdInteraction || sdInteraction.customId === 'cancel') {
    interaction.editReply({ content: 'Cancelled' });
    return Promise.reject('Cancelled');
  }
  return div.filter((d) => String(d.divId) === sdInteraction.customId)[0];
}

export { claimTicket, closeTicket, getDivision, replyTicket, transferTicket, unclaimTicket };
