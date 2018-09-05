/*Variable area*/

var http = require('http');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');
var DiceRoller = require('./diceRoller.js');
var Initiative = require('./initiative.js');
const DestinyPool = require('./destinyPool.js');
const HomeServer = process.env.home_server;


var serve = serveStatic('public', {'index': ['index.html', 'index.htm']})

http.createServer(function (req, res) { 
    res.writeHead(200, {'Content-Type': 'text/plain'});
    serve(req, res, finalhandler(req, res));
    res.end('Hello! Was I asleep? Sorry, Heroku is very particular about sleeping apps.\n'); 
}).listen(process.env.PORT || 5000);

var Discord = require('discord.io');
var bot = new Discord.Client({
    token: process.env.token,
    autorun: true
});

var success = "Success", failure = "Failure", advantage = "Advantage", threat = "Threat", triumph = "Triumph", despair = "Despair", blank = "Blank", light = "Light", dark = "Dark";

var serverDice = {};
var serverSymbols = {};

var channelDestiny = {};
var channelInit = {};

const poolDB = require('./db.js');

// var symbols = dice.symbols;

function resultIs(result) {
    return function(target) {
        return result == target;
    }
}

function setupServer(serverID) {
    var server = bot.servers[serverID];
    var newConfig = JSON.parse(JSON.stringify(require('./dice.js')));
    var diceEM = {
        "a":newConfig.ability,
        "d":newConfig.difficulty,
        "s":newConfig.setback,
        "b":newConfig.boost,
        "p":newConfig.proficiency,
        "c":newConfig.challenge,
        "f":newConfig.force
    }
    var symbols = newConfig.symbols;
    var serverEmojis = server.emojis;
    //    console.log(serverEmojis);
    Object.keys(diceEM).forEach(function(dieKey) {
        diceEM[dieKey].forEach(function(side){
            var emoji = Object.keys(serverEmojis).find(function(it){
                return (serverEmojis[it].name === side.face);
            });
            emoji = serverEmojis[emoji];
            if (emoji) {
                side.code = "<:"+emoji.name+":"+emoji.id+">";
            }
        });
    });
    Object.keys(symbols).forEach(function(symbol) {
        var emoji = Object.keys(serverEmojis).find(function(it){
            return (serverEmojis[it].name === symbols[symbol].name);
        });
        emoji = serverEmojis[emoji];
        if (emoji) {
            symbols[symbol].code = "<:"+emoji.name+":"+emoji.id+">";
        }
    });

    serverDice[serverID] = diceEM;
    serverSymbols[serverID] = symbols;
    serverSetup[serverID] = true;
}

var diceMatch = /!Roll[ ]?\[([adpcfbs]*)\][ ]?\[?([sfatrdkl]*)\]?/i;
var diceHelpMatch = /^!Roll Help/i;
var destinyMatch = /^!Destiny Flip ((Dark)|(Light))/i;
var destinyAddMatch = /^!Destiny Add ((Dark)|(Light))/i;
var destinySetMatch = /^![Dd]estiny Set \[([DL]*)\]/i;
var poolMatch = /^!Destiny Roll/i;
var clearMatch = /^!Destiny Reset/i;
var showMatch = /^!Destiny Show/i;
var destinyHelpMatch = /^!Destiny Help/i;

var initiativeHelpMatch = /^!Init Help/i;
var initiativeRollMatch = /^!Init (PC|NPC)[ ]?\[([adpcfbs]*)\][ ]?\[?([sfatrdkl]*)\]?/i;
var initiativeAddMatch = /^!Init (?:Add|A) (PC|NPC) (\d+):\s?(\d+)?/i;
var initiativeRemoveMatch = /^!Init (?:Remove|R|Delete|D) (PC|NPC) (\d+)/i;
var initiativeShowMatch = /^!Init (?:Show|S|View|V)$/i;
var initiativeNextMatch = /^!Init (?:Next|N)$/i;
var initiativeStartMatch = /^!Init (?:Start)$/i;
var initiativeClearMatch = /^!Init (?:Clear|C|Reset)/i;

