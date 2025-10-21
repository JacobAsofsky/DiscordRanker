require('dotenv').config();

const g_gameMap = new Map();
const { Client, GatewayIntentBits } = require('discord.js');
const Game = require('./game.js');

let bot_token = process.env.DISCORD_TOKEN;

// Create a new client instance
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// When the client is ready, run this code (only once)
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  onStart();
  setInterval(tick, 1000);
});

//listen for slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

 let activeServer = GetActiveServer(interaction.guildId);
  if(!activeServer) {
        console.log("Server not found!");
        return;
    } 
  if(!activeServer.isInstanceValid()) {
    return;
  } 
  activeServer.processCommand(interaction);
});

// Log in to Discord with your bot token
client.login(bot_token);

function onStart()
{
    client.guilds.cache.forEach(guild => {
    console.log(guild.name);
    let newGameInstance = new Game.GameInstance(guild)
    newGameInstance.configure(client)
    g_gameMap.set(guild.id, newGameInstance)
    });
    
}

function tick()
{
  
}

function GetActiveServer(guildID)
{
    return g_gameMap.get(guildID);
}
