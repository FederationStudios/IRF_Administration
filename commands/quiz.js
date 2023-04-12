// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, SlashCommandBuilder, ButtonBuilder, ButtonStyle, InteractionCollector, ActionRowBuilder, EmbedBuilder, ComponentType, InteractionType } = require("discord.js");
const { options } = require("../functions");
const { v4: uuidv4 } = require("uuid");


// Format: [ "question goes here", "divison that a point will be added to goes here" ]
const adminQuestions = [ [ "placeholder", "placeholder" ] ];
const combatQuestions = [ [ "Do you like leading raids?", "STAVKA" ], [ "Do you like being tasked with defending places/guarding people?", "RG"], [ "Do you like using tanks during combat?", "BoA" ] ];

module.exports = {
  name: "quiz",
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName("quiz")
    .setDescription("Take a quiz to determine the division that fits you best!")
    .setDMPermission(false),
  /**
    * @param {Client} client 
    * @param {CommandInteraction} interaction 
  */
  run: async (client, interaction) => {
    const quizOptions = options;
    let current = 0;

    await promptQuestion([ "Do you like Roblox combat?", "base" ], interaction);
    
    const collector = new InteractionCollector(client, 
      {
        channel: interaction.channel,
        interactionType: InteractionType.MessageComponent,
        componentType: ComponentType.Button
      });


    collector.on("collect", async (i) => {
      if (!i.user.id === interaction.user.id) return i.reply({ content: ":x:** | This button is not for you.**", ephemeral: true });
      collector.resetTimer();
      
      // PATH SETTING //
      if (i.customId.includes("base")) {
        if (i.customId.includes("yes")) {
          quizOptions.path = "combat";
          await promptQuestion(combatQuestions[0], interaction);
        } else {
          quizOptions.path = "admin";
          await promptQuestion(adminQuestions[0], interaction); 
        }
        return await i.deferUpdate({ content: "Loading next question, please wait...",  embeds: [], components: [] });
      }    
    
      // FINISH CHECK //
      if (current + 1 >= combatQuestions.length) {
        if (i.customId.includes("yes")) quizOptions.path === "combat" ? quizOptions[combatQuestions[current][1]] += 1 : quizOptions[adminQuestions[current][1]] += 1;
        delete quizOptions.path;
        console.log(quizOptions);
        const selectedDivison = Object.keys(quizOptions).reduce((a, b) => quizOptions[a] > quizOptions[b] ? a : b);
        return interaction.editReply({ embeds: [ fittingDivisionEmbed.setTitle(`You fit in ${selectedDivison}`) ], components: [] });
      }
        
      // ANSWER PROCESSING //
      if (i.customId.includes("yes")) quizOptions.path === "combat" ? quizOptions[combatQuestions[current][1]] += 1 : quizOptions[adminQuestions[current][1]] += 1;
      current += 1;
      quizOptions.path === "combat" ? await promptQuestion(combatQuestions[current], interaction) : await promptQuestion(adminQuestions[current], interaction);
      return await i.deferUpdate({ content: "Loading next question, please wait...",  embeds: [], components: [] });
    });

    collector.on("end", async () => {
      try {
        await interaction.editReply({ embeds: [new EmbedBuilder()
          .setTitle(":alarm_clock:** | Expired**")
          .setDescription("This quiz has expired, if you want to retake it please rerun the </quiz:1093915214879150136> command.")
          .setColor("Yellow")
          .setTimestamp()
        ], components: []
        });
      } catch (_) {
        return;
      }
    });
  }
};


const questionEmbed = new EmbedBuilder()
  .setDescription("Choose your answer with the buttons below.")
  .setColor("Green")
  .setTimestamp();

const fittingDivisionEmbed = new EmbedBuilder()
    .setDescription("info about division here \nblah blah blah blah")
    .setColor("DarkGreen")
    .setTimestamp()

/**
 * @param {Array} question
 * @param {CommandInteraction} interaction 
 */
async function promptQuestion(question, interaction) {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`yes_${question[1]}_${interaction.user.id}_${uuidv4()}`)
        .setLabel("Yes")
        .setStyle(ButtonStyle.Success),
    
      new ButtonBuilder()
        .setCustomId(`no_${question[1]}_${interaction.user.id}_${uuidv4()}`)
        .setLabel("No")
        .setStyle(ButtonStyle.Danger)
    );
    
  await interaction.editReply({ embeds: [questionEmbed.setTitle(question[0])], components: [row] });
}