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

var fs = require('fs');

// load common js files shared with the videre client
eval(fs.readFileSync('./videre-common/js/vehicle.js').toString());
eval(fs.readFileSync('./videre-common/js/videre_comms.js').toString());

var ws = require('websocket').server;
var http = require('http');

var vehicles = new Array();

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

var MSG_ADD_VEHICLE = 'addVehicle';
function processMessage(id, body) {
    var msg = JSON.parse(body);

    switch(id) {
	case MSG_ADD_VEHICLE:
	    addVehicle(msg);
	    break;

	case MSG_DELETE_VEHICLE:
	    deleteVehicle(msg);
	    break;

	case MSG_UPDATE_VEHICLE:
	    updateVehicle(msg);
	    break;

	case MSG_GET_VEHICLES:
	    sendVehicles();
	    break;

	case MSG_GET_TELEMETERY:
	    sendTelemetery();
	    break;

	case MSG_GET_PAYLOAD:
	    sendPayload();
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

function addVehicle(msg) {
    var i = vehicles.length;
    vehicles[i] = new Vehicle(msg);
    console.log((new Date()) + ' Adding vehicle ' + msg.name);
}

function deleteVehicle(msg) {
    // if the message isn't set and the name isn't set then do nothing
    if(!msg && !msg.name) {
        console.log((new Date()) + ' Delete vehicle failed, msg.name is not specififed.');
	return;
    }

    // find the vehicle
    var position = findVehicle(msg.name);

    // remove from the array if found
    if(position >= 0) {
        vehicles.splice(position, 1);
    } else {
        console.log((new Date()) + ' Delete vehicle failed, vehicle not found for: ' + msg.name);
    }
}

function updateVehicle(msg) {
    // if the message isn't set and the name isn't set then do nothing
    if(!msg && !msg.name) {
        console.log((new Date()) + ' Update vehicle failed, msg.name is not specififed.');
	return;
    }

    // find the vehicle
    var position = findVehicle(msg.name);

    if(position >= 0) {
        vehicles[position] = new Vehicle(msg);
    } else {
        console.log((new Date()) + ' Update vehicle failed, vehicle not found for: ' + msg.name);
    }
}

/** 
 * find Vehicle - finds the vehicle based on it's name
 * 
 * returns -1 if not found, otherwise the position in the vehicles array
 */
function findVehicle(name) {
    var position = -1;

    // if name isn't set then return
    if(!name) {
	return position;
    }

    for(var i = 0, l = vehicles.length; i < l; i++) {
	if(vehicles[i].name === name) {
	    position = i;
	    break;
	}
    }

    return position;
}

/** 
 * send Vehicles - send all the vehicles 
 */
function sendVehicles() {
}

/** 
 * send Telemetery - send the telemetery 
 * 
 * vehicleNbr   the vehicle to send telemetery for, if specified
 */
function sendTelemetery(vehicleNbr) {
}

/** 
 * send Payload - send the most recent payload information
 * 
 * vehicleNbr   the vehicle to send payload for, if specified
 */
function sendPayload(vehicleNbr {
}
