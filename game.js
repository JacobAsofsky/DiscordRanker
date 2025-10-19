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


/*const mysql = require('mysql');

const connection = mysql.createConnection({
  host: '65.60.38.74',       
  user: 'jacobaso_discord',
  password: '?rpp*d1_j%7muUu]',
  database: 'jacobaso_discord_bots'
});*/

class GameInstance
{
    constructor(guild)
    {
        this.guild = guild;
        let mychannel = guild.channels.cache.find(c => c.name === app_name);
        this.channel = mychannel;
        this.players = [];
    }
    configure(discordClient) {
        client = discordClient;
    }

    isInstanceValid()
    {
        return (this.channel && this.guild);
    }

    processMessage(message)
    {
    const parts = message.content.trim().split(/\s+/);
    const command = parts[0].toLowerCase();

        if(command == "!give" || command == "!take") {
            if(parts.length == 3)
            {
                let addOrSubtract = (command == "!take");
                this.GiveUserPoints(message, parts[1], parts[2],addOrSubtract);
            }
            else {
                message.reply("*Incorrect usage. " + command + " <@user> <points>*");
            }
        }
        else if(command == "!rankings" || command == "!leaderboard") {
            let offset = parts[1];
            if(!offset) offset = 1;
            this.getRankings(message, offset);
        }
    }

    async GiveUserPoints(message, userID, points = 10, addOrSubtract = false) {

        var num = Number(points);
        if (isNaN(num)) {
            message.reply("*Invalid points amount!*");
            return;
        }
        else if(num <= 0) {
            message.reply("*Points must be greater than zero!*");
            return;
        }

        const onlyNumbers = userID.replace(/\D/g, '')
        let member = null;
        try {
            member = await message.guild.members.fetch(onlyNumbers);
        } 
        catch (error) {
            message.reply("*User not found in this server!*");
            return;
        }
        if(addOrSubtract) num *= -1;
        let pointStr = await this.adjustPlayerPoints(message, onlyNumbers, member.user.username, num);

        let outStr = "giving **" + member.user.username + "** " + points + " points!";
        if(addOrSubtract) {
            outStr = "taking " + points + " points from **"  + member.user.username + "**!";
        }
        outStr += "   "  + pointStr;
        message.reply(outStr);
    }

    async adjustPlayerPoints(message, playerID, username, points) {
        console.log(`Adjusting points for player ${playerID} by ${points}`);
        let serverId = message.guild.id;
        let oldPoints = await this.getPoints(playerID, serverId);
        if(!oldPoints) oldPoints = 0;
        await this.changePoints(playerID, username, serverId, points);
        let newPoints = await this.getPoints(playerID, serverId);
        return (`**${oldPoints} -> ${newPoints}**`);
    }


    async getRankings(message, offset = 1) {
         const rows = await this.getLeaderboard(message.guild.id, 10, 10 * (offset-1)); // top 10
        if (!rows.length) return message.reply('No scores yet.');
        let totalPages = Math.floor(rows.length / 10);
        const lines = rows.map((r, i) =>
            `${this.getRankingTitle(i)} **${r.USERNAME}**: ${r.POINTS}`
        );
    await message.reply({
        embeds: [{
        title: `🏆 LEADERBOARD 🏆 (Page ${offset}/${totalPages})`,
        description: lines.join('\n'),
        color: 0xF1C40F
        }]
    });
    }



    getRankingTitle(position) {
        if (position === 0) return '🥇';
        if (position === 1) return '🥈';
        if (position === 2) return '🥉';
        return `${position}.`;
    }

//SQL METHODS==================================================
async getPoints(userId, serverId) {
  const row = db.prepare(
    'SELECT POINTS FROM points WHERE USER_ID=? AND SERVER=?'
  ).get(userId, serverId);
  return row ? row.POINTS : null;
}

async changePoints(userId, username, serverId, delta = 0) {

  let points = await this.getPoints(userId, serverId);
  if(delta < -points) delta = -points;

  db.prepare(`
    INSERT INTO points (USER_ID, USERNAME, SERVER, POINTS, INTERACTIONS)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(USER_ID, SERVER) DO UPDATE SET
      POINTS = POINTS + excluded.POINTS,
      INTERACTIONS = INTERACTIONS + 1
  `).run(userId, username, serverId, delta);
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





module.exports = { GameInstance, db };

