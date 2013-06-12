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

var fs                    = require('fs');
var path                  = require('path');
var opt                   = require('opt').create();
var uuid                  = require('node-uuid');

var Vehicle               = require('./videre-common/js/vehicle.js');
var Message               = require('./videre-common/js/message.js');
var Drone                 = require('./videre-common/js/drone.js');
var DroneCapabilities     = require('./videre-common/js/droneCapabilities.js');
var Path                  = require('./videre-common/js/path.js');
var Comm                  = require('./videre-common/js/comm.js');

var ClientComms           = require('./client_comms.js');
var VehicleComms          = require('./vehicleComms.js');
var UnmannedVehicle       = require('./vehicle/unmannedVehicle.js');

var ProtocolRegister = require('./protocols/register.js');

var VEHICLES_FILE = 'vehicles.json';
var NAV_PATH_FILE = 'waypoints.json';
var VEHICLE_COMMS_FILE = 'vehicle_comms.json';

// load the comms from the file
var vehicleComms = new VehicleComms({filename: VEHICLE_COMMS_FILE, debug: true});
vehicleComms.load();

// load the vehicle configs from the file
var vehicles = loadVehicles(VEHICLES_FILE);
var navPaths = loadNavPaths(NAV_PATH_FILE);

var protocolRegister = new ProtocolRegister();

// the vehicle map is [protocolId][deviceId] where 
//    protocolId is the unique id for the protocol 
//    deviceId is the id of the device, unique for the protocol only
// the vehicle map holds instances of Vehicle
var vehicleMap = new Object();

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
    communicationType: Message.COMMS_TYPE_UNSECURE_ONLY,
    sslKey: 'keys/privatekey.pem',
    sslCert: 'keys/certificate.pem'
};

var commsDefinition = new Comm();

var search_paths = [
    "videre-server.conf",
    path.join(process.env.HOME, ".videre-server-rc"),
    "/usr/local/etc/videre-server.conf",
    "/usr/etc/videre-server.conf",
    "/etc/videre-server.conf" 
];

var addingComms = false;
var deletingComms = false;
var listingComms = false;
var listingProtocols = false;

opt.configSync(config, search_paths);

