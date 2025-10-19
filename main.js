const app_name = "discord-ranker";

const g_gameMap = new Map();
const { Client, GatewayIntentBits } = require('discord.js');
const Game = require('./game.js');

let bot_token = "MTQyOTI4NDQ3MjUzMjExMTQ5Mw.GMxCNI.av4rSrbytTw6KLroPAQVBknkoGc-r8m79ictpo";

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

// Listen for messages
client.on('messageCreate', message => {
  // Ignore messages from the bot itself
  if (message.author.bot) return;
  if(message.channel.name != app_name) return;
  processMessage(message);
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

function GetActiveServer(message)
{
    return g_gameMap.get(message.guild.id);
}

function processMessage(message)
{
    console.log(message.content);
  if (!message.guild)
    {
        //todo handle DM
        console.log("DM? Server not found!");
        return;
    } 
  let activeServer = GetActiveServer(message);
  if(!activeServer)
    {
        console.log("Server not found!");
        return;
    } 
  if(!activeServer.isInstanceValid())
  {
    return;
  }

  activeServer.processMessage(message);
}