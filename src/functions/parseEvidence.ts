import { Attachment, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { CustomClient } from '../typings/Extensions.js';
import { interactionEmbed } from '../functions.js';
import { default as config } from '../config.json' assert { type: 'json' };
const { channels, discord } = config;

export async function execute(client: CustomClient, interaction: ChatInputCommandInteraction): Promise<Attachment> {
  // Get the evidence attachment
  let trueEvidence: Attachment = interaction.options.getAttachment('evidence') || undefined;
  // Validate trueEvidence if it is present
  // It can only be an image, GIF, or video
  if (
    trueEvidence && // Check if evidence exists
    trueEvidence.contentType.split('/')[0] !== 'image' &&
    trueEvidence.contentType.split('/')[1] !== 'gif' &&
    trueEvidence.contentType.split('/')[0] !== 'video'
  ) {
    interactionEmbed(3, 'Evidence must be an image or video (PNG, JPG, JPEG, or MP4)', interaction);
    return;
  }
  // Grab the default proof URL if evidence is blank
  if (!trueEvidence) {
    trueEvidence = await client.channels
      .fetch(discord.defaultProofURL.split('/')[5])
      .then((c) => (c as TextChannel).messages.fetch(discord.defaultProofURL.split('/')[6]))
      .then((m) => m.attachments.first())
      .catch(() => null);
  }
  // Repost and return
  return client.channels
    .fetch(channels.image_host)
    .then((c) => (c as TextChannel).send({ files: [trueEvidence] }))
    .catch(() => null);
}