opt.optionHelp("USAGE node " + path.basename(process.argv[1]),
    "SYNOPSIS: Videre server provides connecitvity between videre clients and drones.\n\n\t\t node " 
	 + path.basename(process.argv[1]) + " --help",
    "OPTIONS:",
    "Copyright (c) 2012-2013 James G Jenner, all rights reserved\n" + 
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

opt.option(["-vu", "--update-vehicles"], function (param) {
    config.allowUpdateVehicle = true;
}, "Allow clients to update vehicles");

opt.option(["-so", "--secure-only"], function (param) {
    config.communicationType = Message.COMMS_TYPE_SECURE_ONLY;
}, "Set communications to only accept secure connections");

opt.option(["-uo", "--unsecure-only"], function (param) {
    config.communicationType = Message.COMMS_TYPE_UNSECURE_ONLY;
}, "Set communications to only accept unsecure connections, this is the default type");

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

// vehicle comms configuration options
opt.option(["-ca", "--comms-add"], function (param) {
    addingComms = true;
}, "Add a comms definition");

opt.option(["-cd", "--comms-delete"], function (param) {
    deletingComms = true;
}, "Delete a comms definition");

opt.option(["-cad", "--comms-auto-discover"], function (param) {
    commsDefinition.autoDiscover = true;
}, "comms auto discovery");
opt.option(["-cm", "--comms-multi-vehicle"], function (param) {
    commsDefinition.multiVehicle = true;
}, "comms multi-vehicle capable");
opt.option(["-cl", "--comms-list"], function (param) {
    listingComms = true;
}, "comms listing, lists all defined comms");
opt.option(["-pl", "--protocol-list"], function (param) {
    listingProtocols = true;
}, "protocol listing, lists all defined protocols");
opt.option(["-cp", "--comms-protocol"], function (param) {
    console.log("comms protocol: " + param);
    commsDefinition.protocol = ((param != null) ? param.trim() : '');
    
    // validate the comms protocl
    if(!protocolRegister.validateProtocolId(commsDefinition.protocol)) {
	opt.usage("Specified protocol is not a valid protocol", 1);
    } else {
	opt.consume(param);
    }
}, "comms protocol (" + protocolRegister.getText() + ")");
opt.option(["-cc", "--comms-connection-type"], function (param) {
    commsDefinition.connectionType = ((param != null) ? param.trim() : null);
    
    if(commsDefinition.connectionType != Comm.TYPE_SERIAL && commsDefinition.connectionType != Comm.TYPE_TCP) {
	opt.usage("Connection type must be either Serial or Tcp", 1);
    } else {
	opt.consume(param);
    }
}, "comms connection type (Serial | Tcp)");
opt.option(["-cna", "--comms-network-address"], function (param) {
    commsDefinition.networkAddress = ((param != null) ? param.trim() : null);
    if(commsDefinition.networkAddress === null) {
	opt.usage("Network address must be specified when the network address option is used", 1);
    } else {
	opt.consume(param);
    }
}, "comms network address");
opt.option(["-cnp", "--comms-network-port"], function (param) {
    commsDefinition.networkPort = ((param != null) ? param.trim() : null);
    if(commsDefinition.networkPort === null) {
	opt.usage("Network port must be specified when the network port option is used", 1);
    } else {
	opt.consume(param);
    }
}, "comms network port");
opt.option(["-csp", "--comms-serial-port"], function (param) {
    commsDefinition.serialPort = ((param != null) ? param.trim() : null);
    if(commsDefinition.serialPort === null) {
	opt.usage("Serial port must be specified when the network port option is used", 1);
    } else {
	opt.consume(param);
    }
}, "comms serial port");
opt.option(["-csb", "--comms-serial-baud"], function (param) {
    if (Number(param).toFixed(0) > 0) {
	commsDefinition.baudRate = Number(param).toFixed(0);
	opt.consume(param);
    } else {
	opt.usage("Baud rate must be a number greater then 0.", 1);
    }
}, "comms serial baud rate");

// server comms settings
opt.option(["-p", "--port"], function (param) {
    if (Number(param).toFixed(0) > 0) {
	config.port = Number(param).toFixed(0);
	opt.consume(param);
    } else {
	opt.usage("Port must be a number greater then 0.", 1);
    }
}, "Set the port parameter for remote connections");

opt.option(["-s", "--ssl-port"], function (param) {
    if (Number(param).toFixed(0) > 0) {
	config.securePort = Number(param).toFixed(0);
	opt.consume(param);
    } else {
	opt.usage("SLL Port must be a number greater then 0.", 1);
    }
}, "Set the ssl port parameter for remote secure connections");

opt.option(["-sk", "--ssl-key"], function (param) {
    if (param !== undefined && param.trim()) {
	config.sslKey = param.trim();
	opt.consume(param);
    }
}, "Set the ssl private key file parameter for remote secure connections");

opt.option(["-sc", "--ssl-cert"], function (param) {
    if (param !== undefined && param.trim()) {
	config.sslCert = param.trim();
	opt.consume(param);
    }
}, "Set the ssl certificate parameter for remote secure connections");

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

// load existing definitions

// check if it was requested to add comms
if(addingComms) {
    var commDefTxt = "";
    if(commsDefinition.connectionType === Comm.TYPE_SERIAL) {
	commDefTxt = "port: " + commsDefinition.serialPort;
    } else {
	commDefTxt = commsDefinition.networkAddress + ":" + commsDefinition.networkPort;
    }

    console.error("Adding new comm definition for " + commDefTxt);

    // check if it exists
    if(vehicleComms.exists(commsDefinition)) {
	console.log("ERROR: comm definition exists, cannot add the requested comm definition");
    } else {
	// add the comms definition
        commsDefinition.id = uuid.v4({rng: uuid.nodeRNG});
	vehicleComms.add(commsDefinition);
	vehicleComms.save();
	console.log("Comm definition added, now exiting");
    }

    process.exit(1);
} else if(deletingComms) {
    var commDefTxt = "";
    if(commsDefinition.connectionType === Comm.TYPE_SERIAL) {
	commDefTxt = "port: " + commsDefinition.serialPort;
    } else {
	commDefTxt = commsDefinition.networkAddress + ":" + commsDefinition.networkPort;
    }

    console.error("Deleting comm definition for " + commDefTxt);

    // check if it exists
    if(vehicleComms.exists(commsDefinition)) {
	// delete the comms definition
	if(vehicleComms.remove(commsDefinition)) {
	    vehicleComms.save();
	    console.log("Comm definition removed, now exiting");
	} else {
	    console.log("ERROR: comm definition doesn't exist, cannot delete the requested comm definition");
	}
    } else {
	console.log("ERROR: comm definition doesn't exist, cannot delete the requested comm definition");
    }

    process.exit(1);
} else if(listingComms) {
    // output all the defined comms and then exit
    console.log(vehicleComms.toText());
    process.exit(1);
}

if(listingProtocols) {
    // output all the defined comms and then exit
    console.log(protocolRegister.getText());
    process.exit(1);
}

// setup the client communications
clientComms = new ClientComms({
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

// TODO: cannot delete vehicle, however vehicle deletion should be handled when comms are deleted

// listen for the events from clients
// clientComms.on('updateVehicle', function(d) {updateVehicle(d);});
clientComms.on('updateVehicle', updateVehicle);
clientComms.on('updateNavPath', function(d, c) {updateNavPath(d, c);});
clientComms.on('sendVehicles', function(c) {sendVehicles(c);});
clientComms.on('newConnectionAccepted', function(c) {newConnection(c);});

clientComms.on('vehicleArm', armVehicle);
clientComms.on('vehicleDisarm', disarmVehicle);
clientComms.on('vehicleSetAutonomousMode', setVehicleAutonomousMode);
clientComms.on('vehicleSetTestMode', setVehicleTestMode);
clientComms.on('vehicleSetStabilizedMode', setVehicleStabilizedMode);
clientComms.on('vehicleSetHardwareInLoopMode', setVehicleHardwareInLoopMode);
clientComms.on('vehicleSetRemoteControlMode', setVehicleRemoteControlMode);
clientComms.on('vehicleSetGuidedMode', setVehicleGuidedMode);

clientComms.on('vehicleLaunch', function(d) {vehicleLaunch(d);});
clientComms.on('vehicleLand', function(d) {vehicleLand(d);});
clientComms.on('vehicleAbort', function(d) {vehicleAbort(d);});

clientComms.on('vehicleHalt', vehicleHalt);
clientComms.on('vehicleGo', vehicleGo);
clientComms.on('vehicleRebootAutopilot', vehicleRebootAutopilot);
clientComms.on('vehicleReboot', vehicleReboot);
clientComms.on('vehicleShutdownAutopilot', vehicleShutdownAutopilot);
clientComms.on('vehicleShutdown', vehicleShutdown);

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

// TODO: sort these out
// clientComms.on('vehicleConnect', function(d) {vehicleConnect(d);});
// clientComms.on('vehicleDisconnect', function(d) {vehicleDisconnect(d);});
// clientComms.on('vehicleReconnect', function(d) {vehicleReconnect(d);});

// start up the server for clients
if(config.debug) {
    console.log((new Date()) + " videre-server.js: starting client server");
}
clientComms.startClientServer();

// startup the comms for the devices
if(config.debug) {
    console.log((new Date()) + " videre-server.js: starting device comms");
}
var deviceComms = startDeviceComms(vehicleComms.getList());

// start up telemetry timeout loop
if(config.debug) {
    console.log((new Date()) + " videre-server.js: starting telemetry auto send");
}
telemetryAutoSend();

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

function armVehicle(msg) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: armVehicle");
    }

    var protocol = findDeviceCommsByVehicleId(msg.id);
    
    if(protocol != null) {
	protocol.setArmedMode(msg.id, true);
    }
}

function disarmVehicle(msg) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: disarmVehicle");
    }

    var protocol = findDeviceCommsByVehicleId(msg.id);
    
    if(protocol != null) {
	protocol.setArmedMode(msg.id, false);
    }
}

