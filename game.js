const app_name = "discord-ranker";
var client = null;

const Database = require('better-sqlite3');
const db = new Database('points.db', { fileMustExist: false });
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
CREATE TABLE IF NOT EXISTS points (
  USER_ID INTEGER NOT NULL,
  SERVER  TEXT NOT NULL,
  USERNAME TEXT NOT NULL,
  POINTS  INTEGER NOT NULL DEFAULT 0,
  INTERACTIONS INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (USER_ID, SERVER)
);
`);

class GameInstance
{
    constructor(guild)
    {
        this.guild = guild;
    }
    configure(discordClient) {
        client = discordClient;
    }

    isInstanceValid() {
        return this.guild != null;
    }

    processCommand(interaction) {
    let command = interaction.commandName;
    if(command === 'rankings') {
        this.handleRankings(interaction);
    }
    else if(command === 'balance') {
        this.handleBalance(interaction);
    }
    else if(command === 'give') {
        this.handleGiveOrTake(interaction, false);
    }
    else if(command === 'take') {
        this.handleGiveOrTake(interaction, true);
    }
    else if(command === 'setpoints') {
        this.handleSetPoints(interaction);
    }
}

    async handleRankings(interaction) {
        let offset = 1;
        const rows = await this.getLeaderboard(interaction.guildId, 10, 10 * (offset-1)); // top 10
        if (!rows.length) return interaction.reply('No scores yet.');
        let totalPages = Math.ceil(rows.length / 10);
        const lines = rows.map((r, i) =>`${this.getRankingTitle(i)} **${r.USERNAME}**: ${r.POINTS}`);
        await interaction.reply({
            embeds: [{
            title: `🏆 LEADERBOARD 🏆 (Page ${offset}/${totalPages})`,
            description: lines.join('\n'),
            color: 0xF1C40F
        }]
    });
    }

    async handleBalance(interaction) {   
    const row = db.prepare(`
        SELECT POINTS
        FROM points
        WHERE USER_ID = ? AND SERVER = ?
    `).get(getRawID(interaction.user.id), interaction.guildId);
    const points = row ? row.POINTS : 0;
    await interaction.reply(`you currently have **${points} points.**`);
    }

    async handleGiveOrTake(interaction, giveOrTake) {
        const userOption = interaction.options.getUser('user');
        const amountOption = interaction.options.getInteger('amount');
        const reasonOption = interaction.options.getString('reason');
        if(!userOption || !amountOption) {
            await interaction.reply("*Invalid command inputs!*");
            return;
        }
        let points = amountOption;
        if(points <= 0) {
            await interaction.reply("*Points must be greater than zero!*");
            return;
        }
        let targetUserID = getRawID(userOption.id);
        if(targetUserID == interaction.user.id) {
            await interaction.reply("*You cannot give or take points from yourself!*");
            return;
        }
        var USERNAME = userOption.globalName;
        if(!USERNAME) USERNAME = userOption.username;
        if(giveOrTake) points *= -1;
        let pointStr = await this.changePlayerPoints(interaction, targetUserID, USERNAME , points);
        let outStr = "Giving **" + USERNAME  + "** " + amountOption + " points!";
        if(giveOrTake) outStr = "Taking " + amountOption + " points from **"  + USERNAME  + "**!";
        outStr += "   "  + pointStr;
        if(reasonOption) {
            outStr += `\n*Reason:* **${reasonOption}**`;
        }
        //await interaction.reply(outStr);
        let responseColor = giveOrTake ? 0xff0000 : 0x32a852;
        await interaction.reply({
            embeds: [{
            title: ``,
            description: outStr,
            color: responseColor
        }]
    });
    }

    async handleSetPoints(interaction) {
        let member = interaction.member;
        let bAuthorized = false;
        if(member.user.globalName && member.user.globalName.includes("Jacob")) {
            bAuthorized = true;
        }
        if(!bAuthorized) {
            await interaction.reply("*You are not cool enough to use this command!*");
            return;
        }
        const userOption = interaction.options.getUser('user');
        const amountOption = interaction.options.getInteger('amount');
        if(!userOption || !amountOption) {
            await interaction.reply("*Invalid command inputs!*");
            return;
        }
        let points = amountOption;
        let targetUserID = getRawID(userOption.id);
        var USERNAME = userOption.globalName;
        if(!USERNAME) USERNAME = userOption.username;
        await this.setPoints(targetUserID, USERNAME, interaction.guildId, points);
        let outStr = "setting **"  + USERNAME + "** to " + points + "!";
        interaction.reply(outStr);
    }

    async changePlayerPoints(interaction, playerID, username, points) {
        points = Math.round(points);
        if(Math.abs(points) > 10000) {
            interaction.reply("*Point adjustment too large! Clamping to 10000*");
            points = Math.sign(points) * 10000;
        }
        console.log(`Adjusting points for player ${playerID} by ${points}`);
        let serverId = interaction.guildId;
        let oldPoints = await this.getPoints(playerID, serverId);
        if(!oldPoints) oldPoints = 0;
        await this.changePoints(playerID, username, serverId, points);
        let newPoints = await this.getPoints(playerID, serverId);
        return (`**${oldPoints} -> ${newPoints}**`);
    }

    getRankingTitle(position) {
            if (position === 0) return '🥇';
            if (position === 1) return '🥈';
            if (position === 2) return '🥉';
            return `${position+1}.`;
    }

//SQL METHODS==================================================
async getPoints(userId, serverId) {
  const row = db.prepare(
    'SELECT POINTS FROM points WHERE USER_ID=? AND SERVER=?'
  ).get(userId, serverId);
  return row ? row.POINTS : null;
}

async changePoints(userId, username, serverId, delta = 0) {
  db.prepare(`
    INSERT INTO points (USER_ID, USERNAME, SERVER, POINTS, INTERACTIONS)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(USER_ID, SERVER) DO UPDATE SET
      POINTS = POINTS + excluded.POINTS,
      INTERACTIONS = INTERACTIONS + 1,
      USERNAME = excluded.USERNAME
  `).run(userId, username, serverId, delta);
}

async setPoints(userId, username, serverId, points) {
  db.prepare(`
    INSERT INTO points (USER_ID, USERNAME, SERVER, POINTS, INTERACTIONS)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(USER_ID, SERVER) DO UPDATE SET
      USERNAME = excluded.USERNAME,
      POINTS   = excluded.POINTS
  `).run(userId, username, serverId, points);
}

async getLeaderboard(serverId, limit = 10, offset = 0) {
  return db.prepare(`
    SELECT USERNAME, POINTS, INTERACTIONS
    FROM points
    WHERE SERVER = ?
    ORDER BY POINTS DESC
    LIMIT ? OFFSET ?
  `).all(serverId, limit, offset);
}
//SQL METHODS==================================================





}


function getRawID(userID) {
    return userID.replace(/\D/g, '')
}



module.exports = { GameInstance, db };

