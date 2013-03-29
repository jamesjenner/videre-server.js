/*
 * videre_server.js
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

var ClientComms       = require('./client_comms.js');
var fs                = require('fs');
var path              = require('path');
var opt               = require('opt').create();
var uuid              = require('node-uuid');

var Vehicle           = require('./videre-common/js/vehicle.js');
var Message           = require('./videre-common/js/message.js');

var Drone             = require('./videre-common/js/drone.js');
var DroneCapabilities = require('./videre-common/js/droneCapabilities.js');
var Path              = require('./videre-common/js/path.js');
var VehicleDriverRegister   = require('./vehicle/register.js');

var UnmannedVehicle   = require('./vehicle/unmannedVehicle.js');

var VEHICLES_FILE = 'vehicles.json';
// load the vehicle configs from the file
var vehicles = loadVehicles(VEHICLES_FILE);

var vehicleDriverRegister = new VehicleDriverRegister();

/* options handling */
// TODO: look at replacing or extending opt, would like error on invalid arg, exclusivity of args, better formatting of help, etc

var config = {
    debug: false,
    debugLevel: 0,
    addVehicleEnabled: true,
    deleteVehicleEnabled: true,
    updateVehicleEnabled: true,
    telemetryTimer: 1000,
    port: 9007,
    securePort: 9008,
    uuidV1: false,
    communicationType: Message.COMMS_TYPE_MIXED,
    sslKey: 'keys/privatekey.pem',
    sslCert: 'keys/certificate.pem'
};

var search_paths = [
    "videre-server.conf",
    path.join(process.env.HOME, ".videre-server-rc"),
    "/usr/local/etc/videre-server.conf",
    "/usr/etc/videre-server.conf",
    "/etc/videre-server.conf" 
];

opt.configSync(config, search_paths);

opt.optionHelp("USAGE node " + path.basename(process.argv[1]),
    "SYNOPSIS: Videre server provides connecitvity between videre clients and drones.\n\n\t\t node " 
	 + path.basename(process.argv[1]) + " --help",
    "OPTIONS:",
    "Copyright (c) 2012 James G Jenner, all rights reserved\n" + 
    " Released under GNU General Public License, version 3.\n" +
    " See: http://www.gnu.org/licenses/\n");

opt.option(["-d", "--debug"], function (param) {
    config.debug = true;
    if (Number(param).toFixed(0) > 0) {
	config.debugLevel = Number(param).toFixed(0);
	opt.consume(param);
    } else {
	config.debugLevel = 0;
    }
}, "Generate debugging messages, level is optional. 0 - informational, 1 - detailed");

opt.option(["-va", "--add-vehicles"], function (param) {
    config.allowAddVehicle = true;
}, "Allow clients to add vehicles");

opt.option(["-vd", "--delete-vehicles"], function (param) {
    config.allowDeleteVehicle = true;
}, "Allow clients to delete vehicles");

opt.option(["-vu", "--update-vehicles"], function (param) {
    config.allowUpdateVehicle = true;
}, "Allow clients to update vehicles");

opt.option(["-so", "--secure-only"], function (param) {
    config.communicationType = Message.COMMS_TYPE_SECURE_ONLY;
}, "Set communications to only accept secure connections");

opt.option(["-m", "--mixed"], function (param) {
    config.communicationType = Message.COMMS_TYPE_MIXED;
}, "Set communications to accept secure and unsecure connections");

opt.option(["-u1", "--uuid-v1"], function (param) {
    config.uuidV1 = true;
}, "Set uuid generation for session keys to uuid v1, default is v4");

opt.option(["-t", "--telemetry-time"], function (param) {
    if (Number(param).toFixed(0) > 0) {
	config.telemetryTimer = Number(param).toFixed(0);
	opt.consume(param);
    } else {
	opt.usage("Telemetry timer must be a number greater then 0.", 1);
    }
}, "Set the timer for sending telemetry to clients, in milliseconds");

opt.option(["-p", "--port"], function (param) {
    if (Number(param).toFixed(0) > 0) {
	config.port = Number(param).toFixed(0);
	opt.consume(param);
    } else {
	opt.usage("Port must be a number greater then 0.", 1);
    }
}, "Set the port parameter");

opt.option(["-s", "--ssl-port"], function (param) {
    if (Number(param).toFixed(0) > 0) {
	config.securePort = Number(param).toFixed(0);
	opt.consume(param);
    } else {
	opt.usage("SLL Port must be a number greater then 0.", 1);
    }
}, "Set the ssl port parameter");

