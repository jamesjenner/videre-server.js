/*
 * videre_server.js v0.1 alpha
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

var videre_comms  = require('./videre-common/js/videre_comms.js');
// var vehicle       = require('./videre-common/js/vehicle.js');
var ClientComms   = require('./client_comms.js');
var fs            = require('fs');

var Parrot = require('./vehicle/parrotArDroneV1.js');

eval(fs.readFileSync('./videre-common/js/vehicle.js').toString());

var VEHICLES_FILE = 'vehicles.json';
// load the vehicle configs from the file
var vehicles = loadVehicles(VEHICLES_FILE);

// setup the client communications
clientComms = new ClientComms();

// listen for the events from clients
clientComms.on('addVehicle', function(d) {addVehicle(d);});
clientComms.on('deleteVehicle', function(d) {deleteVehicle(d);});
clientComms.on('updateVehicle', function(d) {updateVehicle(d);});
clientComms.on('sendVehicles', function(c) {sendVehicles(c);});
clientComms.on('newConnectionAccepted', function(c) {newConnection(c);});
/*
clientComms.on('vehicleTest', function(d) {x(d);});
clientComms.on('vehicleLand', function(d) {x(d);});
clientComms.on('vehicleAbort', function(d) {x(d);});
clientComms.on('vehicleLaunch', function(d) {x(d);});
clientComms.on('vehicleUp', function(d) {x(d);});
clientComms.on('vehicleDown', function(d) {x(d);});
clientComms.on('vehicleLeft', function(d) {x(d);});
clientComms.on('vehicleRight', function(d) {x(d);});
clientComms.on('vehicleForward', function(d) {x(d);});
clientComms.on('vehicleReverse', function(d) {x(d);});
clientComms.on('vehicleTurnLeft', function(d) {x(d);});
clientComms.on('vehicleTurnRight', function(d) {x(d);});
*/

// start up the server for clients
clientComms.startClientServer();

// startup the comms with the remote vehicles
var remoteVehicles = startVehicleComms(vehicles);

for(i = 0, l = remoteVehicles.length; i < l; i++) {
    remoteVehicles[i].on('telemetry', function(d) {processTelemetry(d);});
    remoteVehicles[i].testRun();
}

function startVehicleComms(vehicles) {
    var vehicleComms = new Array();
    var remoteVehicle = null;

    for(i = 0, l = vehicles.length; i < l; i++) {
        console.log("startVehicleComms: loading " + vehicles[i].name);

	remoteVehicle = null;

	switch(vehicles[i].deviceType) {
	    case(VEHICLE_DEVICE_PARROT_V1):
		// create the remote vehicle comms handler and map values from the common vehicle data
		remoteVehicle = new Parrot({
		    name: vehicles[i].name, 
		    address: "192.168.1.3"
	        });
		break;

	    // not implemented yet 
	    case(VEHICLE_DEVICE_PARROT_V2):
		break;

	    // unknown device type
	    default:
		console.log('videre-server: vehicle device ' + vehicles[i].deviceType + ' not supported for vehicle ' + vehicles[i].name);
		break;
	}

	if (remoteVehicle) {
            vehicleComms.push(remoteVehicle);

	    remoteVehicle.on('telemetry', function(d) {processTelemetry(d);});
	    remoteVehicle.on('payload', function(d) {processPayload(d);});
	}
    }

    return vehicleComms;
}

/* 
 * load vehicles
 */
function loadVehicles(filename) {
    var data = fs.readFileSync(filename);

    var dataJSON = JSON.parse(data);

    // the received JSON data will be object, not vehicle instances, so convert
    // may not need to do this as there is no prototype on Vehicles, so could be treated just as an object...
    var vehicles = new Array();

    for(i = 0, l = dataJSON.length; i < l; i++) {
        vehicles.push(new Vehicle(dataJSON[i]));
    }

    return vehicles;
}

/* 
 * save vehicles
 */
function saveVehicles(filename) {
    fs.writeFileSync(filename, JSON.stringify(vehicles, null, '\t'));
}

// add a watchdog to check if vehicles get add
function addVehicle(msg) {
    console.log((new Date()) + ' Adding vehicle ' + msg.name);
    vehicles.push(new Vehicle(msg));

    saveVehicles(VEHICLES_FILE);

    clientComms.sendAddVehicle(msg);
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

    saveVehicles(VEHICLES_FILE);
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

    saveVehicles(VEHICLES_FILE);
}

function sendVehicles(connection) {
    clientComms.sendVehicles(connection, vehicles);
}

function newConnection(connection) {
    // on a new connection send the vehicles to the client
    clientComms.sendVehicles(connection, vehicles);
}

/*
 * process telemetry
 *
 * capture telemetry and pass to the clients
 *
 * note: some devices may pass payload and telemetry together
 */
function processTelemetry(d) {
    console.log('videre-server: telemetry...');
    console.log(d);
}

/*
 * process payload
 *
 * capture payload and pass to the clients
 *
 * note: some devices may pass payload and telemetry together
 */
function processPayload(d) {
    console.log('videre-server: payload...');
    console.log(d);
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
