
var ws = require('websocket').server;
var http = require('http');

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    reponse.writeHead(404);
    reponse.end();
});

server.listen(9007, function() {
    console.log((new Date()) + ' Server is listening on port 9007');
});

var wsServer = new ws({
    httpServer: server,
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
    // put logic here to detect whether the specified origin is allowed
    return true;
}

wsServer.on('request', function(request) {

    if(!originIsAllowed(request.origin)) {
	// make sure we only accept requests from an allowed origin
	request.reject();
	console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected, invalid origin');
	return;
    }

    var connection = null;

    // process protocols
    for(var i=0, l=request.requestedProtocols.length; i < l; i++) {
	if(request.requestedProtocols[i] === 'videre_1.1') {
            connection = request.accept(request.requestedProtocols[i], request.origin);
	    console.log(
              (new Date()) + 
	      ' Connection from origin ' + request.origin + 
	      ' accepted, websocket ver: ' + connection.websocketVersion + 
//               ' extensions: ' + request.requestedExtensions + 
              ' protocol: ' + request.requestedProtocols[i]);
	    break;
	}
    }
    //
    // test if no connection was created, due to no protocol match
    if(!connection) {
	console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected, invalid protocol(s).');
        connection = request.reject();
	return;
    }

    console.log((new Date()) + ' Connection accepted.');
    connection.on('message', function(message) {
	if (message.type === 'utf8') {
	    console.log((new Date()) + ' Received message: ' + message.utf8Data);
	    msg = JSON.parse(message.utf8Data);
	    console.log((new Date()) + '                   id:  ' + msg.id);
	    console.log((new Date()) + '                   msg: ' + msg.msg);

	    processMessage(msg.id, msg.msg);

	    // the following is purely for testing 
	    // connection.sendUTF(JSON.stringify({id: 'ack'}));

	}
	else if (message.type === 'binary') {
	    console.log((new Date()) + ' Received binary message of ' + message.binaryData.length + ' bytes');
	    connection.sendBytes(message.binaryData);
	}
    });
    connection.on('close', function(reasonCode, description) {
	console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});

function processMessage(id, body) {
}
    