function setVehicleAutonomousMode(msg) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: setVehicleAutonomousMode " + JSON.stringify(msg));
    }

    var protocol = findDeviceCommsByVehicleId(msg.id);
    
    if(protocol != null) {
	protocol.setAutonomousMode(msg.id, msg.mode);
    }
}

function setVehicleTestMode(msg) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: setVehicleTestMode " + JSON.stringify(msg));
    }

    var protocol = findDeviceCommsByVehicleId(msg.id);
    
    if(protocol != null) {
	protocol.setTestMode(msg.id, msg.mode);
    }
}

function setVehicleStabilizedMode(msg) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: setVehicleStabilizedMode " + JSON.stringify(msg));
    }

    var protocol = findDeviceCommsByVehicleId(msg.id);
    
    if(protocol != null) {
	protocol.setStabilizedMode(msg.id, msg.mode);
    }
}

function setVehicleHardwareInLoopMode(msg) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: setVehicleHardwareInLoopMode " + JSON.stringify(msg));
    }

    var protocol = findDeviceCommsByVehicleId(msg.id);
    
    if(protocol != null) {
	protocol.setHardwareInLoopMode(msg.id, msg.mode);
    }
}

function setVehicleRemoteControlMode(msg) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: setVehicleRemoteControlMode " + JSON.stringify(msg));
    }

    var protocol = findDeviceCommsByVehicleId(msg.id);
    
    if(protocol != null) {
	protocol.setRemoteControlMode(msg.id, msg.mode);
    }
}

function setVehicleGuidedMode(msg) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: setVehicleGuidedMode " + JSON.stringify(msg));
    }

    var protocol = findDeviceCommsByVehicleId(msg.id);
    
    if(protocol != null) {
	protocol.setGuidedMode(msg.id, msg.mode);
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

function vehicleHalt(data) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: vehicleHalt for " + data.id + " - calling remoteVehicle.halt()");
    }
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.halt();
    }
}

function vehicleGo(data) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: vehicleGo for " + data.id + " - calling remoteVehicle.go()");
    }
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.Go();
    }
}

function vehicleRebootAutopilot(data) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: vehicleRebootAutopilot for " + data.id + " - calling remoteVehicle.rebootAutopilot()");
    }
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.rebootAutopilot();
    }
}

function vehicleReboot(data) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: vehicleVehicleReboot for " + data.id + " - calling remoteVehicle.vehicleReboot()");
    }
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.vehicleReboot();
    }
}

function vehicleShutdownAutopilot(data) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: vehicleShutdownAutopilot for " + data.id + 
	    " - calling remoteVehicle.shutdownAutopilot()");
    }
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.shutdownAutopilot();
    }
}