opt.option(["-sk", "--ssl-key"], function (param) {
    if (param !== undefined && param.trim()) {
	config.sslKey = param.trim();
	opt.consume(param);
    }
}, "Set the ssl private key file parameter");

opt.option(["-sc", "--ssl-cert"], function (param) {
    if (param !== undefined && param.trim()) {
	config.sslCert = param.trim();
	opt.consume(param);
    }
}, "Set the ssl certificate parameter");

opt.option(["-g", "--generate"], function (param) {
    var config_filename = ""; 

    config_only = true;

    if (param !== undefined && param.trim() !== "") {
	config_filename = param.trim();
    }
    opt.consume(param);

    if (config_filename === "") {
	console.log(JSON.stringify(config, null, '\t'));
	process.exit(0);
    } else {
	fs.writeFile(config_filename, JSON.stringify(config, null, '\t'), function (err) {
	    if (err) {
		console.error("ERROR: can't write", config_filename);
		process.exit(1);
	    }
	    console.log("Wrote configuration to", config_filename);
	    process.exit(0);
	});
    }

}, "Generate a configuration file");

opt.option(["-h", "--help"], function () {
    opt.usage();
}, "This help document.");

opt.optionWith(process.argv);

// setup the client communications
clientComms = new ClientComms({
    allowAddVehicle: config.addVehicleEnabled,
    allowDeleteVehicle: config.deleteVehicleEnabled,
    allowUpdateVehicle: config.updateVehicleEnabled,
    port: config.port,
    securePort: config.securePort,
    uuidV1: config.uuidV1,
    communicationType: config.communicationType,
    sslKey: config.sslKey,
    sslCert: config.sslCert,
    debug: config.debug,
    debugLevel: config.debugLevel
});

// listen for the events from clients
clientComms.on('addVehicle', function(d) {addVehicle(d);});
clientComms.on('deleteVehicle', function(d) {deleteVehicle(d);});
clientComms.on('updateVehicle', function(d) {updateVehicle(d);});
clientComms.on('updateNavPath', function(d, c) {updateNavPath(d, c);});
clientComms.on('sendVehicles', function(c) {sendVehicles(c);});
clientComms.on('newConnectionAccepted', function(c) {newConnection(c);});

clientComms.on('vehicleLaunch', function(d) {vehicleLaunch(d);});
clientComms.on('vehicleLand', function(d) {vehicleLand(d);});
clientComms.on('vehicleAbort', function(d) {vehicleAbort(d);});

/*
clientComms.on('vehicleTest', function(d) {x(d);});
*/
clientComms.on('vehicleUp', function(d) {vehicleUp(d);});
clientComms.on('vehicleDown', function(d) {vehicleDown(d);});
clientComms.on('vehicleLeft', function(d) {vehicleLeft(d);});
clientComms.on('vehicleRight', function(d) {vehicleRight(d);});
clientComms.on('vehicleForward', function(d) {vehicleForward(d);});
clientComms.on('vehicleReverse', function(d) {vehicleReverse(d);});
clientComms.on('vehicleTurnLeft', function(d) {vehicleTurnLeft(d);});
clientComms.on('vehicleTurnRight', function(d) {vehicleTurnRight(d);});

clientComms.on('vehicleReset', function(d) {vehicleReset(d);});
clientComms.on('vehicleConnect', function(d) {vehicleConnect(d);});
clientComms.on('vehicleDisconnect', function(d) {vehicleDisconnect(d);});
clientComms.on('vehicleReconnect', function(d) {vehicleReconnect(d);});

// start up the server for clients
clientComms.startClientServer();

// startup the comms with the remote vehicles
var remoteVehicles = startVehicleComms(vehicles);

telemetryTimeout();

function vehicleAbort(data) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: vehicleAbort(" + data + ");");
    }
    var remoteVehicle = getRemoteVehicle(data.id);

    if(config.debug) {
	console.log((new Date()) + " videre-server.js: vehicleAbort() - " + remoteVehicle);
    }
    if(remoteVehicle) {
	if(config.debug) {
	    console.log((new Date()) + " videre-server.js: vehicleAbort() - calling remoteVehicle.abort()");
	}
	remoteVehicle.abort();
    }
}

function vehicleLaunch(data) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: vehicleLaunch(" + JSON.stringify(data) + ") - calling remoteVehicle.takeoff()");
    }
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.takeoff();
    }
}

