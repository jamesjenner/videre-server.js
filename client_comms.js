/*
 * client_comms.js v0.1 alpha
 *
 * Copyright (c) 2012 James G Jenner
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/
 */

/*
var vehicle       = require('./videre-common/js/vehicle.js');
var videre_comms  = require('./videre-common/js/videre_comms.js');
*/

var EventEmitter = require('events').EventEmitter;
var util         = require('util');
var http         = require('http');
var https        = require('https');
var fs           = require('fs');
var ws           = require('websocket').server;
var uuid         = require('node-uuid');
var crypto       = require('crypto');
var bcrypt       = require('bcrypt');

// load common js files shared with the videre client
eval(fs.readFileSync('./videre-common/js/vehicle.js').toString());
eval(fs.readFileSync('./videre-common/js/videre_comms.js').toString());

var USERS_FILE = 'users.json';
var users = null;

module.exports = ClientComms;

util.inherits(ClientComms, EventEmitter);

function ClientComms(options) {
    EventEmitter.call(this);

    options = options || {};

    this.allowAddVehicle = options.allowAddVehicle || true;
    this.allowDeleteVehicle = options.allowDeleteVehicle || true;
    this.allowUpdateVehicle = options.allowUpdateVehicle || true;
    this.port = options.port || 9007; // 80?
    this.securePort = options.securePort || 9008; // 443?
    this.uuidV1 = options.uuidV1 || false;
    this.allCommsSecure = options.allCommsSecure || false;
    this.sslKey = options.sslKey || 'keys/privatekey.pem';
    this.sslCert = options.sslCert || 'keys/certificate.pem';

    users = User.load(USERS_FILE);
}


ClientComms.prototype.startClientServer = function() {
    var options = {
	key: fs.readFileSync(this.sslKey),
	cert: fs.readFileSync(this.sslCert)
    };

    /*
    options = {
	pfx: fs.readFileSync('server.pfx');
    };
    */

    var httpsServer = https.createServer(options, function(request, response) {
        console.log((new Date()) + ' Https server received request for ' + request.url);
        response.writeHead(404);
        response.end();
    });
    var self = this;

    httpsServer.listen(self.securePort, function() {
        console.log((new Date()) + ' Https server is listening on port ' + self.securePort);
    });

    this.secureServer = new ws({
        httpServer: httpsServer,
        autoAcceptConnections: false
    });

    self.secureServer.on('request', function(request) {
	console.log((new Date()) + ' secure server request');
	processConnectionAttempt(self, request, true);
    });

    // only start up the unsecure comms if not all comms are to be secure
    if(!self.allCommsSecure) {
	var httpServer = http.createServer(function(request, response) {
	    console.log((new Date()) + ' Http server received request for ' + request.url);
	    response.writeHead(404);
	    response.end();
	});

	httpServer.listen(self.port, function() {
	    console.log((new Date()) + ' http server is listening on port ' + self.port);
	});

	self.server = new ws({
	    httpServer: httpServer,
	    autoAcceptConnections: false
	});

	self.server.on('request', function(request) {
	    console.log((new Date()) + ' server request');
	    processConnectionAttempt(self, request, false);
        });
    }
}

ClientComms.prototype.sendVehicles = function(connection, vehicles) {
    console.log((new Date()) + ' Sending id: ' + MSG_VEHICLES + ' body: ' + JSON.stringify(vehicles));
    connection.send(Message.constructMessage(MSG_VEHICLES, vehicles));
}

ClientComms.prototype.sendAddVehicle = function(vehicle) {
    console.log((new Date()) + ' Sending id: ' + MSG_ADD_VEHICLE + ' body: ' + JSON.stringify(vehicle));
    this.server.broadcast(Message.constructMessage(MSG_ADD_VEHICLE, vehicle));
}

ClientComms.prototype.sendDeleteVehicle = function(vehicle) {
    console.log((new Date()) + ' Sending id: ' + MSG_DELETE_VEHICLE + ' body: ' + JSON.stringify(vehicle));
    this.server.broadcast(Message.constructMessage(MSG_DELETE_VEHICLE, vehicle));
}