var pool = [];

var serverSetup = {};

/*Event area*/

bot.on("ready", function(event) {
    console.log("Connected!");
    console.log("Logged in as: ");
    console.log(bot.username + " - (" + bot.id + ")");
    setTimeout(console.log, 9000, bot.inviteURL);
});

bot.on("message", function(user, userID, channelID, message, event) {
    //    console.log(process.env.maintenance);
    if (user === "SWRPG_Dice" || user === "SWRPG_Dice_Beta"){
        return;
    }
    bot.setPresence( {game:"!Roll Help"} );

    console.log(user + " - " + userID);
    console.log(message);
    console.log("----------");
    console.log("Server ID " + bot.channels[channelID].guild_id); //Woot! Thanks Discord.io discord!
    
    var serverID = bot.channels[channelID].guild_id;
    var emojiServerID = serverID;

    if (hasPermission(0x00040000, serverID)) {
        console.log('Can use External Emoji. Using Home Server: ' + HomeServer);
        emojiServerID = HomeServer;
    }

    if(!(emojiServerID in serverDice)) {
        setupServer(emojiServerID);
    }

    if (message === "!WhereAmI?") {
        var fs = require('fs');
        var util = require('util');
        fs.writeFileSync('./data.json', util.inspect(serverDice[emojiServerID]) , 'utf-8');
        sendMessages(channelID, ["Server ID: " + bot.channels[channelID].guild_id]);
    }

    if (message === "!ClearAll") {
        serverDice = {};
        serverSymbols = {};
        serverSetup = {};
        sendMessages(channelID, ["Clearing all saved emoji settings. I'll re-add them next time someone wants to roll."]);
    }

    if (message.match(poolMatch)) {
        let destinyPool = new DestinyPool(channelID, []);

        destinyPool.getPool().then(function(pool){
            let roller = new DiceRoller(serverDice[emojiServerID]);
            roller.roll('f');
            pool = pool.concat(roller.symbolResults);

            destinyPool.setPool(pool).then(function(result){
                var returnMessage =  "Adding " + printSymbols(roller.symbolResults, emojiServerID) + " to destiny pool";
                var poolMessage = "Current destiny pool: " + printSymbols(pool, emojiServerID);
                sendMessages(channelID, [roller.diceResults[0].code, returnMessage, poolMessage]);
            });            
        });
    }

    if (message.match(clearMatch)) {
        let destinyPool = new DestinyPool(channelID, []);
        destinyPool.setPool([]).then(function(result){
            sendMessages(channelID, ["Destiny Pool reset for this channel."]);
        });        
    }

    if (message.match(showMatch)) {	
        let destinyPool = new DestinyPool(channelID, []);
        destinyPool.getPool().then(function(pool){
            if (pool.length == 0){
                sendMessages(channelID, ["No Destiny points have been rolled for this channel. Use `!Destiny Roll` to begin."]);
                return;
            } else {
                var poolMessage = "Current destiny pool: " + printSymbols(pool, emojiServerID);
                sendMessages(channelID, [poolMessage]);
            }                
        });
    }

    if (message.match(destinyHelpMatch)){
        var message = "```Available Commands:\n";
        message += "!Destiny Roll\n";
        message += "!Destiny Flip (Dark|Light)\n";
        message += "!Destiny Add (Dark|Light)\n";
        message += "!Destiny Show\n";
        message += "!Destiny Reset\n";
        message += "!Destiny Set [DL]\n";
        message += " ^ This can be in any combination of (D)ark and (L)ight```";
        sendMessages(channelID, [message]);
    }

    if (message.match(destinyMatch)) {
        let destinyPool = new DestinyPool(channelID, []);

        destinyPool.getPool().then(function(pool){
            var returnMessage = "";

            var match = destinyMatch.exec(message);

            if (match[1].toLowerCase() === "dark") {
                if (pool.indexOf(dark) !== -1) {
                    returnMessage += "Flipping a Dark Side point.";
                    pool[pool.indexOf(dark)] = light;
                } else {
                    returnMessage += "No Dark Side points to flip.";
                }
            } else if (match[1].toLowerCase() === "light") {
                if (pool.indexOf(light) !== -1) {
                    returnMessage += "Flipping a Light Side point.";
                    pool[pool.indexOf(light)] = dark;
                } else {
                    returnMessage += "No Light Side points to flip."; 
                }
            } else {
                returnMessage += "The Force is confused.";
            }

            destinyPool.setPool(pool).then(function(result){
                var poolMessage = "Current destiny pool: " + printSymbols(pool, emojiServerID);
                sendMessages(channelID, [returnMessage + "\n" + poolMessage]);
            });
        });
    }

    if (message.match(destinyAddMatch)) {
        
        let destinyPool = new DestinyPool(channelID, []);

        destinyPool.getPool().then(function(pool){
            var match = destinyAddMatch.exec(message);
            var symbols = [];
            symbols.push(match[1]);
            returnMessage += "Adding " + printSymbols(symbols, emojiServerID) + " to the destiny pool.";

            pool = pool.concat(symbols);

            destinyPool.setPool(pool).then(function(result){
                var returnMessage =  "Adding " + printSymbols(symbols, emojiServerID) + " to destiny pool";
                var poolMessage = "Current destiny pool: " + printSymbols(pool, emojiServerID);
                sendMessages(channelID, [returnMessage, poolMessage]);
            });            
        }).catch(function(err){
            console.log(err);
        });
    }

    if (message.match(destinySetMatch)) {
        let destinyPool = new DestinyPool(channelID, []);

        var returnMessage = "";
        var pool = [];

        var match = destinySetMatch.exec(message);

        var destinyTokens = match[1].split('');
        destinyTokens.forEach(function(token) {
            token = token.toLocaleLowerCase();
            if (token == 'd') {
                pool.push('Dark');
            } else if (token == 'l') {
                pool.push('Light');
            }

        });
        destinyPool.setPool(pool).then(function(result){
            var poolMessage = "Destiny Pool set as specified: " + printSymbols(pool, emojiServerID);
            sendMessages(channelID, [returnMessage + "\n" + poolMessage]);
        });        
    }

    if (message.match(diceHelpMatch)){
        var message = "```Dice Bot Help:\n";
        message += "Send commands in the form of: !Roll[Some Dice Characters]\n";
        message += "Where 'Some Dice Characters' are any of these:\n";
        message += "a = Ability (Green)\n";
        message += "d = Difficulty (Purple)\n";
        message += "s = Setback (Black)\n";
        message += "b = Boost (Blue)\n";
        message += "p = Proficiency (Yellow)\n";
        message += "c = Challenge (Red)\n";
        message += "f = Force (White)\n";
        message += "Example: !Roll[aadd]\n";
        message += "--------------------\n";
        message += "The dice bot also allows additional symbols to be added to rolls in the form of: !Roll[Some Dice Characters][Some Additional Characters]\n";
        message += "Where 'Some Additional Characters' are any of these:\n";
        message += "s = Success\n";
        message += "f = Failure\n";
        message += "a = Advantage\n";
        message += "t = Threat\n";
        message += "r = Triumph\n";
        message += "d = Despair\n";
        message += "k = Dark\n";
        message += "l = Light\n";
        message += "Example: !Roll[aadd][sa]\n```";
        sendMessages(channelID, [message]);
    }

    if (message.match(diceMatch)) {
        let roller = new DiceRoller(serverDice[emojiServerID], serverSymbols[serverID]);
        roller.roll(diceMatch.exec(message)[1].toLowerCase(), diceMatch.exec(message)[2].toLowerCase());

        var returnMessage = "";

        roller.diceResults.forEach(function(result) {
            returnMessage += result.code + " ";	
        });

        resultsMessage = printSymbols(roller.cancelledSymbols, emojiServerID)

        if (resultsMessage == ""){
            resultsMessage = "`All symbols cancelled out or none were rolled.`"
        }

        if (returnMessage.trim()==='') {
            resultsMessage = ":warning: No dice images could be displayed. Please ensure that Dice Emoji have been uploaded to the server or that the bot has the `Use External Emojis` permission.";
        }

        sendMessages(channelID, [returnMessage + '\n\n' + resultsMessage]);
    }

    if (message.match(initiativeRollMatch)) {
        if (!channelInit[channelID]){
            channelInit[channelID] = new Initiative();
        }

        let roller = new DiceRoller(serverDice[emojiServerID], serverSymbols[serverID]);
        var initRollMatch = initiativeRollMatch.exec(message);
        roller.roll(initRollMatch[2].toLowerCase(), initRollMatch[3].toLowerCase());
        var symbols = DiceRoller.countSymbols(roller.cancelledSymbols);
        channelInit[channelID].addSlot(initRollMatch[1], symbols['Success'], symbols['Advantage']);

        var returnMessage = "";
        roller.diceResults.forEach(function(result) {
            returnMessage += result.code + " ";	
        });
        resultsMessage = printSymbols(roller.cancelledSymbols, emojiServerID);

        sendMessages(channelID, [returnMessage + '\n\n' + resultsMessage, 'Adding '+ initRollMatch[1] +' slot to initative. New order: ' + '\n\n' + channelInit[channelID].unicodeOrder]);

    }

    if (message.match(initiativeAddMatch)) {
        if (!channelInit[channelID]){
            channelInit[channelID] = new Initiative();
        }

        var addMatch = initiativeAddMatch.exec(message);
        channelInit[channelID].addSlot(addMatch[1], parseInt(addMatch[2]), parseInt(addMatch[3]));
        sendMessages(channelID, ['Adding '+ addMatch[1] +' slot to initative. New order: ' + '\n\n' + channelInit[channelID].unicodeOrder]);
        
    }

    if (message.match(initiativeRemoveMatch)) {
        if (!channelInit[channelID]){
            sendMessages(channelID, ['No initiative is currently being tracked for this channel. Use `!Init (PC|NPC) []` to get started']);
        } else {
            var removeMatch = initiativeRemoveMatch.exec(message);
            if (channelInit[channelID].deleteSlot(removeMatch[1], parseInt(removeMatch[2]))) {
                sendMessages(channelID, ['Removing ' + removeMatch[1] + ' ' + removeMatch[2] + ' from initative. New order: ' + '\n\n' + channelInit[channelID].unicodeOrder]);
            } else {
                sendMessages(channelID, ['No '+ removeMatch[1] + ' ' + removeMatch[2] + ' to remove.']);
            }
        }
    }

    if (message.match(initiativeShowMatch)) {
        if (!channelInit[channelID]){
            sendMessages(channelID, ['No initiative is currently being tracked for this channel. Use `!Init (PC|NPC) []` to get started']);
        } else {
            sendMessages(channelID, ['Round: ' + channelInit[channelID].currentRound + ' | ' + channelInit[channelID].unicodeOrder]);
        }
    }

    if (message.match(initiativeNextMatch)) {
        if (!channelInit[channelID]){
            sendMessages(channelID, ['No initiative is currently being tracked for this channel. Use `!Init (PC|NPC) []` to get started']);
        } else {
            channelInit[channelID].nextSlot();
            sendMessages(channelID, ['Round: ' + channelInit[channelID].currentRound + ' | ' + channelInit[channelID].unicodeOrder]);
        }
    }

    if (message.match(initiativeStartMatch)) {
        if (!channelInit[channelID]){
            sendMessages(channelID, ['No initiative is currently being tracked for this channel. Use `!Init (PC|NPC) []` to get started']);
        } else {
            channelInit[channelID].beginInitiative();
            sendMessages(channelID, ['Round: ' + channelInit[channelID].currentRound + ' | ' + channelInit[channelID].unicodeOrder]);
        }
    }

    if (message.match(initiativeClearMatch)) {
        if (!channelInit[channelID]){
            sendMessages(channelID, ['No initiative is currently being tracked for this channel. Use `!Init (PC|NPC) []` to get started']);
        } else {
            channelInit[channelID] = null;
            sendMessages(channelID, ['Initiative for this channel has been cleared']);
        }
    }

    if (message.match(initiativeHelpMatch)) {
        var message = "```\n";
        message += "Init Help:\n";
        message += "To add a slot: !Init (PC|NPC) [Some Dice Characters]\n";
        message += "See '!Roll Help' for more details on the dice characters\n";
        message += "* Example: !Init PC [aa]\n";
        message += "Init supports rolling Additional Symbols as well.\n";
        message += "* Example: !Init PC [aa][sa]\n\n";
        message += "!Init Add (PC|NPC) Successes:Advantages\n";
        message += "* Example: !Init Add PC 1:2\n\n";
        message += "!Init Remove (PC|NPC) Occurrence\n";
        message += "* Example: !Init Remove NPC 3\n";
        message += "This will remove the 3rd NPC slot in the order.\n\n";
        message += "!Init Next\n";
        message += "!Init Show\n";
        message += "!Init Clear```";
        sendMessages(channelID, [message]);
    }
});