function vehicleLand(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.land();
    }
}

function vehicleUp(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.up(data.power);
    }
}

function vehicleDown(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.down(data.power);
    }
}

function vehicleLeft(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.left(data.power);
    }
}

function vehicleRight(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.right(data.power);
    }
}

function vehicleForward(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.forward(data.power);
    }
}

function vehicleReverse(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.reverse(data.power);
    }
}

function vehicleTurnLeft(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.turnLeft(data.power);
    }
}

function vehicleTurnRight(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.turnRight(data.power);
    }
}

function vehicleReset(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.reset();
    }
}

function vehicleConnect(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.connect();
    }
}

function vehicleDisconnect(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.disconnect();
    }
}

function vehicleReconnect(data) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.reconnect();
    }
}

function getVehicleComms(vehicle) {
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.connect();
    }
}

function getRemoteVehicle(id) {
    var remoteVehicle = null;

    for(i = 0, l = remoteVehicles.length; i < l; i++) {
	if(remoteVehicles[i].id === id) {
	    return remoteVehicles[i];
	}
    }

    return remoteVehicle;
}

/*
 * enclosure for call to process active state when an active state event occurs
 */
function makeOnActiveStateFunction(remoteVehicle, vehicle) {
    return function(d) {
	processActiveState(remoteVehicle, vehicle, d);
    };
}

/*
 * enclosure for call to process connection state when an connection state event occurs
 */
function makeOnConnectionStateFunction(remoteVehicle, vehicle) {
    return function(d) {
	processConnectionState(remoteVehicle, vehicle, d);
    };
}

/*
 * enclosure for call to process telemetry when a telemetry event occurs
 */
function makeOnTelemetryFunction(remoteVehicle, vehicle) {
    return function(d) {
	processTelemetry(remoteVehicle, vehicle, d);
    };
}

/*
 * enclosure for call to process payload when a telemetry event occurs
 */
function makeOnPayloadFunction(remoteVehicle, vehicle) {
    return function(d) {
	processPayload(remoteVehicle, vehicle, d);
    };
}

function startVehicleComms(vehicles) {
    var vehicleComms = new Array();
    var remoteVehicle = null;

    for(var i = 0, l = vehicles.length; i < l; i++) {
	if(config.debug) {
	    console.log((new Date()) + " videre-server.js: startVehicleComms: loading " + vehicles[i].name + ' type: ' + vehicles[i].deviceType);
	}

	remoteVehicle = null;

	var Driver  = vehicleDriverRegister.getDriver(vehicles[i].deviceType);

	if(!Driver) {
	    if(config.debug) {
		console.log((new Date()) + ' videre-server.js: vehicle device ' + vehicles[i].deviceType + ' not supported for vehicle ' + vehicles[i].name);
	    }

	    continue;
	} 

	remoteVehicle = new Driver({
	    name: vehicles[i].name, 
	    id: vehicles[i].id, 
	    address: vehicles[i].vehicleAddr,
	    debug: config.debug,
	    debugLevel: config.debugLevel
	});

	if (remoteVehicle) {
            vehicleComms.push(remoteVehicle);

	    remoteVehicle.on('telemetry', makeOnTelemetryFunction(remoteVehicle, vehicles[i]));
	    remoteVehicle.on('activeState', makeOnActiveStateFunction(remoteVehicle, vehicles[i]));
	    remoteVehicle.on('connectionState', makeOnConnectionStateFunction(remoteVehicle, vehicles[i]));
	    remoteVehicle.on('payload', makeOnPayloadFunction(remoteVehicle, vehicles[i]));

	    // TODO: what happens if we lose coms? what performs the auto re-connect?
	    if(config.debug) {
		console.log((new Date()) + " videre-server.js: startVehicleComms: connecting " + vehicles[i].name);
	    }

	    remoteVehicle.connect();
	} else {
	    if(config.debug) {
		console.log((new Date()) + ' videre-server.js: vehicle device ' + vehicles[i].deviceType + ' not supported for vehicle ' + vehicles[i].name);
	    }
	}
    }

    return vehicleComms;
}

/* 
 * load vehicles
 *
 * note that the returned array contains an array of objects, not an array of Vehicles.
 * we can do this because the Vehicle contains only attributes.
 */