ClientComms.prototype.sendUpdateVehicle = function(vehicle) {
    console.log((new Date()) + ' Sending id: ' + MSG_UPDATE_VEHICLE + ' body: ' + JSON.stringify(vehicle));
    this.server.broadcast(Message.constructMessage(MSG_UPDATE_VEHICLE, vehicle));
}

ClientComms.prototype.sendTelemetry = function(telemetry) {
    console.log((new Date()) + ' Sending id: ' + MSG_VEHICLE_TELEMETRY + ' body: ' + JSON.stringify(telemetry));
    this.server.broadcast(Message.constructMessage(MSG_VEHICLE_TELEMETRY, telemetery));
}

ClientComms.prototype.sendPayload = function(payload) {
    console.log((new Date()) + ' Sending id: ' + MSG_VEHICLE_PAYLOAD + ' body: ' + JSON.stringify(payload));
    this.server.broadcast(Message.constructMessage(MSG_VEHICLE_PAYLOAD, payload));
}

fireNewConnection = function(self, connection) {
    self.emit('newConnection', connection);
}

fireNewConnectionAuthenticated = function(self, connection) {
    self.emit('newConnectionAuthenticated', connection);
}

fireNewConnectionAccepted = function(self, connection) {
    self.emit('newConnectionAccepted', connection);
}

rcvdAddVehicle = function(self, data) {
    self.emit('addVehicle', data);
}

rcvdDeleteVehicle = function(self, data) {
    self.emit('deleteVehicle', data);
}

rcvdUpdateVehicle = function(self, data) {
    self.emit('updateVehicle', data);
}

rcvdSendVehicles = function(self, connection) {
    self.emit('sendVehicles', connection);
}

rcvdPerformTest = function(self, data) {
    self.emit('vehicleTest', data);
}

rcvdLand = function(self, data) {
    self.emit('vehicleLand', data);
}

rcvdAbort = function(self, data) {
    self.emit('vehicleAbort', data);
}

rcvdLaunch = function(self, data) {
    self.emit('vehicleLaunch', data);
}

rcvdUp = function(self, data) {
    self.emit('vehicleUp', data);
}

rcvdDown = function(self, data) {
    self.emit('vehicleDown', data);
}

rcvdLeft = function(self, data) {
    self.emit('vehicleLeft', data);
}

rcvdRight = function(self, data) {
    self.emit('vehicleRight', data);
}

rcvdForward = function(self, data) {
    self.emit('vehicleForward', data);
}

rcvdReverse = function(self, data) {
    self.emit('vehicleReverse', data);
}

rcvdTurnLeft = function(self, data) {
    self.emit('vehicleTurnLeft', data);
}

rcvdTurnRight = function(self, data) {
    self.emit('vehicleTurnRight', data);
}

/*
rcvd = function(self, data) {
    self.emit('vehicle', data);
}
*/


function originIsAllowed(origin) {
    // put logic here to detect whether the specified origin is allowed
    return true;
}


function processConnectionAttempt(self, request, secure) {
    console.log((new Date()) + ' Connection attempt from origin ' + request.origin +
	      ', secure: ' + secure + 
	      ', websocket ver: ' + request.webSocketVersion + 
	      ', protocols : ' + request.requestedProtocols.length + 
	      ' : ' + request.requestedProtocols);

    if(!originIsAllowed(request.origin)) {
	// make sure we only accept requests from an allowed origin
	request.reject();
	console.log((new Date()) + ' Connection rejected, invalid origin: ' + request.origin);
	return;
    }

    var connection = null;

    // process protocols
    for(var i=0, l=request.requestedProtocols.length; i < l; i++) {
	if(request.requestedProtocols[i] === 'videre_1.1') {
            connection = request.accept(request.requestedProtocols[i], request.origin);
	    break;
	}
    }

    // test if no connection was created, due to no protocol match
    if(!connection) {
	console.log((new Date()) + ' Connection rejected, invalid protocol(s): ' + request.requestedProtocols);
        connection = request.reject();
	return;
    }

    console.log((new Date()) + ' Connection accepted, protocol: ' + connection.protocol);

    connection.secure = secure;
    connection.valid = false;

    // add the message listener
    connection.on('message', function(message) { processRawMessage(self, connection, message); });

    // add the connection close listener
    connection.on('close', function(reasonCode, description) {processConnectionClosed(connection, reasonCode, description);});

    // fire the connection event
    fireNewConnection(self, connection);
}

