//npm install ssh2 - https://www.npmjs.com/package/ssh2
//npm install buffer-equal-constant-time

var fs = require('fs');
var crypto = require('crypto');
var inspect = require('util').inspect;
var logger = require('./logToCSV.js').toLog;
var toCSV = require('./csvToHtml.js').processCSV;

var buffersEqual = require('buffer-equal-constant-time');
var ssh2 = require('ssh2');
var utils = ssh2.utils;

//environment variables
const PORTlistening = process.env.PORT || 22;
var dataFile = process.env.LOGNAME || "fakeSSHData.csv"; //where I save the collection of info
var dataPath = process.env.LOGPATH || "/home/notroot/blynk/"; //path to where I save it
var dataFull = dataPath + dataFile;
var userName = "root"; // the username that the hacker is tryign to sign into // changes if they try something else to make a realistic prompt
var defaultPrompt = "@raspberrypi:~#" //computer name theywill see in the prompt
var dataHeader = "Date,Time, IP, Port, method, ListenPort, Login(Username), Password, Other Info (notes)";
//var pubKey = utils.genPublicKey(utils.parseKey(fs.readFileSync('user.pub')));
//var buf = ""; //this gets filled a lot

new ssh2.Server({
    hostKeys: [fs.readFileSync('host.key')]
}, function(client) {
    try {
        //grab some info up front to use later
        var bob = client._sock;
        var clientAddress = bob._peername.address;
        var clientPort = bob._peername.port;
        var clientFull = clientAddress + ':' + clientPort;
        var clientStart = Date.now(); //will record later how long their session lasted

        console.log('Client connected!: ' + clientFull);
        var buf = "-,-," + clientAddress + "," + clientPort + ",connection," + PORTlistening + ",--,--,(socket connection initiated)";
        logger(dataFull, buf, dataHeader);

        client.on('tcpip', function(info) {
            console.log('tcpip:' + inspect(info));
            buf = "-,-," + clientAddress + "," + clientPort + "," + "tcpip,--,--,--," + inspect(info);
            logger(dataFull, buf, dataHeader);
        })

        client.on('request', function(info) {
            console.log('request:' + inspect(info));
            buf = "-,-," + clientAddress + "," + clientPort + "," + "request,--,--,--," + inspect(info);
            logger(dataFull, buf, dataHeader);
        })

        client.on('authentication', function(ctx) {
            console.log('ctx.method:' + inspect(ctx.method, 0, 1));
            //buf = "ctx-method,--,--,--," + inspect(ctx.method) + ",\n";
            //toLog(dataFull, buf, dataHeader);
            buf = "-,-," + clientAddress + "," + clientPort + "," + inspect(ctx.method, 0, 1) + "," + PORTlistening + "," + ctx.username + "," + ctx.password;
            logger(dataFull, buf, dataHeader);
            userName = ctx.username; //to make a realistic prompt
            ctx.accept();
        }).on('ready', function() {
            console.log('Client authenticated!');
            // "root@blynk.metamunson.com's password:" --to see what they enter

            client.on('session', function(accept, reject) {
                var session = accept();
                session.on('pty', function(accept, reject, info) {
                    accept();
                    console.log('ssh-pty accepted:' + inspect(info.term));
                    buf = "-,-," + clientAddress + "," + clientPort + "," + "pty,--,--,--," + inspect(info.term);
                    logger(dataFull, buf, dataHeader);
                });
                session.on('window-change', function(accept, reject, info) {
                    //accept();
                    console.log('window-change:' + (inspect(info.cols) + '.' + inspect(info.rows) + '.' + inspect(info.width) + '.' + inspect(info.height)));
                    buf = "-,-," + clientAddress + "," + clientPort + "," + "window-change,--,--,--," + (inspect(info.cols) + '.' + inspect(info.rows) + '.' + inspect(info.width) + '.' + inspect(info.height));
                    logger(dataFull, buf, dataHeader);
                });
                session.on('x11', function(accept, reject, info) {
                    //accept();
                    console.log('x11:' + inspect(info.protocol));
                    buf = "-,-," + clientAddress + "," + clientPort + "," + "x11,--,--,--," + inspect(info.protocol);
                    logger(dataFull, buf, dataHeader);
                });
                session.on('shell', function(accept, reject) {
                    buf = "-,-," + clientAddress + "," + clientPort + "," + "shell,--,--,--,(sending prompt)";
                    logger(dataFull, buf, dataHeader);

                    var stream = accept();
                    stream.write(userName + defaultPrompt); //looks like the prompt they wanted...
                    var passwd = "";
                    stream.on('data', function(chunk) {

                        //console.log('typed: ' + chunk.toString().charCodeAt(0));
                        //if user presses "enter" (CR == 13, LF == 10)
                        stream.write(chunk);
                        if (chunk.toString().charCodeAt(0) == '13' || chunk.toString().charCodeAt(0) == '10') {
                            if (passwd.length == 0) return; //catching another "enter" character....
                            console.log('user entered: ' + passwd);
                            buf = "-,-," + clientAddress + "," + clientPort + "," + "(user entry),--,--,--," + passwd;
                            logger(dataFull, buf, dataHeader);
                            //testing my CSV to HTML thing....
                            if (passwd.indexOf('jugger') != -1) toCSV(dataFull, function(err, filePath) {
                                if (err) stream.write('\n' + 'the thing didnt work:' + err);
                                stream.write('\n' + 'ok, the thing worked!\n');
                            });
                            passwd = "";
                            stream.write('\n' + userName + defaultPrompt);
                            return; //should go get a new chunk, and not add to passwd
                        }

                        //if user presses CNTL+c
                        if (chunk.toString().charCodeAt(0) == '3') {
                            console.log('user watns to leave');
                            buf = "-,-," + clientAddress + "," + clientPort + "," + "(code CNTL+c),--,--,--,(closed connection)";
                            logger(dataFull, buf, dataHeader);
                            //stream.write('bye! thanks for playing!\n');
                            stream.exit(0);
                            stream.end();
                            var disTime = Date.now();
                            var delta = (disTime - clientStart) / 1000;
                            buf = "-,-," + clientAddress + "," + clientPort + "," + "disconnected,--,--,--," + 'Time on: ' + delta.toString() + 'seconds';
                            logger(dataFull, buf, dataHeader);
                            console.log('Client ' + clientFull + ' disconnected. Time on: ' + delta.toString() + 'seconds');
                        }

                        passwd += chunk;
                    });

                    // Now read from and write to `stream`
                });
                session.on('exec', function(accept, reject, info) {
                    //console.log('Client wants to execute: ' + inspect(info.command));
                    var stream = accept();
                    buf = "-,-," + clientAddress + "," + clientPort + "," + "exec,--,--,--," + inspect(info.command);
                    logger(dataFull, buf, dataHeader);
                    console.log('Client wants to execute: ' + inspect(info.command));
                    stream.stderr.write('0');
                    stream.write(userName + defaultPrompt);
                    stream.exit(0);
                    stream.end();
                });
            });
        }).on('end', function() {
            var disTime = Date.now();
            var delta = (disTime - clientStart) / 1000;
            buf = "-,-," + clientAddress + "," + clientPort + "," + "disconnected,--,--,--," + 'Time on: ' + delta.toString() + 'seconds';
            logger(dataFull, buf, dataHeader);
            console.log('Client ' + clientFull + ' disconnected. Time on: ' + delta.toString() + 'seconds');
        });
    } catch (err) {
        console.log('error somewhere:' + err);
    }
}).listen(PORTlistening, '0.0.0.0', function() {
    console.log('Listening on port ' + this.address().port);
});