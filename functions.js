// eslint-disable-next-line no-unused-vars
const { Client, Embed, Interaction, EmbedBuilder } = require("discord.js");
const { default: fetch } = require("node-fetch");
const config = require("./config.json");

const errors = {
  "[SQL-ERR]": "An error has occurred while communicating with the database",
  "[ERR-CLD]": "You are on cooldown!",
  "[ERR-UPRM]": "You do not have the proper permissions to execute this command",
  "[ERR-BPRM]": "This bot does not have proper permissions to execute this command",
  "[ERR-ARGS]": "You have not supplied the correct parameters. Please check again",
  "[ERR-UNK]": "An unknwon error occurred. Please report this to a developer",
  "[ERR-MISS]": "The requested information wasn't found",
  "[WARN-NODM]": "This command isn't available in Direct Messages. Please run this in a server",
  "[WARN-CMD]": "The requested slash command was not found. Please refresh your Discord client and try again",
  "[INFO-DEV]": "This command is in development. This should not be expected to work"
};

module.exports = {
  /**
   * @typedef RobloxGroupUserData
   * @prop {RobloxGroupGroupData} group
   * @prop {RobloxGroupRoleData} role
   */
  /**
   * @typedef {Object} RobloxGroupGroupData
   * @prop {string} id
   * @prop {string} name
   * @prop {number} memberCount
   */
  /**
   * @typedef {Object} RobloxGroupRoleData
   * @prop {number} id
   * @prop {string} name
   * @prop {string} rank
   */

  /**
   * @description Sends a message to the console
   * @param {String} message [REQUIRED] The message to send to the console
   * @param {String} source [REQUIRED] Source of the message (Error.stack)
   * @param {Client} client [REQUIRED] A logged-in Client to send the message
   * @returns {null} null
   * @example toConsole(`Hello, World!`, `functions.js 12:15`, client);
   * @example toConsole(`Published a ban`, `ban.js 14:35`, client);
   */
  toConsole: async (message, source, client) => {
    if(!message || !source || !client) return console.error(`One or more of the required parameters are missing.\n\n> message: ${message}\n> source: ${source}\n> client: ${client}`);
    const channel = await client.channels.cache.get(config.discord.devChannel);
    if(source.split("\n").length < 2) return console.error("[ERR] toConsole called but Error.stack was not used\n> Source: " + source);
    source = source.split("\n")[1].trim().substring(3).split("/").pop().replace(")", "");
    if(!channel) return console.warn("[WARN] toConsole called but bot cannot find config.discord.devChannel\n", message, "\n", source);

    await channel.send(`Incoming message from \`${source}\` at <t:${Math.floor(Date.now()/1000)}:F>`);
    const check = await channel.send({ embeds: [
      new Embed({
        title: "Message to Console",
        color: 0xDE2821,
        description: `${message}`,
        footer: {
          text: `Source: ${source} @ ${new Date().toLocaleTimeString()} ${new Date().toString().match(/GMT([+-]\d{2})(\d{2})/)[0]}`
        },
        timestamp: new Date()
      })
    ]})
      .then(false)
      .catch(true); // Supress errors
    if(check) return console.error("[ERR] toConsole called but message failed to send");

    return null;
  },
  /**
   * @description Replies with a Embed to the Interaction
   * @param {Number} type 1- Sucessful, 2- Warning, 3- Error, 4- Information
   * @param {String} content The information to state
   * @param {String} expected The expected argument (If applicable)
   * @param {Interaction} interaction The Interaction object for responding
   * @param {Client} client Client object for logging
   * @param {Array<Boolean, Number>} remove Whether to delete the message and the specified timeout in seconds
   * @example interactionEmbed(1, "", `Removed ${removed} roles`, interaction, client, [false, 0])
   * @example interactionEmbed(3, `[ERR-UPRM]`, `Missing: \`Manage Messages\``, interaction, client, [true, 15])
   * @returns {null} 
   */
  interactionEmbed: async function(type, content, expected, interaction, client, remove) {
    if(!type || typeof content != "string" || expected === undefined || !interaction || !client || !remove || remove.length != 2) throw new SyntaxError(`One or more of the required parameters are missing in [interactionEmbed]\n\n> ${type}\n> ${content}\n> ${expected}\n> ${interaction}\n> ${client}`);
    if(!interaction.deferred) await interaction.deferReply();
    const embed = new EmbedBuilder();

    switch(type) {
    case 1:
      embed
        .setTitle("Success")
        .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL({ dynamic: true, size: 4096 }) })
        .setColor(0x7289DA)
        .setDescription(!errors[content] ? expected : `${errors[content]}\n> ${expected}`)
        .setFooter({ text: "The operation was completed successfully with no errors" })
        .setTimestamp();
  
      break;
    case 2:
      embed
        .setTitle("Warning")
        .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL({ dynamic: true, size: 4096 }) })
        .setColor(0xFFA500)
        .setDescription(!errors[content] ? expected : `${errors[content]}\n> ${expected}`)
        .setFooter({ text: "The operation was completed successfully with a minor error" })
        .setTimestamp();
  
      break;
    case 3:
      embed
        .setTitle("Error")
        .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL({ dynamic: true, size: 4096 }) })
        .setColor(0xFF0000)
        .setDescription(!errors[content] ? `I don't understand the error "${content}" but was expecting ${expected}. Please report this to the support server!` : `${errors[content]}\n> ${expected}`)
        .setFooter({ text: "The operation failed to complete due to an error" })
        .setTimestamp();
  
      break;
    case 4:
      embed
        .setTitle("Information")
        .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL({ dynamic: true, size: 4096 }) })
        .setColor(0x7289DA)
        .setDescription(!errors[content] ? expected : `${errors[content]}\n> ${expected}`)
        .setFooter({ text: "The operation is pending completion" })
        .setTimestamp();
  
      break;
    }
    await interaction.editReply({ content: "​", embeds: [embed] });
    if(remove[0]) setTimeout(() => { interaction.deleteReply(); }, remove[1]*1000);
    return null;
  },
  /**
   * @param {String} time 
   * @returns {Number|"NaN"}
   */
  parseTime: function (time) {
    let duration = 0;
    if(!time.match(/[1-9]{1,3}[dhms]/g)) return "NaN";

    for(const period of time.match(/[1-9]{1,3}[dhms]/g)) {
      const [amount, unit] = period.match(/^(\d+)([dhms])$/).slice(1);
      duration += unit === "d" ? amount * 24 * 60 * 60 : unit === "h" ? amount * 60 * 60 : unit === "m" ? amount * 60 : amount;
    }

    return duration;
  },
  /**
   * @async
   * @param {string} username Roblox username
   * @param {number} groupId Group ID to fetch
   * @returns {{success: boolean, error: string}|RobloxGroupUserData}
   */
  getGroup: async (username, groupId) => {
    if(!groupId) return {success: false, error: "No group ID provided"};
    if(isNaN(username)) {
      const user = await fetch(`https://api.roblox.com/users/get-by-username?username=${username}`)
        .then(res => res.json());
      
      if(user.success) return {success: false, error: `Interpreted \`${username}\` as Username but no user was found`};
      username = user.Id;
    } else {
      const user = await fetch(`https://api.roblox.com/users/${username}`)
        .then(res => res.json());
      if(user.success) return {success: false, error: `Interpreted \`${username}\` as ID but no user was found`};
    }
    const group = await fetch(`https://groups.roblox.com/v2/users/${username}/groups/roles`)
      .then(res => res.json());
    if(group.errorMessage) return {success: false, error: `No group found with ID \`${groupId}\``};
    const role = group.data.find(g => g.group.id === groupId);
    if(!role) return {success: false, error: "User is not in the group specified"};
    return {success: true, data: role};
  },

  /**
   * @async
   * @param {number} user Discord user ID
   * @returns {{success: boolean, error: string}|{success: boolean, roblox: number}}
   */
  getRowifi: async (user) => {
    if(!user) return {success: false, error: "No username provided"};
    const userData = await fetch(`https://api.rowifi.link/v1/users/${user}`)
      .then(res => res.json());
    
    const roblox = await fetch(`https://api.roblox.com/users/${userData.roblox_id}`)
      .then(res => res.json());
    if(roblox.errors) return {success: false, error: "Roblox ID does not exist"};
    
    if(!userData.success) return {success: false, error: userData.message};
    return {success: true, roblox: userData.roblox_id, username: roblox.Username};
  },

  // -- //

  ids: [
    ["Global", 0],
    ["Papers, Please!", 583507031],
    ["Sevastopol Military Academy", 603943201],
    ["Prada Offensive", 4683162920],
    ["Triumphal Arch of Moscow", 2506054725],
    ["Moscow Parade Grounds", 6887031333],
    ["Ryazan Airbase", 4424975098],
    ["Tank Training Grounds", 2451182763]
  ]
};