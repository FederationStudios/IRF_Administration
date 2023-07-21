# IRF Administration
This document is pending further review and will be updated soon.

## Table of Contents
1. [Table of Contents](#table-of-contents)
2. [Contributors](#contributors)
3. [Installation](#installation)
  - [Pre-requisites](#pre-requisites)
  - [Steps](#steps)
4. [Contributing](#contributing)
  - [Bug Report](#bug-report)
  - [Feature Request](#feature-request)
  - [Security Concern](#security-concern)
5. [License](#license)

## Contributors
IRF Administration would not be possible without contributions from the following people
| Position | — | Github | Discord |
| --- | --- | --- | --- |
| Primary Developer | — | [@totallytavi](https://github.com/totallytavi) | totallytavi |

## Installation
### Pre-requisites
* Node.js Version 19.7.0 or higher
* NPM Version 9.5.0 or higher
* MySQL server
* Discord application (With bot token)
* Webserver with specific endpoints

### Steps
1. Clone this repository by forking it. This allows you to make changes and submit pull requests if you make changes. In addition, it keeps your repository up to date with the latest changes.
2. Install the required dependencies by running `npm install` in the root directory of the repository.
3. Create a `config.json` file in the `src` directory. A template has been provided below.
```json
{
  "bot": {
    "applicationId": "",
    "guildId": "",
    "token": "",
    "rowifiApiKey": ""
  },
  "discord": {
    "logChannel": "",
    "mainServer": "",
    "defaultProofURL": "" // Must be Discord message URL
  },
  "mysql": {
    "host": "localhost",
    "user": "",
    "password": "",
    "database": "",
    "port": 3306
  },
  "roblox": {
    "commissariatGroup": 0, // Group that gets bypassed from Rowifi checks
    "validationToken": "", // Roblox .ROBLOSECURITY token
    "mainOCtoken": "", // OpenCloud token
    "altOCtoken": "", // Alternate OpenCloud token
    "developerGroup": 0, // Group allowed to remove bans with "Fairplay" in them
    "developerRank": 0 // Minimum rank in developer group to remove bans
  },
  "channels": {
    "ban": "",
    "image_host": "",
    "mp_report": "",
    "nsc_report": "",
    "request": "",
    "unban": ""
  },
  "urls": {
    "servers": ""
  }
}
```
4. Run `npm start` at the root directory to build and start the project. If you wish to only build files, run `npm run prebuild`
5. If in VSCode, recommend using the provided `launch.json` file. Otherwise, change to the `dist` directory and run `node index.js` to start the bot.

**Note**: For the servers URL, you should create an endpoint that returns a JSON payload like the following:
```json
{
  "gameId": {
    // List of job IDs
    // Each job ID contains an array
    // The first element of the array is an array of player IDs
    // The second element is the date that the list was updated
    "jobId1": [[1, 2, 3, 4], "new Date().toUTCString()"]
  }
}
```

## Contributing
### Bug Report
Any feature that is not working as intended or you believe to have a bug should be reported as an issue. Please be as descriptive as possible, and include any screenshots or other information that may be helpful. Open an issue on the [Issues](https://github.com/FederationStudios/IRF_Administration/issues) page. If you are able to fix the bug, please submit a pull request and link the issue in the pull request.

### Feature Request
If you have an idea for this bot and it involves a division/ministry, please reach out to the corresponding High Command. They may have a divisional bot that serves this need already. However, if your idea is completely new, you are more than welcome to submit it as an issue. Please be as descriptive as possible, and include any mockups or other information that may be helpful.

### Security Concern
All security concerns will be handled properly, given proper information such as the severity of the concern and its potential for exploit. Please reach out to any member (With as many details as possible) ranked `Engineer` in the [Discord server](https://discord.gg/irf) and we will handle it immediately. By default, we will credit you here. If you do not wish to be credited, please let us know.

## License
[![Creative Commons License](https://i.creativecommons.org/l/by-sa/4.0/88x31.png)](https://creativecommons.org/licenses/by-sa/4.0/)
**IRF Administration** by [@FederationStudios](https://github.com/FederationStudios) is licensed under a [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/).