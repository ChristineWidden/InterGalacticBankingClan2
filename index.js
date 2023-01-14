const Commands = require('./commands')

const { JsonDB } = require('node-json-db');
const { Config } = require ('node-json-db/dist/lib/JsonDBConfig');

// Require the necessary discord.js classes
const { Client, Intents } = require('discord.js');
const { token, commandSymbol } = require('./config.json');
//const token = process.env.token
//const commandSymbol = process.env.commandSymbol

// Create a new client instance
const client = new Client({ allowedMentions: {parse: []}, intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.MESSAGE_CONTENT] });
const db = new JsonDB(new Config("myDataBase", true, true, '/'));
let currentId = 0
try {
    currentId = db.getData("/info/currentId")
} catch (e) {}
db.push("/", {    "info": {
        "currentId": currentId,
        "nameIds": {
        }
    },
    "userInfo": {
    },
    "accounts": {
    }}, false);

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Ready!');
});

client.on('messageCreate', message => {
    console.log("Message!");
    console.log(message.content);
    const content = message.content.toLowerCase();
    const userId = message.author.id;
    if (content.startsWith(commandSymbol)) {
        const splitMessage = content.substring(1).split(" ");
        try {
            switch (splitMessage[0]) {
                case "c":
                case "create":
                    Commands.create(db, userId, splitMessage.splice(1));
                    break;
                case "default":
                    Commands.myDefault(db, userId, splitMessage.splice(1));
                    break;
                case "d":
                case "deposit":
                    Commands.deposit(db, userId, splitMessage.splice(1));
                    break;
                case "w":
                case "withdraw":
                    Commands.withdraw(db, userId, splitMessage.splice(1));
                    break;
                case "account":
                case "a":
                    Commands.account(db, userId, splitMessage.splice(1));
                    break;
                case "t":
                case "transfer":
                    Commands.transfer(db, userId, splitMessage.splice(1));
                    break;
                case "delete":
                    Commands.myDelete(db, userId, splitMessage.splice(1));
                    break;
                case "h":
                case "help":
                    Commands.help(db, userId, splitMessage.splice(1));
                    break;
            }
        } catch (e) {
            message.reply({content: e.message})
                .then(() => console.log(`Replied to message "${message.content}"`))
                .catch(console.error);
        }
    }
});

// Login to Discord with your client's token
client.login(token);