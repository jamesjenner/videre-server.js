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

// var videre_comms  = require('./videre-common/js/videre_comms.js');
// var vehicle       = require('./videre-common/js/vehicle.js');
var ClientComms   = require('./client_comms.js');
var fs            = require('fs');
var path          = require('path');
var opt           = require('opt').create();
var uuid         = require('node-uuid');

var Parrot = require('./vehicle/parrotArDroneV1.js');

var TransformParrot = require('./transform/transformParrotArDroneV1.js');

var transformParrot = new TransformParrot();

eval(fs.readFileSync('./videre-common/js/vehicle.js').toString());
// the following two are referenced in vehicle.js, possibly not used
eval(fs.readFileSync('./videre-common/js/path.js').toString());
eval(fs.readFileSync('./videre-common/js/telemetry.js').toString());

eval(fs.readFileSync('./videre-common/js/videre_comms.js').toString());


var VEHICLES_FILE = 'vehicles.json';
// load the vehicle configs from the file
var vehicles = loadVehicles(VEHICLES_FILE);


/* options handling */
// TODO: look at replacing or extending opt, would like error on invalid arg, exclusivity of args, better formatting of help, etc

var config = {
    debug: false,
    debugLevel: 0,
    addVehicleEnabled: true,
    deleteVehicleEnabled: true,
    updateVehicleEnabled: true,
    port: 9007,
    securePort: 9008,
    uuidV1: false,
    communicationType:COMMS_TYPE_MIXED,
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

// opt.on("ready", function (config) {
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

    opt.option(["-u", "--update-vehicles"], function (param) {
	config.allowUpdateVehicle = true;
    }, "Allow clients to update vehicles");

    opt.option(["-so", "--secure-only"], function (param) {
	config.communicationType = COMMS_TYPE_SECURE_ONLY;
    }, "Set communications to only accept secure connections");

    opt.option(["-m", "--mixed"], function (param) {
	config.communicationType = COMMS_TYPE_MIXED;
    }, "Set communications to accept secure and unsecure connections");

    opt.option(["-u1", "--uuid-v1"], function (param) {
	config.uuidV1 = true;
    }, "Set uuid generation for session keys to uuid v1, default is v4");

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
// });

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
clientComms.on('sendVehicles', function(c) {sendVehicles(c);});
clientComms.on('newConnectionAccepted', function(c) {newConnection(c);});

clientComms.on('vehicleLaunch', function(d) {vehicleLaunch(d);});
clientComms.on('vehicleLand', function(d) {vehicleLand(d);});
clientComms.on('vehicleAbort', function(d) {vehicleAbort(d);});
/*
clientComms.on('vehicleTest', function(d) {x(d);});
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

function getVehicleComms(vehicle) {
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

function startVehicleComms(vehicles) {
    var vehicleComms = new Array();
    var remoteVehicle = null;

    for(i = 0, l = vehicles.length; i < l; i++) {
	if(config.debug) {
	    console.log((new Date()) + " videre-server.js: startVehicleComms: loading " + vehicles[i].name);
	}

	remoteVehicle = null;

	switch(vehicles[i].deviceType) {
	    case(VEHICLE_DEVICE_PARROT_V1):
		// create the remote vehicle comms handler and map values from the common vehicle data
		remoteVehicle = new Parrot({
		    name: vehicles[i].name, 
		    id: vehicles[i].id, 
		    address: "192.168.1.3",
		    debug: config.debug,
		    debugLevel: config.debugLevel
	        });
		break;

	    // not implemented yet 
	    case(VEHICLE_DEVICE_PARROT_V2):
		break;

	    // unknown device type
	    default:
		if(config.debug) {
		    console.log((new Date()) + ' videre-server.js: vehicle device ' + vehicles[i].deviceType + ' not supported for vehicle ' + vehicles[i].name);
		}
		break;
	}

	if (remoteVehicle) {
            vehicleComms.push(remoteVehicle);

	    remoteVehicle.on('telemetry', function(d) {processTelemetry(remoteVehicle, d);});
	    remoteVehicle.on('payload', function(d) {processPayload(remoteVehicle, d);});

	    // TODO: what happens if we lose coms? what performs the auto re-connect?
	    if(config.debug) {
		console.log((new Date()) + " videre-server.js: startVehicleComms: connecting " + vehicles[i].name);
	    }
	    remoteVehicle.connect();

            // remoteVehicles[i].testRun();
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

    // setup the position, relative to this server
    var vehicle = new Vehicle(msg);
    vehicle.position = vehicles.length;
    vehicle.id = uuid.v4({rng: uuid.nodeRNG});
    vehicles.push(vehicle);

    saveVehicles(VEHICLES_FILE);

    clientComms.sendAddVehicle(vehicle);
}

function deleteVehicle(msg) {
    // if the message isn't set and the name isn't set then do nothing
    if(!msg && !msg.name) {
	if(config.debug) {
	    console.log((new Date()) + ' Delete vehicle failed, msg.name is not specififed.');
	}
	return;
    }

    // find the vehicle
    var position = findVehicle(msg.name);

    // remove from the array if found
    if(position >= 0) {
        vehicles.splice(position, 1);

	// redo the positions for each vehicle
	// TODO: this is not very good, maybe position should be replaced with a uuid
	resetVehiclePositions();
        
	saveVehicles(VEHICLES_FILE);
    } else {
	if(config.debug) {
	    console.log((new Date()) + ' Delete vehicle failed, vehicle not found for: ' + msg.name);
	}
    }
}

function updateVehicle(msg) {
    // if the message isn't set and the name isn't set then do nothing
    if(!msg && !msg.name) {
	if(config.debug) {
	    console.log((new Date()) + ' Update vehicle failed, msg.name is not specififed.');
	}
	return;
    }

    // find the vehicle
    var position = findVehicle(msg.name);

    if(position >= 0) {
        vehicles[position] = new Vehicle(msg);
    } else {
	if(config.debug) {
	    console.log((new Date()) + ' Update vehicle failed, vehicle not found for: ' + msg.name);
	}
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
function processTelemetry(remoteVehicle, d) {
    if(config.debug && config.debugLevel > 0) {
	console.log((new Date()) + ' videre-server: telemetry...');
	console.log(d);
    }

    // convert telemetry from drone to client format
    var telemetry = transformParrot.transform(d);

    telemetry.name = remoteVehicle.name;
    telemetry.id = remoteVehicle.id;

    clientComms.sendTelemetry(telemetry);
}

/*
 * process payload
 *
 * capture payload and pass to the clients
 *
 * note: some devices may pass payload and telemetry together
 */
function processPayload(remoteVehicle, d) {
    if(config.debug) {
	console.log((new Date()) + ' videre-server: payload...');
	console.log(d);
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