bot.on("disconnect", function(err, code) {
    try {
        console.log("Bot disconnected: " + err + " " + code);
        bot.connect(); //Auto reconnect
    } catch (err){
        console.log(err);
    }
    
});

/*Function declaration area*/
function printSymbols(symbols, serverID) {
    var result = "";
    console.log("Printing Symbols");
    symbols.forEach(function(symbol){
        result += serverSymbols[serverID][symbol.toLowerCase()].code;
    });
    return result;
}

function print(emojiID) {
    let guild = bot.guilds.get(HomeServer);
    return guild.emojis.find('name', emojiID).toString();
}

function hasPermission(permission, serverID) {
    var roleID = bot.servers[serverID].members[bot.id].roles[0];
    var role = bot.servers[serverID].roles[roleID];
    if (!role) {
        return false;
    }
    return ((role._permissions & permission) == permission);
}

function sendMessages(ID, messageArr, interval) {
    var resArr = [], len = messageArr.length;
    var callback = typeof(arguments[2]) === 'function' ?  arguments[2] :  arguments[3];
    if (typeof(interval) !== 'number') interval = 100;

    function _sendMessages() {
        setTimeout(function() {
            if (messageArr[0]) {
                var message = messageArr.shift();
                bot.sendMessage({
                    to: ID,
                    message: message
                }, function(err, res) {
                    resArr.push(err || res);
                    if (err != null && err.statusCode == 429) {
                        console.log("Unable to send message, waiting for: " + err.response.retry_after);
                        sendMessages(ID, [message], err.response.retry_after);
                    }
                    if (resArr.length === len) if (typeof(callback) === 'function') callback(resArr);
                });
                _sendMessages();
            }
        }, interval);
    }
    _sendMessages();
}

function sendFiles(channelID, fileArr, interval) {
    var resArr = [], len = fileArr.length;
    var callback = typeof(arguments[2]) === 'function' ? arguments[2] : arguments[3];
    if (typeof(interval) !== 'number') interval = 1;

    function _sendFiles() {
        setTimeout(function() {
            if (fileArr[0]) {
                bot.uploadFile({
                    to: channelID,
                    file: fileArr.shift()
                }, function(err, res) {
                    resArr.push(err || res);
                    if (resArr.length === len) if (typeof(callback) === 'function') callback(resArr);
                });
                _sendFiles();
            }
        }, interval);
    }
    _sendFiles();
}