function vehicleShutdown(data) {
    if(config.debug) {
	console.log((new Date()) + " videre-server.js: vehicleShutdown for " + data.id + " - calling remoteVehicle.shutdown()");
    }
    var remoteVehicle = getRemoteVehicle(data.id);

    if(remoteVehicle) {
	remoteVehicle.shutdown();
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

function startDeviceComms(comms) {
    var devComms = new Object();
    var protocol;
    var Protocol;

    if(config.debug && comms.length < 1) {
	console.log((new Date()) + " videre-server.js: startDevicecomms - no devices are defined");
    }
    for(var i = 0, l = comms.length; i < l; i++) {
	if(config.debug) {
	    console.log((new Date()) + " videre-server.js: loading protocol " + comms[i].protocol + " for " + comms[i].toText());
	}

        Protocol = protocolRegister.getProtocol(comms[i].protocol);

	if(!Protocol) {
	    if(config.debug) {
		console.log((new Date()) + ' videre-server.js: protocol ' + comms[i].protocol + ' not found for ' + comms[i].toText());
	    }

	    continue;
	} 

	var protocol = new Protocol({
	    name: comms[i].protocol,
	    debug: config.debug,
	    debugLevel: config.debugLevel,
	    connectionMethod: comms[i].connectionType,
	    serialPort: comms[i].serialPort,
	    serialBaud: comms[i].baudRate,
	    networkAddress: comms[i].networkAddress,
	    networkPort: comms[i].networkPort,

	    getVehicleIdFunction: getVehicleId,
	    getDeviceOptionsFunction: getVehicleOptions,

	    debugWaypoints: false,
	    debugHeartbeat: false,
	    debugMessage: false,
	    debugAttitude: false,
	    debugIMU: false,
	    debugGPS: false,
	    debugVFR_HUD: true,
	    debugGPSRaw: false,
	    debugGPSStatus: false,
	});

	if(protocol) {
            devComms[protocol.id] = protocol;

	    protocol.on('attitude', processAttitude);
	    // TODO: change name to gps
	    protocol.on('speed', processSpeed);
	    protocol.on('altitude', processAltitude);
	    protocol.on('throttle', processThrottle);
	    protocol.on('heading', processHeading);
	    protocol.on('vsi', processVSI);

	    protocol.on('positionGPS', processPosition);
	    protocol.on('retreivedNoWaypoints', processNoWaypoints);
	    protocol.on('retreivedWaypoints', processWaypoints);
	    protocol.on('setWaypointsSuccessful', processSetWaypointsSuccess);
	    protocol.on('setWaypointsError', processSetWaypointsError);
	    protocol.on('targetWaypoint', processTargetWaypoint);
	    protocol.on('waypointAchieved', processWaypointAchieved);
	    protocol.on('statusText', processStatusText);
	    protocol.on('systemState', processSystemState);
	    // TODO: don't see a reason for this...
	    // protocol.on('systemStateChanged', processSystemStateChanged);
	    protocol.on('autonomousModeChanged', processAutonomousModeChanged);
	    protocol.on('testModeChanged', processTestModeChanged);
	    protocol.on('stabilizedModeChanged', processStabilizedModeChanged);
	    protocol.on('hardwareInLoopModeChanged', processHardwareInLoopModeChanged);
	    protocol.on('remoteControlModeChanged', processRemoteControlModeChanged);
	    protocol.on('guidedModeChanged', processGuidedModeChanged);
	    protocol.on('armedModeChanged', processArmedModeChanged);


	    // TODO: what happens if we lose coms? what performs the auto re-connect?
	    if(config.debug) {
		console.log((new Date()) + " videre-server.js: connecting to " + comms[i].toText());
	    }

	    protocol.connect();
	} else {
	    if(config.debug) {
		console.log((new Date()) + ' videre-server.js: protocol ' + comms[i].protocol + ' not supported for ' + comms[i].toText());
	    }
	}
    }

    return devComms;
}

function getVehicleId(protocolId, deviceId, protocolName) {
    // lookup to see if id exists
    if(vehicleMap[protocolId] === undefined) {
	vehicleMap[protocolId] = new Object();
    }

    if(vehicleMap[protocolId][deviceId] === undefined) {
        var index = findVehicleByDeviceId(protocolId, deviceId);

	if(index > -1) {
	    if(config.debug) {
		console.log((new Date()) + 
	            " videre-server.js: getVehicleId: vehicle found for protocolId " + protocolId + " deviceId " + deviceId);
	    }
	    // exist so use it
	    vehicleMap[protocolId][deviceId] = vehicles[protocolId][index];
	} else {
	    // doesn't exist so create it
	    if(config.debug) {
		console.log((new Date()) + 
	            " videre-server.js: getVehicleId: no vehicle for protocolId " + 
		    protocolId + " deviceId " + deviceId + " adding vehicle");
	    }
	    vehicleMap[protocolId][deviceId] = new Vehicle();
	    vehicleMap[protocolId][deviceId].id = uuid.v4({rng: uuid.nodeRNG});

            addVehicle(protocolId, deviceId, vehicleMap[protocolId][deviceId]); 
	}

	// as we are registering the device as a vehicle, request the waypoints
	// this is delayed for a couple of seconds as on return of this function is when the device map is set in the protocol
	setTimeout(function() {
	    deviceComms[protocolId].requestWaypoints.call(deviceComms[protocolId], vehicleMap[protocolId][deviceId].id);
	}, 2000);
    }

    return vehicleMap[protocolId][deviceId].id;
}

function getVehicleOptions(protocolId, deviceId) {
    if(vehicleMap[protocolId] === undefined || vehicleMap[protocolId][deviceId] === undefined) {
	return {
	    pitchAccuracy: 0.001,
	    rollAccuracy: 0.001,
	    yawAccuracy: 0.03,
	    positionReportingMode: Protocol.POSITION_MODE_POSITION,
	    positionReportingValue: 1,
	};
    } else {
	return {
	    pitchAccuracy: vehicleMap[protocolId][deviceId].pitchAccuracy,
	    rollAccuracy: vehicleMap[protocolId][deviceId].rollAccuracy,
	    yawAccuracy: vehicleMap[protocolId][deviceId].yawAccuracy,
	    positionReportingMode: vehicleMap[protocolId][deviceId].positionReportingMode,
	    positionReportingValue: vehicleMap[protocolId][deviceId].positionReportingValue,
	};
    }
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
	// TODO: add sorting for new structure of vehicles... not sure if possible
	// vehicles.sort(compareName);
    } else {
        vehicles = new Object();
    }

    return vehicles;
}

/* 
 * save json file
 */
function saveJSON(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, '\t'));
}

