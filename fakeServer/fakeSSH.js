var fs = require('fs');
var crypto = require('crypto');
var inspect = require('util').inspect;
var PORTlistening = 22;

var buffersEqual = require('buffer-equal-constant-time');
var ssh2 = require('ssh2');
var utils = ssh2.utils;
var dataFile = "fakeSSHData.csv";
var dataPath = "/home/notroot/blynk/";
var dataFull = dataPath + dataFile;
var userName = "root"; // the username that the hacker is tryign to sign into // changes if they try something else to make a realistic prompt
var defaultPrompt = "@raspberrypi:~#" //root@cname:~#
var dataHeader = "Date,Time, IP, Port, method, ListenPort, login, password, other(pass? commands),\n";
//var pubKey = utils.genPublicKey(utils.parseKey(fs.readFileSync('user.pub')));
var buf = ""; //this gets filled a lot
new ssh2.Server({
    hostKeys: [fs.readFileSync('host.key')]
}, function(client) {

    var bob = client._sock;
    var clientAddress = bob._peername.address;
    var clientPort = bob._peername.port;
    var clientFull = clientAddress + ':' + clientPort;
    var clientStart = Date.now();

    console.log('Client connected!: ' + clientFull); // + ':' + client._sock.Socket._peername.port);
    buf = clientAddress + "," + clientPort + ",connection," + PORTlistening + ",--,--,(socket connection initiated),\n";
    toLog(dataFull, buf, dataHeader);

    client.on('tcpip', function(info) {
        console.log('tcpip:' + inspect(info));
        buf = clientAddress + "," + clientPort + "," + "tcpip,--,--,--," + inspect(info) + ",\n";
        toLog(dataFull, buf, dataHeader);
    })

    client.on('request', function(info) {
        console.log('request:' + inspect(info));
        buf = clientAddress + "," + clientPort + "," + "request,--,--,--," + inspect(info) + ",\n";
        toLog(dataFull, buf, dataHeader);
    })

    client.on('authentication', function(ctx) {
        console.log('ctx.method:' + inspect(ctx.method, 0, 1));
        //buf = "ctx-method,--,--,--," + inspect(ctx.method) + ",\n";
        //toLog(dataFull, buf, dataHeader);
        buf = clientAddress + "," + clientPort + "," + inspect(ctx.method, 0, 1) + "," + PORTlistening + "," + ctx.username + "," + ctx.password + "," + '\n';
        toLog(dataFull, buf, dataHeader);
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
                buf = clientAddress + "," + clientPort + "," + "pty,--,--,--," + inspect(info.term) + ",\n";
                toLog(dataFull, buf, dataHeader);
            });
            session.on('window-change', function(accept, reject, info) {
                //accept();
                console.log('window-change:' + (inspect(info.cols) + '.' + inspect(info.rows) + '.' + inspect(info.width) + '.' + inspect(info.height)));
                buf = clientAddress + "," + clientPort + "," + "window-change,--,--,--," + (inspect(info.cols) + '.' + inspect(info.rows) + '.' + inspect(info.width) + '.' + inspect(info.height)) + ",\n";
                toLog(dataFull, buf, dataHeader);
            });
            session.on('x11', function(accept, reject, info) {
                //accept();
                console.log('x11:' + inspect(info.protocol));
                buf = clientAddress + "," + clientPort + "," + "x11,--,--,--," + inspect(info.protocol) + ",\n";
                toLog(dataFull, buf, dataHeader);
            });
            session.on('shell', function(accept, reject) {
                buf = clientAddress + "," + clientPort + "," + "shell,--,--,--,(sending prompt),\n";
                toLog(dataFull, buf, dataHeader);

                var stream = accept();
                stream.write(userName + defaultPrompt); //looks like the prompt they wanted...
                var passwd = "";
                stream.on('data', function(chunk) {

                    //console.log('typed: ' + chunk.toString().charCodeAt(0));
                    //if user presses "enter" (CR == 13, LF == 10)
                    stream.write(chunk);
                    if (chunk.toString().charCodeAt(0) == '13' || chunk.toString().charCodeAt(0) == '10') {
                        if (passwd.length == 0) return; //catching another "enter" character....
                        console.log('use entered: ' + passwd);
                        buf = clientAddress + "," + clientPort + "," + "(user entry),--,--,--," + passwd + ",\n";
                        toLog(dataFull, buf, dataHeader);
                        passwd = "";
                        stream.write('\n' + userName + defaultPrompt);
                        return; //should go get a new chunk, and not add to passwd
                    }

                    //if user presses CNTL+c
                    if (chunk.toString().charCodeAt(0) == '3') {
                        console.log('user watns to leave');
                        buf = clientAddress + "," + clientPort + "," + "(code CNTL+c),--,--,--,(closed connection),\n";
                        toLog(dataFull, buf, dataHeader);
                        //stream.write('bye! thanks for playing!\n');
                        stream.exit(0);
                        stream.end();
                        var disTime = Date.now();
                        var delta = (disTime - clientStart) / 1000;
                        buf = clientAddress + "," + clientPort + "," + "disconnected,--,--,--," + 'Time on: ' + delta.toString() + 'seconds' + ",\n";
                        toLog(dataFull, buf, dataHeader);
                        console.log('Client ' + clientFull + ' disconnected. Time on: ' + delta.toString() + 'seconds');
                    }

                    passwd += chunk;
                });

                // Now read from and write to `stream`
            });
            session.on('exec', function(accept, reject, info) {
                //console.log('Client wants to execute: ' + inspect(info.command));
                var stream = accept();
                buf = clientAddress + "," + clientPort + "," + "exec,--,--,--," + inspect(info.command) + ",\n";
                toLog(dataFull, buf, dataHeader);
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
        buf = clientAddress + "," + clientPort + "," + "disconnected,--,--,--," + 'Time on: ' + delta.toString() + 'seconds' + ",\n";
        toLog(dataFull, buf, dataHeader);
        console.log('Client ' + clientFull + ' disconnected. Time on: ' + delta.toString() + 'seconds');
    });
}).listen(PORTlistening, '0.0.0.0', function() {
    console.log('Listening on port ' + this.address().port);
});

