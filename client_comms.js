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
var fs           = require('fs');
var ws           = require('websocket').server;

// load common js files shared with the videre client
eval(fs.readFileSync('./videre-common/js/vehicle.js').toString());
eval(fs.readFileSync('./videre-common/js/videre_comms.js').toString());

module.exports = ClientComms;

util.inherits(ClientComms, EventEmitter);

function ClientComms(options) {
     EventEmitter.call(this);

     options = options || {};

     this.vehiclesStoredOnServer = options.vehiclesStoredOnServer || true;
     this.allowMultipleClients = options.allowMultipleClients || true;
     this.allowAddVehicle = options.allowAddVehicle || true;
     this.allowDeleteVehicle = options.allowDeleteVehicle || true;
     this.allowUpdateVehicle = options.allowUpdateVehicle || true;
}


ClientComms.prototype.startClientServer = function() {
    var httpServer = http.createServer(function(request, response) {
        console.log((new Date()) + ' Received request for ' + request.url);
        reponse.writeHead(404);
        reponse.end();
    });
    var self = this;

    httpServer.listen(9007, function() {
        console.log((new Date()) + ' Server is listening on port 9007');
    });

    this.server = new ws({
        httpServer: httpServer,
        autoAcceptConnections: false
    });

    this.server.on('request', function(request) {processConnectionAttempt(self, request);});
}

ClientComms.prototype.sendVehicles = function(connection, vehicles) {
    connection.send(Message.constructMessageJSON(MSG_VEHICLES, vehicles));
}

ClientComms.prototype.sendAddVehicle = function(vehicle) {
    this.server.broadcast(Message.constructMessageJSON(MSG_ADD_VEHICLE, vehicle));
}

ClientComms.prototype.sendDeleteVehicle = function(vehicle) {
    this.server.broadcast(Message.constructMessageJSON(MSG_DELETE_VEHICLE, vehicle));
}

ClientComms.prototype.sendUpdateVehicle = function(vehicle) {
    this.server.broadcast(Message.constructMessageJSON(MSG_UPDATE_VEHICLE, vehicle));
}

ClientComms.prototype.sendTelemetry = function(telemetry) {
    this.server.broadcast(Message.constructMessageJSON(MSG_VEHICLE_TELEMETERY, vehicle));
}

ClientComms.prototype.sendPayload = function(payload) {
    this.server.broadcast(Message.constructMessageJSON(MSG_VEHICLE_PAYLOAD, vehicle));
}

fireNewConnection = function(self, connection) {
    self.emit('newConnection', connection);
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


function processConnectionAttempt(self, request) {
    console.log((new Date()) + ' Connection attempt from origin ' + request.origin +
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

    // add the message listener
    connection.on('message', function(message) {processRawMessage(self, connection, message);});

    // add the connection close listener
    connection.on('close', processConnectionClosed);

    // fire the connection event
    fireNewConnection(self, connection);
}

function processConnectionClosed(reasonCode, description) {
    console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
}

function processRawMessage(self, connection, message) {
    if (message.type === 'utf8') {
	console.log((new Date()) + ' Received message: ' + message.utf8Data);

	// msg = JSON.parse(message.utf8Data);

	// deconstruct the message
	msg = Message.deconstructMessage(message.utf8Data);

	console.log((new Date()) + '          msg:  ' + msg);
	console.log((new Date()) + '          id:  ' + msg.id);
	console.log((new Date()) + '          msg: ' + msg.msg);

	processMessage(self, connection, msg.id, msg.msg);

	// the following is purely for testing 
	// connection.sendUTF(JSON.stringify({id: 'ack'}));

    }
    else if (message.type === 'binary') {
	console.log((new Date()) + ' Received binary message of ' + message.binaryData.length + ' bytes');
/	// connection.sendBytes(message.binaryData);
    }
}

function processMessage(self, connection, id, body) {
    // TODO: this presumes that the body is always json stringified, should this be so?
    var msg = JSON.parse(body);

    switch(id) {
	case MSG_ADD_VEHICLE:
	    // addVehicle(msg);
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