/* 
 * load navpaths
 *
 * note that the returned array contains an array of objects, not an array of Paths.
 * we can do this because we do not use the methods on the path objects on the server (at this time).
 */
function loadNavPaths(filename) {
    var navPaths = null;
    
    try {
	navPaths = JSON.parse(fs.readFileSync(filename));
    } catch(e) {
	if(e.code === 'ENOENT') {
	    // ENOENT is file not found, that is okay, just means no records
	} else {
	    // unknown error, lets throw
	    throw e;
	}
    }

    if(!navPaths) {
        navPaths = new Object();
    }

    return navPaths;
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

// add a watchdog to check if vehicles get add
function addVehicle(protocolId, deviceId, vehicle) {
    if(config.debug) {
	console.log((new Date()) + ' Adding vehicle ' + vehicle.name + ' ' + deviceId + ' ' + protocolId);
    }
    // TODO: add logic to check if the vehicle exists, based on name

    // setup the id
    // var vehicle = new Vehicle(msg);
    vehicle.deviceId = deviceId;

    if(vehicles[protocolId] === undefined) {
	vehicles[protocolId] = new Array();
    }

    vehicles[protocolId].push(vehicle);

    saveJSON(VEHICLES_FILE, vehicles);

    clientComms.sendAddVehicle(vehicle);
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
    var vehicle = findVehicleById(msg.id);

    if(vehicle != null) {
	// merge the data from the msg into the vehicle
        Vehicle.merge(vehicle, msg);

	// save the vehicles
	saveJSON(VEHICLES_FILE, vehicles);

        var protocol = findDeviceCommsByVehicleId(vehicle.id);

	if(protocol !== null) {
	    protocol.setOptions(vehicle);
	}

	// send the update back to the host
	clientComms.sendUpdateVehicle(vehicle);
    } else {
	if(config.debug) {
	    console.log((new Date()) + ' Update vehicle failed, vehicle not found: ' + msg.id + " : " + msg.name);
	}
    }
}

function updateNavPath(msg, connection) {
    // if the message isn't set and the id isn't set then do nothing
    if(!msg && !msg.vehicleId) {
	if(config.debug) {
	    console.log((new Date()) + ' Update nav path failed, vehicleId is not specififed.');
	}
	return;
    }

    // find the vehicle
    // var vehicle = findVehicleById(msg.id);
    var protocol = findDeviceCommsByVehicleId(msg.vehicleId);
    
    if(protocol != null) {
	// note that the persistance of waypoints is only performed when retrieved from the vehicle
	// this way the persisted values have been confirmed as set at the vehicle

	// set the waypoints for the vehicle
	protocol.requestSetWaypoints(msg.vehicleId, msg.navigationPath.points);
    } else {
	if(config.debug) {
	    console.log((new Date()) + ' Update nav path of vehicle failed, vehicle not found: ' + msg.vehicleId);
	}
    }
}

function sendVehicles(connection) {
    clientComms.sendVehicles(connection, vehicles);
}

function newConnection(connection) {
    if(config.debug) {
	console.log((new Date()) + ' New connection accepted');
    }
    console.log((new Date()) + ' sending vehicles');
    // on a new connection send the vehicles to the client
    clientComms.sendVehicles(connection, vehicles);

    console.log((new Date()) + ' sending comms');
    // on a new connection send the comms to the client
    clientComms.sendVehicleComms(connection, vehicleComms.getList());

    console.log((new Date()) + ' sending sending nav paths');
    // iterate through the waypoints and send them
    for(var i in navPaths) {
	console.log((new Date()) + ' sending sending nav path for ' + i);
	clientComms.sendUpdateNavPath(i, navPaths[i]);
    }
    console.log((new Date()) + ' sending done');
}

/*
 * process attitude
 *
 * capture attitude and pass to the clients
 *
 */
function processAttitude(protocolId, deviceId, attitude, heading) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
	// update telemetry for vehicle with attitude info
	if(vehicleMap[protocolId][deviceId].telemetry === undefined) {
	    vehicleMap[protocolId][deviceId].telemetry = new Telemetry();
	}

	vehicleMap[protocolId][deviceId].telemetry.attitude = attitude;

	// set telemetry to dirty
	vehicleMap[protocolId][deviceId].telemetry.dirty = true;
    }
}