function loadVehicles(filename) {
    var vehicles = null;
    
    try {
	vehicles = JSON.parse(fs.readFileSync(filename));
    } catch(e) {
	if(e.code === 'ENOENT') {
	    // ENOENT is file not found, that is okay, just means no records
	} else {
	    // unknown error, lets throw
	    throw e;
	}
    }

    if(vehicles) {
	vehicles.sort(compareName);
    } else {
        vehicles = new Array();
    }

    return vehicles;
}

function compareName(a, b) {
    if(a.name < b.name) {
	return -1;
    }
    if(a.name > b.name) {
	return 1;
    }

    return 0;
}

/* 
 * save vehicles
 */
function saveVehicles(filename) {
    fs.writeFileSync(filename, JSON.stringify(vehicles, null, '\t'));
}

// add a watchdog to check if vehicles get add
function addVehicle(msg) {
    if(config.debug) {
	console.log((new Date()) + ' Adding vehicle ' + msg.name);
    }
    // TODO: add logic to check if the vehicle exists, based on name

    // setup the position, relative to this server
    var vehicle = new Vehicle(msg);
    vehicle.position = vehicles.length;
    vehicle.id = uuid.v4({rng: uuid.nodeRNG});
    vehicles.push(vehicle);

    saveVehicles(VEHICLES_FILE);

    clientComms.sendAddVehicle(vehicle);
}

function deleteVehicle(msg) {
    // if the message isn't set and the id isn't set then do nothing
    if(!msg && !msg.id) {
	if(config.debug) {
	    console.log((new Date()) + ' Delete vehicle failed, msg.id is not specififed.');
	}
	return;
    }

    // find the vehicle
    var position = findVehicleById(msg.id);

    // remove from the array if found
    if(position >= 0) {
        vehicles.splice(position, 1);

	// redo the positions for each vehicle
	// TODO: this is not very good, maybe position should be replaced with a uuid
	resetVehiclePositions();
        
	saveVehicles(VEHICLES_FILE);

	clientComms.sendDeleteVehicle(vehicle);
    } else {
	if(config.debug) {
	    console.log((new Date()) + ' Delete vehicle failed, vehicle not found for: ' + msg.name);
	}
    }
}

function updateVehicle(msg) {
    // if the message isn't set and the id isn't set then do nothing
    if(!msg && !msg.id) {
	if(config.debug) {
	    console.log((new Date()) + ' Update vehicle failed, msg.id is not specififed.');
	}
	return;
    }

    // find the vehicle
    var position = findVehicleById(msg.id);

    if(position >= 0) {
        vehicles[position] = new Vehicle(msg);

	saveVehicles(VEHICLES_FILE);

	clientComms.sendUpdateVehicle(vehicle);
    } else {
	if(config.debug) {
	    console.log((new Date()) + ' Update vehicle failed, vehicle not found for: ' + msg.name);
	}
    }
}

function updateNavPath(msg, connection) {
    // if the message isn't set and the id isn't set then do nothing
    if(!msg && !msg.id) {
	if(config.debug) {
	    console.log((new Date()) + ' Update nav path failed, msg.id is not specififed.');
	}
	return;
    }

    // find the vehicle
    var position = findVehicleById(msg.id);
    
    var navPath = new Path(msg.navPath);

    if(position >= 0) {
	// update the path and the onMap flag
	vehicles[position].navigationPath = new Path(msg.navPath);
	vehicles[position].onMap = msg.onMap;

	saveVehicles(VEHICLES_FILE);

	clientComms.sendNavPathUpdated(connection, msg.id);
	clientComms.sendUpdateNavPath(msg);
    } else {
	if(config.debug) {
	    console.log((new Date()) + ' Update nav path of vehicle failed, vehicle not found for: ' + msg.id);
	}
    }
}

function sendVehicles(connection) {
    clientComms.sendVehicles(connection, vehicles);
}

function newConnection(connection) {
    // on a new connection send the vehicles to the client
    clientComms.sendVehicles(connection, vehicles);

    // on a new connection send the valid devices to the client
    clientComms.sendVehicleDeviceTypes(connection, vehicleDriverRegister.getList());
}

/*
 * process connection state
 *
 * capture connection state and pass to the clients
 */
