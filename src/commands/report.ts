import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { CustomClient } from '../typings/Extensions.js';

export const name = 'report';
export const modal = true;
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Report an MP for breaking their rules or a member of the Military for violating Military Law');
export async function run(_client: CustomClient, interaction: ChatInputCommandInteraction): Promise<void> {
  const report = new ModalBuilder({ title: 'Military Police Report', custom_id: 'report' });
  const comp = [
    new TextInputBuilder({
      label: 'Your Roblox username?',
      custom_id: 'reporter_roblox',
      min_length: 3,
      max_length: 16,
      style: TextInputStyle.Short
    }),
    new TextInputBuilder({
      label: 'Roblox username of the offender(s)?',
      custom_id: 'offender_roblox',
      min_length: 3,
      max_length: 128,
      style: TextInputStyle.Paragraph
    }),
    new TextInputBuilder({
      label: 'Location of the incident?',
      placeholder: 'Example: 2 minutes ago on Sevastopol',
      custom_id: 'incident_place',
      min_length: 3,
      max_length: 32,
      style: TextInputStyle.Short
    }),
    new TextInputBuilder({
      label: 'What occurred during this incident?',
      placeholder: 'Please provide as much detail as possible',
      custom_id: 'incident_description',
      min_length: 3,
      max_length: 2000,
      style: TextInputStyle.Paragraph
    }),
    new TextInputBuilder({
      label: 'Relevant proof',
      placeholder: 'Post links ONLY. This bot cannot see attachments!',
      custom_id: 'incident_proof',
      min_length: 3,
      max_length: 4000,
      style: TextInputStyle.Paragraph
    })
  ];
  for (const c of comp) {
    const row: ActionRowBuilder<TextInputBuilder> = new ActionRowBuilder({ components: [c] });
    report.addComponents(row);
  }
  interaction.showModal(report);
  return;
}