/*
 * process system state
 *
 * capture system state and update telemetry
 *
 */
function processSystemState(protocolId, deviceId, batteryVoltage, batteryCurrent, batteryRemaining, commDropRate, commErrors) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
	// update telemetry for vehicle with attitude info
	vehicleMap[protocolId][deviceId].telemetry.batteryVoltage = batteryVoltage;
	vehicleMap[protocolId][deviceId].telemetry.batteryCurrent = batteryCurrent;
	vehicleMap[protocolId][deviceId].telemetry.batteryRemaining = batteryRemaining;
	vehicleMap[protocolId][deviceId].telemetry.commDropRate = commDropRate;
	vehicleMap[protocolId][deviceId].telemetry.commErrors = commErrors;

	// set telemetry to dirty
	vehicleMap[protocolId][deviceId].telemetry.dirty = true;
    }
}

/*
 * process heading
 *
 * captures the heading and updates telemetry
 *
 */
function processHeading(protocolId, deviceId, heading) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
	// set for vehicle
	vehicleMap[protocolId][deviceId].telemetry.heading = heading;

	// set telemetry to dirty
	vehicleMap[protocolId][deviceId].telemetry.dirty = true;
    }
}

/*
 * process VSI (vertical speed indicator)
 *
 * captures the vertial speed and updates telemetry
 *
 */
function processVSI(protocolId, deviceId, vsi) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
	// set for vehicle
	vehicleMap[protocolId][deviceId].telemetry.vsi = vsi;

	// set telemetry to dirty
	vehicleMap[protocolId][deviceId].telemetry.dirty = true;
    }
}

/*
 * process throttle
 *
 * captures the throttle and updates telemetry
 *
 */
function processThrottle(protocolId, deviceId, throttle) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
	// set for vehicle
	vehicleMap[protocolId][deviceId].telemetry.throttle = throttle;

	// set telemetry to dirty
	vehicleMap[protocolId][deviceId].telemetry.dirty = true;
    }
}

/*
 * process altitude
 *
 * captures the altitude and updates telemetry
 *
 */
function processAltitude(protocolId, deviceId, altitude) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
	// set for vehicle
	vehicleMap[protocolId][deviceId].telemetry.altitude = altitude;

	// set telemetry to dirty
	vehicleMap[protocolId][deviceId].telemetry.dirty = true;
    }
}

/*
 * process speed
 *
 * captures the speed and updates telemetry
 *
 */
function processSpeed(protocolId, deviceId, speed) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
	// set for vehicle
	vehicleMap[protocolId][deviceId].telemetry.speed = speed;

	// set telemetry to dirty
	vehicleMap[protocolId][deviceId].telemetry.dirty = true;
    }
}



/*
 * process position
 *
 * sends the position to the clients
 *
 */
function processPosition(protocolId, deviceId, position) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    if(config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: processPosition, sending: ' + JSON.stringify(position));
	    } else {
		console.log((new Date()) + ' videre-server: sending position for ' + vehicleMap[protocolId][deviceId].name);
	    }
	}

	// update position for vehicle
	vehicleMap[protocolId][deviceId].position = position;

	// send the message
	clientComms.sendPosition(vehicleMap[protocolId][deviceId].id, vehicleMap[protocolId][deviceId].position);
    }
}

function processNoWaypoints(protocolId, deviceId) {
    // TODO: check if there are waypoints stored for the device, if so then send them to the device..

    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    console.log((new Date()) + ' videre-server: no waypoints for ' + vehicleMap[protocolId][deviceId].name);
	}

	// check if the waypoints are defined for the vehicle
	if(navPaths[vehicleMap[protocolId][deviceId].id] !== undefined) {
	    // we have persisted waypoints so lets request the vehicle to use them
	    deviceComms[protocolId].requestSetWaypoints.call(deviceComms[protocolId], 
	        vehicleMap[protocolId][deviceId].id, 
	        navPaths[vehicleMap[protocolId][deviceId].id]);
	}
    }
}

function processWaypoints(protocolId, deviceId, waypoints) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    if(config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: waypoints retrieved: ' + JSON.stringify(waypoints));
	    } else {
		console.log((new Date()) + ' videre-server: waypoints retrieved for ' + vehicleMap[protocolId][deviceId].name);
	    }
	}

	if(navPaths[vehicleMap[protocolId][deviceId].id] === undefined) {
	    navPaths[vehicleMap[protocolId][deviceId].id] = new Array();
	}

	// add the waypoints to the navPaths 
	navPaths[vehicleMap[protocolId][deviceId].id] = waypoints;

	// persist the nav path
        saveJSON(NAV_PATH_FILE, navPaths);

	// disribute them
	clientComms.sendUpdateNavPath(vehicleMap[protocolId][deviceId].id, waypoints);
    }
}