function processConnectionState(remoteVehicle, vehicle, d) {
    if(config.debug && config.debugLevel > 0) {
	console.log((new Date()) + ' videre-server: process connection state for vehicle ' + vehicle.name + ' state: ' + d);
    }

    switch(d) {
        case UnmannedVehicle.COMMS_CONNECTING:
	    vehicle.connectionStatus = Vehicle.COMMS_CONNECTING;
	    clientComms.sendConnecting(vehicle);
	    break;

        case UnmannedVehicle.COMMS_CONNECTED:
	    vehicle.connectionStatus = Vehicle.COMMS_CONNECTED;
	    clientComms.sendConnected(vehicle);
	    break;

        case UnmannedVehicle.COMMS_DISCONNECTING:
	    vehicle.connectionStatus = Vehicle.COMMS_CONNECTING;
	    clientComms.sendDisconnecting(vehicle);
	    break;

        case UnmannedVehicle.COMMS_DISCONNECTED:
	    vehicle.connectionStatus = Vehicle.COMMS_DISCONNECTED;
	    clientComms.sendDisconnected(vehicle);
	    break;

        case UnmannedVehicle.COMMS_RECONNECTING:
	    vehicle.connectionStatus = Vehicle.COMMS_RECONNECTING;
	    clientComms.sendReconnecting(vehicle);
	    break;
    }
}

/*
 * process active state
 *
 * capture active state and pass to the clients
 */
function processActiveState(remoteVehicle, vehicle, d) {
    if(config.debug && config.debugLevel > 0) {
	console.log((new Date()) + ' videre-server: process active state for vehicle ' + vehicle.name + ' state: ' + d);
    }

    switch(d) {
        case UnmannedVehicle.STATE_LAUNCHING:
	    clientComms.sendLaunching(vehicle);
	    break;
        case UnmannedVehicle.STATE_LAUNCHED:
	    clientComms.sendLaunched(vehicle);
	    break;
        case UnmannedVehicle.STATE_LANDING:
	    clientComms.sendLanding(vehicle);
	    break;
        case UnmannedVehicle.STATE_LANDED:
	    clientComms.sendLanded(vehicle);
	    break;
    }
}

/*
 * process telemetry
 *
 * capture telemetry and pass to the clients
 *
 * note: some devices may pass payload and telemetry together
 */
function processTelemetry(remoteVehicle, vehicle, d) {
    // convert telemetry from drone to client format
    var telemetry = remoteVehicle.transformTelemetry(d);
    telemetry.dirty = true;
    vehicle.telemetry = telemetry;
}

function telemetryTimeout() {
    sendTelemetry();
    setTimeout(telemetryTimeout, config.telemetryTimer);
}

/*
 * send telemetry
 *
 * sends telemetry for all vehicles based on it's dirty flag
 *
 * note: some devices may pass payload and telemetry together
 */
function sendTelemetry() {
    if(config.debug && config.debugLevel > 2) {
	console.log((new Date()) + ' videre-server: send telemetry, testing for telemetry to send');
    }

    // iterate through vehicles, 
    for(var i = 0, l = vehicles.length; i < l; i++) {
	// check if telemetry has been updated since last send
	if(vehicles[i].telemetry && vehicles[i].telemetry.dirty) {
	    if(config.debug && config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: send telemetry, sending: ' + JSON.stringify(vehicles[i].telemetry));
	    }
	    var msg = new Object();
	    msg.id = vehicles[i].id;
	    msg.name = vehicles[i].name;
	    msg.telemetry = vehicles[i].telemetry;
	    clientComms.sendTelemetry(msg);
	    vehicles[i].telemetry.dirty = false;
	}
    }
}

/*
 * process payload
 *
 * capture payload and pass to the clients
 *
 * note: some devices may pass payload and telemetry together
 */
function processPayload(remoteVehicle, d) {
    if(config.debug && config.debugLevel > 1) {
	console.log((new Date()) + ' videre-server: process payload');
	console.log(d);
    }
}

/** 
 * find VehicleById - finds the vehicle based on it's id
 * 
 * returns -1 if not found, otherwise the position in the vehicles array
 */
function findVehicleById(id) {
    var position = -1;

    // if name isn't set then return
    if(!id) {
	return position;
    }

    for(var i = 0, l = vehicles.length; i < l; i++) {
	if(vehicles[i].id === id) {
	    position = i;
	    break;
	}
    }

    return position;
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
 * reset vehicle positions - updates the positions for all vehicles
 * 
 * note: this does not save the vehicles, it just updates the vehicles array
 */
function resetVehiclePositions() {
    // TODO: this is not very good, maybe position should be replaced with a uuid
    for(var i = 0, l = vehicles.length; i < l; i++) {
	vehicles[i].position = i;
    }
}