function toLog(file, data, headers) {
    //file is the full path/filename for the log
    //data is the string of data to add (with newlines or whatever)

    try {
        fs.access(file, (err) => {
            try {
                if (err) {
                    console.error('1log file does not exist, creating:' + file);
                    //this creates and writes the headers
                    var buf = new Buffer(headers);
                    //fs.write(fd, buf, 0, buf.length, null, function(err) {
                    fs.writeFile(file, buf, function(err) {
                        if (err) console.log("1log error writing file:" + err);
                        console.log("1log created and started the file!");
                    });
                }
                var times = new Date().getFullYear().toString() + (new Date().getMonth() + 1).toString() + new Date().getDate().toString() + "," + new Date().getHours().toString() + ":" + new Date().getMinutes().toString() + ":" + new Date().getSeconds().toString();

                buf = new Buffer(times + "," + data);
                fs.appendFile(file, buf, function(err) {
                    if (err) console.log("1log error writing line to file:" + err);
                    //console.log("1log wrote a new line to the file!");
                });

            } catch (err) {
                console.log("1log some outlandish:" + err);
            }
        });
    } catch (err) {
        console.log("log file didnt open (new):" + err);
        //because it already exists...so append!
        /*
        try {
            fs.open(file, 'a', (err, fd) => {
                if (err) console.log("log the error (a) here:" + err);
                //append stuff
                buf = new Buffer(times + "," + data);

                fs.close(fd, function(err) {
                    if (err) console.log("log error on closing:" + err);
                    console.log("log file closed!");
                });
            });
        } catch (err) {
            console.log("log failed to open (a):" + err);
        }
        */
        console.log("log done....giving up");
    }
}