function processSetWaypointsSuccess(protocolId, deviceId) {
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    if(config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: processSetWaypointsSuccess, sending: ' + JSON.stringify(waypoints));
	    } else {
		console.log((new Date()) + ' videre-server: sending waypoints for ' + vehicleMap[protocolId][deviceId].name);
	    }
	}

	// retrieve waypoints, this will result in them being redistributed and confirms that the set worked
	deviceComms[protocolId].requestWaypoints.call(deviceComms[protocolId], vehicleMap[protocolId][deviceId].id);
    }
}

function processSetWaypointsError(protoclId, deviceId, text) {
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    console.log((new Date()) + ' videre-server: error setting waypoints ' + text);
	}

	clientComms.sendWaypointSetError(vehicleMap[protocolId][deviceId].id, text);
    }
}

function processTargetWaypoint(protoclId, deviceId, sequence) {
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    console.log((new Date()) + ' videre-server: waypoint targeted ' + sequence);
	}

	clientComms.sendWaypointTargeted(vehicleMap[protocolId][deviceId].id, sequence);
    }
}

function processWaypointAchieved(protoclId, deviceId, sequence) {
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    console.log((new Date()) + ' videre-server: waypoint achieved ' + sequence);
	}

	clientComms.sendWaypointAchieved(vehicleMap[protocolId][deviceId].id, sequence);
    }
}

function processStatusText(protocolId, deviceId, severity, text) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    console.log((new Date()) + ' videre-server: processStatusText, sending: ' + severity + " : " + text);
	}

	// update state for vehicle
	// TODO: sort out how to persist this if required
	// vehicleMap[protocolId][deviceId].state.severity = severity;
	// vehicleMap[protocolId][deviceId].state.text = text;

	// send state changed message to clients
	clientComms.sendStatusMsg(vehicleMap[protocolId][deviceId].id, severity, text);
    }
}

/* TODO: figure out this one
function processSystemStateChanged(deviceId, systemStatus, systemStatusText) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    if(config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: processSystemStateChanged, sending: ' + systemStatus + " : " + systemStatusText);
	    } else {
		console.log((new Date()) + ' videre-server: sending system state for ' + vehicleMap[protocolId][deviceId].name);
	    }
	}
    }
}
*/

function processAutonomousModeChanged(protocolId, deviceId, enabled) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    if(config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: processAutonomousModeChanged, sending: ' + enabled);
	    } else {
		console.log((new Date()) + ' videre-server: sending autonomous ' + enabled + ' for ' + vehicleMap[protocolId][deviceId].name);
	    }
	}

	// update state for vehicle
	vehicleMap[protocolId][deviceId].state.autonomous = enabled;

	// send state changed message to clients
	clientComms.sendState(vehicleMap[protocolId][deviceId].id, vehicleMap[protocolId][deviceId].state);
    }
}

function processTestModeChanged(protocolId, deviceId, enabled) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    if(config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: processTestModeChanged, sending: ' + enabled);
	    } else {
		console.log((new Date()) + ' videre-server: sending test ' + enabled + ' for ' + vehicleMap[protocolId][deviceId].name);
	    }
	}

	// update state for vehicle
	vehicleMap[protocolId][deviceId].state.testMode = enabled;

	// send state changed message to clients
	clientComms.sendState(vehicleMap[protocolId][deviceId].id, vehicleMap[protocolId][deviceId].state);
    }
}

function processStabilizedModeChanged(protocolId, deviceId, enabled) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    if(config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: processStabilizedModeChanged, sending: ' + enabled);
	    } else {
		console.log((new Date()) + ' videre-server: sending stabilized ' + enabled + ' for ' + vehicleMap[protocolId][deviceId].name);
	    }
	}

	// update state for vehicle
	vehicleMap[protocolId][deviceId].state.stabilized = enabled;

	// send state changed message to clients
	clientComms.sendState(vehicleMap[protocolId][deviceId].id, vehicleMap[protocolId][deviceId].state);
    }
}

function processHardwareInLoopModeChanged(protocolId, deviceId, enabled) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    if(config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: processHardwareInLoopModeChanged, sending: ' + enabled);
	    } else {
		console.log((new Date()) + ' videre-server: sending hardware in loop ' + enabled + ' for ' + vehicleMap[protocolId][deviceId].name);
	    }
	}

	// update state for vehicle
	vehicleMap[protocolId][deviceId].state.hardwareInLoop = enabled;

	// send state changed message to clients
	clientComms.sendState(vehicleMap[protocolId][deviceId].id, vehicleMap[protocolId][deviceId].state);
    }
}

function processRemoteControlModeChanged(protocolId, deviceId, enabled) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    if(config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: processRemoteControlModeChanged, sending: ' + enabled);
	    } else {
		console.log((new Date()) + ' videre-server: sending remote control ' + enabled + ' for ' + vehicleMap[protocolId][deviceId].name);
	    }
	}

	// update state for vehicle
	vehicleMap[protocolId][deviceId].state.remoteControl = enabled;

	// send state changed message to clients
	clientComms.sendState(vehicleMap[protocolId][deviceId].id, vehicleMap[protocolId][deviceId].state);
    }
}