function processConnectionClosed(connection, reasonCode, description) {
    console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected: ' + reasonCode + ", " + description);
}

function processRawMessage(self, connection, message) {
    if (message.type === 'utf8') {
	console.log((new Date()) + ' Received message: ' + message.utf8Data);

	// deconstruct the message
	msg = Message.deconstructMessage(message.utf8Data);

	processMessage(self, connection, msg.id, msg.body);
    }
    else if (message.type === 'binary') {
	console.log((new Date()) + ' Received binary message of ' + message.binaryData.length + ' bytes');
	// connection.sendBytes(message.binaryData);
    }
    else {
	console.log((new Date()) + ' Received unknown message type ' + message.type);
    }
}

function authenticateConnection(self, connection, msgBody) {
    var validUser = false;
    var foundUser = false;
    var salt = null;
    var password = null;

    var user = new User(msgBody);

    if(!users || users.length == 0) {
	console.log((new Date()) + ' No users so creating user for : ' + user.userId);
	// We have the first user, so add it and accept
	validUser = true;

	user.salt = bcrypt.genSaltSync(10);
	user.password = bcrypt.hashSync(user.password, user.salt);
	users.push(user);
    
	User.save(USERS_FILE, users);
    } else {
	// validate that the user exists
	for(i = 0, l = users.length; i < l; i++) {
	    if(users[i].id === user.id) {
		// found the user
		foundUser = true;
		salt = users[i].salt;
		password = users[i].password;
		break;
	    }
	}

	if(foundUser) {
	    // validate if the salt and hash of the password is valid
	    hashed = bcrypt.hashSync(user.password, salt);
	    validUser = (password === hashed);
	}
    }

    if(validUser) {
	// validation successful
	console.log((new Date()) + ' authentication for user ' + user.userId + ' successful');

	// fire the connection event
	fireNewConnectionAuthenticated(self, connection);

	// only create a session if all comms are not secure (ie comms are shared between ws and wss)
	if(self.allCommsSecure) {
	    // fire the connection accepted event
	    fireNewConnectionAccepted(self, connection);
	} else {
	    // create a session key
	    var sessionId = generateSession(self, connection);

	    // send the session key back
	    console.log((new Date()) + ' sending session ' + sessionId);
	    connection.send(Message.constructMessage(MSG_AUTHENTICATION_ACCEPTED, sessionId));
	}
    } else {
	console.log((new Date()) + ' authentication for user ' + user.userId + ' unsuccessful');

	// validation failed, reject the connection
	connection.send(Message.constructMessage(MSG_AUTHENTICATION_REJECTED));
	connection.drop(connection.CLOSE_REASON_NORMAL, "authentication failed");
    }
}

var sessions = new Array();

function generateSession(self, connection) {
    currentTime = Date.now();

    console.log((new Date()) + ' generating session id for ' + (self.uudiV1 ? 'UUID V1' : 'UUID V4 RNG') + ' @ ' + currentTime);

    var session = new Object();
    session.time = currentTime;
    session.address = connection.remoteAddress;
    if(self.uuidV1) {
	session.sessionId = uuid.v1();
    } else {
	session.sessionId = uuid.v4({rng: uuid.nodeRNG});
    }

    sessions.push(session);

    return session.sessionId;
}

/**
 * validate session
 *
 * note that this is only performed when a session id has been passed via message
 * so if the session is invalid then the connection will be terminated automatically
 *
 * This also trims the session id pool of any expired sessions. currently only occurs here.
 */
