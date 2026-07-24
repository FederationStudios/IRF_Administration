import { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { default as config } from '../config.json' with { type: 'json' };
import { interactionEmbed } from '../functions.js';
import { CustomClient } from '../typings/Extensions.js';
const { channels } = config;

export async function execute(
  client: CustomClient,
  interaction: ChatInputCommandInteraction
): Promise<{ url: string } | undefined> {
  // Get the evidence attachment
  const trueEvidence = interaction.options.getAttachment('evidence');
  if (!trueEvidence) {
    return;
  }
  // Validate trueEvidence if it is present
  // It can only be an image, GIF, or video
  if (
    trueEvidence && // Check if evidence exists
    trueEvidence.contentType?.split('/')[0] !== 'image' &&
    trueEvidence.contentType?.split('/')[1] !== 'gif' &&
    trueEvidence.contentType?.split('/')[0] !== 'video'
  ) {
    interactionEmbed(3, 'Evidence must be an image or video (PNG, JPG, JPEG, or MP4)', interaction);
    return;
  }
  // Repost and return
  return client.channels
    .fetch(channels.image_host)
    .then((c) => (c as TextChannel).send({ files: [trueEvidence] }))
    .catch(() => undefined);
}