function processGuidedModeChanged(protocolId, deviceId, enabled) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    if(config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: processGuidedModeChanged, sending: ' + enabled);
	    } else {
		console.log((new Date()) + ' videre-server: sending guided ' + enabled + ' for ' + vehicleMap[protocolId][deviceId].name);
	    }
	}

	// update state for vehicle
	vehicleMap[protocolId][deviceId].state.guided = enabled;

	// send state changed message to clients
	clientComms.sendState(vehicleMap[protocolId][deviceId].id, vehicleMap[protocolId][deviceId].state);
    }
}

function processArmedModeChanged(protocolId, deviceId, enabled) {
    // lookup vehicle based on device id
    if(vehicleMap[protocolId][deviceId] !== undefined && vehicleMap[protocolId][deviceId] !== null) {
        if(config.debug) {
	    if(config.debugLevel > 3) {
		console.log((new Date()) + ' videre-server: processAutonomousModeChanged, sending: ' + enabled);
	    } else {
		console.log((new Date()) + ' videre-server: sending armed ' + enabled + ' for ' + vehicleMap[protocolId][deviceId].name);
	    }
	}

	// update state for vehicle
	vehicleMap[protocolId][deviceId].state.armed = enabled;

	// send state changed message to clients
	clientComms.sendState(vehicleMap[protocolId][deviceId].id, vehicleMap[protocolId][deviceId].state);
    }
}


/*
 * process payload
 *
 * capture payload and pass to the clients
 *
 * note: some devices may pass payload and telemetry together
 */
function processPayload(deviceId, payload) {
    if(config.debug && config.debugLevel > 1) {
	console.log((new Date()) + ' videre-server: process payload');
	console.log(d);
    }
}

/*
 * telemetry auto send 
 *
 * first a check to send telemetry at a regular interval
 */
function telemetryAutoSend() {
    checkSendTelemetry();
    setTimeout(telemetryAutoSend, config.telemetryTimer);
}

/*
 * check send telemetry
 *
 * checks if telemetry is dirty and sends to clients if it is
 *
 */
function checkSendTelemetry() {
    if(config.debug && config.debugLevel > 5) {
	console.log((new Date()) + ' videre-server: checkSendTelemetry, testing for telemetry to send');
    }

    if(vehicleMap === undefined) {
	return;
    }

    // iterate through vehicles, 
    for(var i in vehicleMap) {
	for(var j in vehicleMap[i]) {

	    //console.log(" tele not undef: " + (vehicleMap[i].telemetry !== undefined));
	    // check if telemetry has been updated since last send
	    if(vehicleMap[i][j] !== undefined && 
		vehicleMap[i][j] !== null &&
		vehicleMap[i][j].telemetry !== undefined && 
		vehicleMap[i][j].telemetry.dirty) {

		if(config.debug) {
		    if(config.debugLevel > 3) {
			console.log((new Date()) + ' videre-server: checkSendTelemetry, sending: ' + JSON.stringify(
			    vehicleMap[i][j].telemetry
			));
		    } else {
			console.log((new Date()) + ' videre-server: checkSendTelemetry, sending for ' + vehicleMap[i][j].name);
		    }
		}
		clientComms.sendTelemetry(vehicleMap[i][j].id, vehicleMap[i][j].telemetry);
		vehicleMap[i][j].telemetry.dirty = false;
	    }
	}
    }
}

/** 
 * find VehicleById - finds the vehicle based on it's id
 * 
 * returns -1 if not found, otherwise the index in the vehicles array
 */
function findVehicleById(id) {
    var vehicle = null;

    // if id isn't set then return
    if(!id) {
	return vehicle;
    }

    for(var i in vehicles) {
	for(var j = 0, l = vehicles[i].length; j < l; j++) {
	    if(vehicles[i][j].id === id) {
		return vehicles[i][j];
	    }
	}
    }

    return vehicle;
}

/** 
 * find VehicleByDeviceId - finds the vehicle based on the device id
 * 
 * returns -1 if not found, otherwise the index in the vehicles array
 */
function findVehicleByDeviceId(protocolId, deviceId) {
    var index = -1;

    // if id isn't set then return
    if(deviceId === undefined || vehicles[protocolId] === undefined) {
	return index;
    }

    for(var i = 0, l = vehicles[protocolId].length; i < l; i++) {
	if(vehicles[protocolId][i].deviceId !== undefined && vehicles[protocolId][i].deviceId === deviceId) {
	    index = i;
	    break;
	}
    }

    return index;
}

function findDeviceCommsByVehicleId(vehicleId) {
    // if id isn't set then return
    if(vehicleId === undefined) {
	return null;
    }

    for(var i in deviceComms) {
	if(deviceComms[i].devices === undefined) {
	    continue;
	}
	for(var j in deviceComms[i].devices) {
	    if(deviceComms[i].devices[j].vehicleId === vehicleId) {
		return deviceComms[i];
	    }
	}
    }

    return null;
}