function validateSession(self, connection, msg) {

    // set a time to compare the date the session was created
    var validTimeCompare = Date.now() - (2 * 60 * 1000);

    // iterate through the sessions, remove expired ones
    // note: comparing length everytime, as the length may change
    console.log((new Date()) + " Checking for old sessions");
    for(i = 0; i < sessions.length; i++) {
	if(sessions[i].time < validTimeCompare) {
            console.log((new Date()) + " \tremoving session: " + sessions[i].sessionId + " : " + sessions[i].time);
	    // remove as has expired
	    sessions.splice(i, 1);
	}
    }

    var entryFound = false;
    var idx = -1;
    // find the session id for the remote address of the connection
    for(i = 0, l = sessions.length; i < l; i++) {
	if(sessions[i].address === connection.remoteAddress) {
	    // found the address
	    entryFound = true;
	    idx = i;
	    break;
	}
    }

    if(entryFound) {
	// check session id is valid
	if(sessions[i].sessionId === msg.sessionId) {
	    // the session is valid
	    connection.valid = true;
	}
	// remove the entry, either it's invalid or it's valid and being used
	sessions.splice(idx, 1);
    }

    if(connection.valid) {
	console.log((new Date()) + " session confirmed");
	connection.send(Message.constructMessage(MSG_SESSION_CONFIRMED));
	// fire the connection accepted event
	fireNewConnectionAccepted(self, connection);
    } else {
	// disconnect as the session id is invalid
	// TODO: if this is unsecure, then must also drop the corresponding secure session
	console.log((new Date()) + " dropping connection as session was invalid");
	connection.drop(connection.CLOSE_REASON_NORMAL, "Session id not valid");
    }
}

function processMessage(self, connection, id, msg) {
    var messageProcessed = false;

    if(!connection.valid) {
	switch(id) {
	    case MSG_AUTHENTICATE:
		authenticateConnection(self, connection, msg);
		messageProcessed = true;
		break;

	    case MSG_SESSION:
		if(connection.secure && self.allCommsSecure) {
		    console.log((new Date()) + 
			' Invalid message, received session request, secure connection: ' + connection.secure + 
			' allCommsSecure: ' + self.allCommsSecure + 
			' connection valid: ' + connection.valid);
		} else {
		    validateSession(self, connection, msg);
		}
		messageProcessed = true;
		break;
	}
    } else {
	switch(id) {
	    case MSG_CHANGE_PWD:
		break;

	    case MSG_ADD_VEHICLE:
		rcvdAddVehicle(self, msg);
		break;

	    case MSG_DELETE_VEHICLE:
		rcvdDeleteVehicle(self, msg);
		break;

	    case MSG_UPDATE_VEHICLE:
		rcvdUpdateVehicle(self, msg);
		break;

	    case MSG_GET_VEHICLES:
		rcvdSendVehicles(self, connection);
	    break;

	    case MSG_GET_TELEMETERY:
		break;

	    case MSG_GET_PAYLOAD:
		break;

	    case MSG_CMD_EMERGENCY_STOP:
		break;

	    case MSG_CMD_LEFT:
		break;

	    case MSG_CMD_RIGHT:
		break;

	    case MSG_CMD_FORWARD:
		break;

	    case MSG_CMD_REVERSE:
		break;

	    case MSG_CMD_UP:
		break;

	    case MSG_CMD_DOWN:
		break;

	    default:
		console.log((new Date()) + ' Unknown message received for id : ' + id);
		break;
	}
    }
}

User = function (options) {
    options = options || {};

    this.salt = options.salt || 0;
    this.userId = options.userId || '';
    this.password = options.password || '';
}

/* 
 * load users
 */
User.load = function (filename) {
    var list = new Array();
    try {
	var dataJSON = JSON.parse(fs.readFileSync(filename));

	// the received JSON data will be object, not user instances, so convert
	// TODO: is this really required?

	for(i = 0, l = dataJSON.length; i < l; i++) {
	    list.push(new User(dataJSON[i]));
	}
    } catch(err) {
    }

    return list;
}

/* 
 * save users
 */
User.save = function (filename, list) {
    fs.writeFileSync(filename, JSON.stringify(list, null, '\t'));
}
