/*
 * client_comms.js
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

var EventEmitter = require('events').EventEmitter;
var util         = require('util');
var http         = require('http');
var https        = require('https');
var fs           = require('fs');
var ws           = require('websocket').server;
var uuid         = require('node-uuid');
var crypto       = require('crypto');
var bcrypt       = require('bcrypt');

var Message      = require('./videre-common/js/message.js');
var Vehicle      = require('./videre-common/js/vehicle.js');

var USERS_FILE = 'users.json';
var users = null;

module.exports = ClientComms;

util.inherits(ClientComms, EventEmitter);

function ClientComms(options) {
    EventEmitter.call(this);

    options = options || {};

    this.allowAddVehicle  = ((options.allowAddVehicle != null) ? options.allowAddVehicle : true);
    this.allowDeleteVehicle = ((options.allowDeleteVehicle != null) ? options.allowDeleteVehicle : true);
    this.allowUpdateVehicle = ((options.allowUpdateVehicle != null) ? options.allowUpdateVehicle : true);

    this.port = options.port || 9007; // 80?
    this.securePort = options.securePort || 9008; // 443?
    this.communicationType = options.communicationType || Message.COMMS_TYPE_UNSECURE_ONLY;
    this.uuidV1 = ((options.uuidV1  != null) ? options.uuidV1 : false);
    this.sslKey = options.sslKey || 'keys/privatekey.pem';
    this.sslCert = options.sslCert || 'keys/certificate.pem';
    this.debug = ((options.debug != null) ? options.debug : false);
    this.debugLevel = options.debugLevel || 0;

    this.loggingIn = ((options.analysisLogIn != null) ? true : false);
    this.loggerIn = options.analysisLogIn;

    this.loggingOut = ((options.analysisLogOut != null) ? true : false);
    this.loggerOut = options.analysisLogOut;

    if(this.communicationType !== Message.COMMS_TYPE_UNSECURE_ONLY) {
	if(!fs.existsSync(this.sslKey)) {
	    console.log((new Date()) + 'WARNING: cannot find file ' + this.sslKey + ', setting communication mode to UNSECURE ONLY');
	    this.communicationType = Message.COMMS_TYPE_UNSECURE_ONLY;
	}
	if(!fs.existsSync(this.sslCert)) {
	    console.log((new Date()) + 'WARNING: cannot find file ' + this.sslCert + ', setting communication mode to UNSECURE ONLY');
	    this.communicationType = Message.COMMS_TYPE_UNSECURE_ONLY;
	}
    }

    users = User.load(USERS_FILE);
}


ClientComms.prototype.startClientServer = function() {
    var self = this;

    self.secureOnly = self.communicationType === Message.COMMS_TYPE_SECURE_ONLY;
    self.unsecureOnly = self.communicationType === Message.COMMS_TYPE_UNSECURE_ONLY;
    self.secureAndUnsecure = self.communicationType === Message.COMMS_TYPE_MIXED;

    // only start up the secure server if it is required
    if(self.secureOnly || self.secureAndUnsecure) {
        var sslOptions = {};

	sslOptions = {
	    key: fs.readFileSync(self.sslKey),
	    cert: fs.readFileSync(self.sslCert)
	};

	// setup a https server
	var httpsServer = https.createServer(sslOptions, function(request, response) {
	    if(self.debug) {
		console.log((new Date()) + ' Https server received request for ' + request.url);
	    }
	    response.writeHead(404);
	    response.end();
	});

	httpsServer.listen(self.securePort, function() {
	    if(self.debug) {
		console.log((new Date()) + ' Https server is listening on port ' + self.securePort);
	    }
	    // note that we currently do not reply with 404, perhaps we should
	});

	// setup the secure server for websockets
	self.secureServer = new ws({
	    httpServer: httpsServer,
	    autoAcceptConnections: false
	});

	// add the listener for connection attempts
	self.secureServer.on('request', function(request) { processConnectionAttempt(self, request, true); });
    }

    // only start up the unsecure comms if not all comms are to be secure
    if(self.secureAndUnsecure || self.unsecureOnly) {
	// setup a http server
	var httpServer = http.createServer(function(request, response) {
	    if(self.debug) {
		console.log((new Date()) + ' Http server received request for ' + request.url);
	    }
	    response.writeHead(404);
	    response.end();
	});

	httpServer.listen(self.port, function() {
	    if(self.debug) {
		console.log((new Date()) + ' http server is listening on port ' + self.port);
	    }
	});

	// setup the unsecure server for websockets
	self.unsecureServer = new ws({
	    httpServer: httpServer,
	    autoAcceptConnections: false
	});

	// add the listener for connection attempts
	self.unsecureServer.on('request', function(request) { processConnectionAttempt(self, request, false); });
    }
}

ClientComms.prototype.sendVehicles = function(connection, vehicles) {
    if(this.debug && this.debugLevel > 4) {
	console.log((new Date()) + ' Sending id: ' + Message.VEHICLES + ' body: ' + JSON.stringify(vehicles));
    }
    connection.send(Message.constructMessage(Message.VEHICLES, vehicles));
}

ClientComms.prototype.sendVehicleDeviceTypes = function(connection, vehicleDeviceTypes) {
    if(this.debug && this.debugLevel > 4) {
	console.log((new Date()) + ' Sending id: ' + Message.VEHICLE_DEVICE_TYPES + ' body: ' + JSON.stringify(vehicleDeviceTypes));
    }
    connection.send(Message.constructMessage(Message.VEHICLE_DEVICE_TYPES, vehicleDeviceTypes));
}

ClientComms.prototype.sendVehicleComms = function(connection, vehicleComms) {
    if(this.debug && this.debugLevel > 4) {
	console.log((new Date()) + ' Sending id: ' + Message.VEHICLE_COMMS + ' body: ' + JSON.stringify(vehicleComms));
    }
    connection.send(Message.constructMessage(Message.VEHICLE_COMMS, vehicleComms));
}

ClientComms.prototype.sendAddVehicle = function(vehicle) {
    this._constructAndBroadcastMsg(Message.ADD_VEHICLE, vehicle, 4);
}

ClientComms.prototype.sendDeleteVehicle = function(vehicle) {
    this._constructAndBroadcastMsg(Message.DELETE_VEHICLE, vehicle, 4);
}

ClientComms.prototype.sendUpdateVehicle = function(vehicle) {
    this._constructAndBroadcastMsg(Message.UPDATE_VEHICLE, vehicle, 4);
}

ClientComms.prototype.sendUpdateNavPath = function(id, navigationPath) {
    this._constructAndBroadcastMsg(Message.UPDATE_NAV_PATH, {id: id, navigationPath: navigationPath}, 4);
}

// TODO: possibly not used
ClientComms.prototype.sendNavPathUpdated = function(connection, id) {
    if(this.debug && this.debugLevel > 4) {
	console.log((new Date()) + ' Sending id: ' + Message.NAV_PATH_UPDATED + ' body: ' + JSON.stringify(id));
    }
    connection.send(Message.constructMessage(Message.NAV_PATH_UPDATED, id));

    if(this.loggingOut) {
	this.loggerOut.info('send: ' + connection.remoteAddress + ':' + id + ' nav path updated');
    }
}

ClientComms.prototype.sendTelemetry = function(id, telemetry) {
    this._constructAndBroadcastMsg(Message.VEHICLE_TELEMETRY, {id: id, telemetry: telemetry}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: ' + id + ' vehicle telemetry: ', telemetry);
    }
}

ClientComms.prototype.sendPosition = function(id, position) {
    this._constructAndBroadcastMsg(Message.CURRENT_POSITION, {id: id, position: position}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: ' + id + ' current position: ', position);
    }
}

ClientComms.prototype.sendPositionToConnection = function(connection, id, position) {
    connection.send(Message.constructMessage(Message.CURRENT_POSITION, {id: id, position: position}, 4));

    if(this.loggingOut) {
	this.loggerOut.info('send: ' + connection.remoteAddress + ':' + id + ' current position: ', position);
    }
}

ClientComms.prototype.sendPayload = function(id, payload) {
    this._constructAndBroadcastMsg(Message.VEHICLE_PAYLOAD, {id: id, payload: payload}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: ' + id + ' vehicle payload: ', payload);
    }
}

ClientComms.prototype.sendState = function(id, state) {
    this._constructAndBroadcastMsg(Message.VEHICLE_STATE, {id: id, state: state}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: ' + id + ' vehicle state: ', state);
    }
}

ClientComms.prototype.sendWaypointSetError = function(id, text) {
    // this._constructAndBroadcastMsg(Message.VEHICLE_PAYLOAD, {id: id, payload: payload}, 4);
}

ClientComms.prototype.sendWaypointAchieved = function(id, sequence) {
    this._constructAndBroadcastMsg(Message.NAV_PATH_WAYPOINT_ACHIEVED, {id: id, sequence: sequence}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: ' + id + ' nav path waypoint achieved: ', sequence);
    }
}

ClientComms.prototype.sendWaypointTargeted = function(id, sequence) {
    this._constructAndBroadcastMsg(Message.NAV_PATH_SET_TARGETED, {id: id, sequence: sequence}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: ' + id + ' nav path waypoint targeted: ', sequence);
    }
}

ClientComms.prototype.sendStatusMsg = function(id, severity, text) {
    this._constructAndBroadcastMsg(Message.VEHICLE_STATUS_MSG, {id: id, severity: severity, text: text}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: ' + id + ' vehicle status msg: severity: ' +  severity + ' : ' + text);
    }
}

ClientComms.prototype._broadcastMsg = function(msg) {
    if(this.secureAndUnsecure || this.unsecureOnly) {
	this.unsecureServer.broadcast(msg);
    } else {
	this.secureServer.broadcast(msg);
    }
}

ClientComms.prototype._constructAndBroadcastMsg = function(msgId, body, dbgLvl) {
    var msg = Message.constructMessage(msgId, body);

    if(this.debug && this.debugLevel >= dbgLvl) {
	console.log((new Date()) + ' Sending id: ' + JSON.stringify(msgId));
    }

    this._broadcastMsg(msg);
}

ClientComms.prototype.sendConnecting = function(vehicle) {
    this._constructAndBroadcastMsg(Message.VEHICLE_CONNECTING, {id: vehicle.id}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: vehicle connecting: ' + vehicle.id);
    }
}

ClientComms.prototype.sendConnected = function(vehicle) {
    this._constructAndBroadcastMsg(Message.VEHICLE_CONNECTED, {id: vehicle.id}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: vehicle connected: ' + vehicle.id);
    }
}

ClientComms.prototype.sendDisconnecting = function(vehicle) {
    this._constructAndBroadcastMsg(Message.VEHICLE_DISCONNECTING, {id: vehicle.id}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: vehicle disconnecting: ' + vehicle.id);
    }
}

ClientComms.prototype.sendDisconnected = function(vehicle) {
    this._constructAndBroadcastMsg(Message.VEHICLE_DISCONNECTED, {id: vehicle.id}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: vehicle disconnected: ' + vehicle.id);
    }
}

ClientComms.prototype.sendReconnecting = function(vehicle) {
    this._constructAndBroadcastMsg(Message.VEHICLE_RECONNECTING, {id: vehicle.id}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: vehicle reconnecting: ' + vehicle.id);
    }
}

ClientComms.prototype.sendLaunching = function(vehicle) {
    this._constructAndBroadcastMsg(Message.VEHICLE_LAUNCHING, {id: vehicle.id}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: vehicle launching: ' + vehicle.id);
    }
}

ClientComms.prototype.sendLaunched = function(vehicle) {
    this._constructAndBroadcastMsg(Message.VEHICLE_LAUNCHED, {id: vehicle.id}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: vehicle launched: ' + vehicle.id);
    }
}

ClientComms.prototype.sendLanding = function(vehicle) {
    this._constructAndBroadcastMsg(Message.VEHICLE_LANDING, {id: vehicle.id}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: vehicle landing: ' + vehicle.id);
    }
}

ClientComms.prototype.sendLanded = function(vehicle) {
    this._constructAndBroadcastMsg(Message.VEHICLE_LANDED, {id: vehicle.id}, 4);

    if(this.loggingOut) {
	this.loggerOut.info('broadcast: vehicle landed: ' + vehicle.id);
    }
}

fireNewConnection = function(self, connection) {
    self.emit('newConnection', connection);

    if(self.loggingIn) {
	self.loggerIn.info('new connection: ', connection.remoteAddress + ' protocol: ' + connection.protocol);
    }
}

fireNewConnectionAuthenticated = function(self, connection) {
    self.emit('newConnectionAuthenticated', connection);

    if(self.loggingIn) {
	self.loggerIn.info('new connection authenticated: ', connection.remoteAddress + ' protocol: ' + connection.protocol);
    }
}

fireNewConnectionAccepted = function(self, connection) {
    self.emit('newConnectionAccepted', connection);

    if(self.loggingIn) {
	self.loggerIn.info('new connection accepted: ', connection.remoteAddress + ' protocol: ' + connection.protocol);
    }
}

rcvdAddVehicle = function(self, data) {
    self.emit('addVehicle', data);
}

rcvdDeleteVehicle = function(self, data) {
    self.emit('deleteVehicle', data);
}

rcvdUpdateVehicle = function(self, data) {
    self.emit('updateVehicle', data);

    if(self.loggingIn) {
	self.loggerIn.info('update vehicle', data);
    }
}

rcvdUpdateNavPath = function(self, data) {
    self.emit('updateNavPath', data);

    if(self.loggingIn) {
	self.loggerIn.info('nav path update', data);
    }
}

rcvdNavPathSetTargeted = function(self, data) {
    self.emit('navPathSetTargeted', data);

    if(self.loggingIn) {
	self.loggerIn.info('nav path set targeted', data);
    }
}

rcvdSendVehicles = function(self, connection) {
    self.emit('sendVehicles', connection);

    if(self.loggingIn) {
	self.loggerIn.info('send vehicles', connection);
    }
}

rcvdPerformTest = function(self, data) {
    self.emit('vehicleTest', data);
}

rcvdArm = function(self, data) {
    self.emit('vehicleArm', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle arm', data);
    }
}

rcvdDisarm = function(self, data) {
    self.emit('vehicleDisarm', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle disarm', data);
    }
}

rcvdLand = function(self, data) {
    self.emit('vehicleLand', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle land', data);
    }
}

rcvdAbort = function(self, data) {
    self.emit('vehicleAbort', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle abort', data);
    }
}

rcvdLaunch = function(self, data) {
    self.emit('vehicleLaunch', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle launch', data);
    }
}

rcvdHalt = function(self, data) {
    self.emit('vehicleHalt', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle halt', data);
    }
}

rcvdGo = function(self, data) {
    self.emit('vehicleGo', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle go', data);
    }
}

rcvdRebootAutopilot = function(self, data) {
    self.emit('vehicleRebootAutopilot', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle reboot autopilot', data);
    }
}

rcvdReboot = function(self, data) {
    self.emit('vehicleReboot', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle reboot', data);
    }
}

rcvdShutdownAutopilot = function(self, data) {
    self.emit('vehicleShutdownAutopilot', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle shutdown autopilot', data);
    }
}

rcvdShutdown = function(self, data) {
    self.emit('vehicleShutdown', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle shutdown', data);
    }
}

rcvdSetAutonomousMode = function(self, data) {
    self.emit('vehicleSetAutonomousMode', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle set autonomous mode', data);
    }
}

rcvdSetTestMode = function(self, data) {
    self.emit('vehicleSetTestMode', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle set test mode', data);
    }
}

rcvdSetStabilizedMode = function(self, data) {
    self.emit('vehicleSetStabilizedMode', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle set stabilized mode', data);
    }
}

rcvdSetHardwareInLoopMode = function(self, data) {
    self.emit('vehicleSetHardwareInLoopMode', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle set hardware in loop mode', data);
    }
}

rcvdSetRemoteControlMode = function(self, data) {
    self.emit('vehicleSetRemoteControlMode', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle set remote control mode', data);
    }
}

rcvdSetGuidedMode = function(self, data) {
    self.emit('vehicleSetGuidedMode', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle set guided mode', data);
    }
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
rcvdTurnLeft = function(self, data) {
    self.emit('vehicleTurnLeft', data);
}

rcvdTurnRight = function(self, data) {
    self.emit('vehicleTurnRight', data);
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

rcvdReset = function(self, data) {
    self.emit('vehicleReset', data);
}

rcvdDisconnect = function(self, data) {
    self.emit('vehicleDisconnect', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle disconnect', data);
    }
}

rcvdReconnect = function(self, data) {
    self.emit('vehicleReconnect', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle reconnect', data);
    }
}

rcvdConnect = function(self, data) {
    self.emit('vehicleConnect', data);

    if(self.loggingIn) {
	self.loggerIn.info('vehicle connect', data);
    }
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

function processConnectionAttempt(self, request, isSecure) {
    if(self.debug) {
	console.log((new Date()) + ' Connection attempt from origin ' + request.origin +
	      ', secure: ' + isSecure + 
	      ', websocket ver: ' + request.webSocketVersion + 
	      ', protocols : ' + request.requestedProtocols.length + 
	      ' : ' + request.requestedProtocols);
    }

    if(!originIsAllowed(request.origin)) {
	// make sure we only accept requests from an allowed origin
	request.reject();
	if(self.debug) {
	    console.log((new Date()) + ' Connection rejected, invalid origin: ' + request.origin);
	}
	return;
    }

    var connection = null;

    // process protocols
    for(var i=0, l=request.requestedProtocols.length; i < l; i++) {
	if(request.requestedProtocols[i] === 'videre_1.1') {
            connection = request.accept(request.requestedProtocols[i], request.origin);
	    connection.verified = false;
	    connection.isSecure = isSecure;
	    break;
	}
    }

    // test if no connection was created, due to no protocol match
    if(!connection) {
	if(self.debug) {
	    console.log((new Date()) + ' Connection rejected, invalid protocol(s): ' + request.requestedProtocols);
	}
        connection = request.reject();
	return;
    }

    if(self.debug) {
	console.log((new Date()) + ' Connection accepted, protocol: ' + connection.protocol);
    }

    // add the message listener
    connection.on('message', function(message) { connectionIsValid = processRawMessage(self, connection, message); } );

    // add the connection close listener
    connection.on('close', function(reasonCode, description) {processConnectionClosed(connection, reasonCode, description);});

    // fire the connection event
    fireNewConnection(self, connection);
}

function processConnectionClosed(connection, reasonCode, description) {
    if(this.debug) {
	console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected: ' + reasonCode + ", " + description);
    }
}

function processRawMessage(self, con, message) {
    if (message.type === 'utf8') {
	if(self.debug && self.debugLevel > 3) {
	    console.log((new Date()) + ' Received message: ' + message.utf8Data);
	}

	// deconstruct the message
	msg = Message.deconstructMessage(message.utf8Data);

	processMessage(self, con, msg.id, msg.body);
    }
    else if (message.type === 'binary') {
	if(self.debug) {
	    console.log((new Date()) + ' Received binary message of ' + message.binaryData.length + ' bytes');
	}
	// con.sendBytes(message.binaryData);
    }
    else {
	if(self.debug) {
	    console.log((new Date()) + ' Received unknown message type ' + message.type);
	}
    }
}

function authenticateConnection(self, connection, msgBody) {
    var validUser = false;
    var foundUser = false;
    var salt = null;
    var password = null;

    var clientConnectionType = msgBody.connectionType;

    var user = new User({userId: msgBody.userId, password: msgBody.password});

    if(!clientConnectionType) {
	connection.send(Message.constructMessage(Message.AUTHENTICATION_REJECTED, "athentication message malformed"));
	connection.drop(connection.CLOSE_REASON_NORMAL, "authentication message malformed");
	return;
    }

    switch(clientConnectionType) {
	case Message.COMMS_TYPE_SECURE_ONLY:
	    if(self.unsecureOnly) {
		connection.send(Message.constructMessage(Message.AUTHENTICATION_REJECTED, "Server only allows unsecure connections"));
		connection.drop(connection.CLOSE_REASON_NORMAL, "Server only allows unsecure connections");
		return;
	    }
	    break;

	case Message.COMMS_TYPE_UNSECURE_ONLY:
	    if(self.secureOnly) {
		connection.send(Message.constructMessage(Message.AUTHENTICATION_REJECTED, "Server only allows secure connections"));
		connection.drop(connection.CLOSE_REASON_NORMAL, "Server only allows secure connections");
		return;
	    }
	    break;

	case Message.COMMS_TYPE_MIXED:
	    if(!connection.isSecure) {
		connection.send(Message.constructMessage(Message.AUTHENTICATION_REJECTED, "Requested mixed comms while authentication is via unsecure connection"));
		connection.drop(connection.CLOSE_REASON_NORMAL, "Requested mixed comms while authentication is via unsecure connection");
		return;
	    }
	    break;
    }

    if(!users || users.length == 0) {
	if(self.debug) {
	    console.log((new Date()) + ' No users so creating user for : ' + user.userId);
	}
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
	if(self.debug) {
	    console.log((new Date()) + ' authentication for user ' + user.userId + ' successful');
	}

	// fire the connection event
	fireNewConnectionAuthenticated(self, connection);

	// only create a session if all comms are mixed (ie comms are shared between ws and wss)
	if(self.secureOnly || 
	    self.unsecureOnly || 
	    (clientConnectionType === Message.COMMS_TYPE_UNSECURE_ONLY && !connection.isSecure) || 
	    (clientConnectionType === Message.COMMS_TYPE_SECURE_ONLY && connection.isSecure)) {
	    // fire the connection accepted event
	    if(self.debug) {
		console.log((new Date()) + ' sending accept');
	    }
	    fireNewConnectionAccepted(self, connection);
	    connection.verified = true;
	    var body = {sessionId: '', connectionType: self.communicationType};
	    connection.send(Message.constructMessage(Message.AUTHENTICATION_ACCEPTED, body));
	} else {
	    // create a session key
	    var sessionId = generateSession(self, connection);

	    // send the session key back
	    if(self.debug) {
		console.log((new Date()) + ' sending session ' + sessionId);
	    }
	    var body = {sessionId: sessionId, connectionType: self.communicationType};
	    connection.send(Message.constructMessage(Message.AUTHENTICATION_ACCEPTED, body));
	}
    } else {
	if(self.debug) {
	    console.log((new Date()) + ' authentication for user ' + user.userId + ' unsuccessful');
	}

	// validation failed, reject the connection
	connection.send(Message.constructMessage(Message.AUTHENTICATION_REJECTED));
	connection.drop(connection.CLOSE_REASON_NORMAL, "authentication failed");
    }
}

var sessions = new Array();

function generateSession(self, connection) {
    currentTime = Date.now();

    if(self.debug) {
	console.log((new Date()) + ' generating session id for ' + (self.uudiV1 ? 'UUID V1' : 'UUID V4 RNG') + ' @ ' + currentTime);
    }

    var session = new Object();
    session.time = currentTime;
    session.address = connection.remoteAddress;
    session.secureConnection = connection;

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
    if(self.debug) {
	console.log((new Date()) + " Checking for old sessions");
    }
    for(i = 0; i < sessions.length; i++) {
	if(sessions[i].time < validTimeCompare) {
	    if(self.debug) {
		console.log((new Date()) + " \tremoving session: " + sessions[i].sessionId + " : " + sessions[i].time);
	    }
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
	    connection.verified = true;
	    // the secure connection must be updated and set to verified, otherwise it will think it isn't
	    sessions[i].secureConnection.verified = true;
	}
	// remove the entry, either it's invalid or it's valid and being used
	sessions.splice(idx, 1);
    }

    if(connection.verified) {
	connection.send(Message.constructMessage(Message.SESSION_CONFIRMED));
	// fire the connection accepted event
	fireNewConnectionAccepted(self, connection);
    } else {
	// disconnect as the session id is invalid
	// TODO: if this is unsecure, then must also drop the corresponding secure session
	if(self.debug) {
	    console.log((new Date()) + " dropping connection as session was invalid");
	}
	connection.drop(connection.CLOSE_REASON_NORMAL, "Session id not valid");
    }
}

function processMessage(self, connection, id, msg) {
    if(!connection.verified) {
	switch(id) {
	    case Message.AUTHENTICATE:
		authenticateConnection(self, connection, msg);
		break;

	    case Message.SESSION:
		if(connection.isSecure && self.secureOnly) {
		    if(self.debug) {
			console.log((new Date()) + 
			    ' Invalid message, received session request, secure connection: ' + connection.isSecure);
		    }
		} else {
		    validateSession(self, connection, msg);
		}
		break;

	    default:
		if(self.debug) {
		    console.log((new Date()) + 
			' Unknown message received ' + id + ', secure connection: ' + connection.isSecure);
		}
		break;
	}
    } else {
	console.log((new Date()) + 
	    ' message received ' + id + ' ' + msg);
	switch(id) {
	    case Message.CHANGE_PWD:
		break;

	    case Message.ADD_VEHICLE:
		rcvdAddVehicle(self, msg);
		break;

	    case Message.DELETE_VEHICLE:
		rcvdDeleteVehicle(self, msg);
		break;

	    case Message.UPDATE_VEHICLE:
		rcvdUpdateVehicle(self, msg);
		break;

	    case Message.UPDATE_NAV_PATH:
		rcvdUpdateNavPath(self, msg);
		break;

	    case Message.NAV_PATH_SET_TARGETED:
		rcvdNavPathSetTargeted(self, msg);
		break;

	    case Message.GET_VEHICLES:
		rcvdSendVehicles(self, connection);
		break;

	    case Message.GET_TELEMETERY:
		break;

	    case Message.GET_PAYLOAD:
		break;

	    case Message.CMD_EMERGENCY_STOP:
		rcvdAbort(self, msg);
		break;

	    case Message.CMD_LAUNCH:
		rcvdLaunch(self, msg);
		break;

	    case Message.CMD_LAND:
		rcvdLand(self, msg);
		break;

	    case Message.CMD_HALT:
		rcvdHalt(self, msg);
		break;

	    case Message.CMD_GO:
		rcvdGo(self, msg);
		break;

	    case Message.CMD_REBOOT_AUTOPILOT:
		rcvdRebootAutopilot(self, msg);
		break;

	    case Message.CMD_REBOOT:
		rcvdReboot(self, msg);
		break;

	    case Message.CMD_SHUTDOWN_AUTOPILOT:
		rcvdShutdownAutopilot(self, msg);
		break;

	    case Message.CMD_SHUTDOWN:
		rcvdShutdown(self, msg);
		break;

	    case Message.CMD_ARM:
		rcvdArm(self, msg);
		break;

	    case Message.CMD_DISARM:
		rcvdDisarm(self, msg);
		break;

	    case Message.CMD_SET_AUTONOMOUS_MODE:
		rcvdSetAutonomousMode(self, msg);
		break;

	    case Message.CMD_SET_TEST_MODE:
		rcvdSetTestMode(self, msg);
		break;

	    case Message.CMD_SET_STABILIZED_MODE:
		rcvdSetStabilizedMode(self, msg);
		break;

	    case Message.CMD_SET_HIL_MODE:
		rcvdSetHardwareInLoopMode(self, msg);
		break;

	    case Message.CMD_SET_REMOTE_CONTROL_MODE:
		rcvdSetRemoteControlMode(self, msg);
		break;

	    case Message.CMD_SET_GUIDED_MODE:
		rcvdSetGuidedMode(self, msg);
		break;

	    case Message.CMD_LEFT:
		rcvdLeft(self, msg);
		break;

	    case Message.CMD_RIGHT:
		rcvdRight(self, msg);
		break;

	    case Message.CMD_TURN_LEFT:
		rcvdTurnLeft(self, msg);
		break;

	    case Message.CMD_TURN_RIGHT:
		rcvdTurnRight(self, msg);
		break;

	    case Message.CMD_FORWARD:
		rcvdForward(self, msg);
		break;

	    case Message.CMD_REVERSE:
		rcvdReverse(self, msg);
		break;

	    case Message.CMD_UP:
		rcvdUp(self, msg);
		break;

	    case Message.CMD_DOWN:
		rcvdDown(self, msg);
		break;

	    case Message.VEHICLE_RESET:
		rcvdReset(self, msg);
		break;

	    case Message.VEHICLE_DISCONNECT:
		rcvdDisconnect(self, msg);
		break;

	    case Message.VEHICLE_RECONNECT:
		rcvdReconnect(self, msg);
		break;

	    case Message.VEHICLE_CONNECT:
		rcvdConnect(self, msg);
		break;

	    default:
		if(self.debug) {
		    console.log((new Date()) + 
			' Unknown message received ' + id + ', secure connection: ' + connection.isSecure);
		}
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
