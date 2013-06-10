
/**
 * test1 - testing mavlinkProtocol.js 
 */

var COMPORT1 = "/dev/ttyUSB0";
var COMPORT2 = "/dev/ttyUSB1";
var BAUD = 57600;

var DEBUG = true;
var DEBUG_LEVEL = 3;

var MavlinkProtocol = require('./protocols/mavlinkProtocol.js');
var Protocol        = require('./protocols/protocol.js');
var uuid            = require('node-uuid');
var Vehicle               = require('./videre-common/js/vehicle.js');

console.log("test1: instantiating mavlinkProtocol");

var mavlinkProtocol1 = new MavlinkProtocol({
    debug: DEBUG,
    getVehicleIdFunction: getId,
    getDeviceOptionsFunction: getOptions,
    debugWaypoints: false,
    debugHeartbeat: false,
    debugMessage: false,
    debugAttitude: false,
    debugIMU: false,
    debugGPS: false,
    debugVFR_HUD: false,
    debugGPSRaw: false,
    debugGPSStatus: false,
    serialPort: COMPORT1,
    serialBaud: BAUD,
    debugLevel: DEBUG_LEVEL,
    connectionMethod: Protocol.CONNECTION_SERIAL,
});

mavlinkProtocol1.on('attitude', function(protocolId, deviceId, attitude, heading) {
    console.log("test1: " + protocolId + ", " + deviceId + 
        " attitude pitch: " + attitude.pitch + 
        " roll: " + attitude.roll + 
        " yaw: "  +  attitude.yaw);
});
mavlinkProtocol1.on('heading', function(protocolId, deviceId, heading) {
    console.log("test1: " + protocolId + ", " + deviceId + 
        " heading: " + heading );
});
mavlinkProtocol1.on('positionGPSRawInt', function(protocolId, deviceId, position) {
    console.log("test1: " + protocolId + ", " + deviceId + " gps" +
        " lat "  + position.latitude + 
        " lng " + position.longitude + 
        " alt " + position.altitude);
});
mavlinkProtocol1.on('retreivedNoWaypoints', function(protocolId, deviceId) {
    console.log("test1: " + protocolId + ", " + deviceId + " retreived no waypoints");
    waypoints = null;
});
mavlinkProtocol1.on('retreivedWaypoints', function(protocolId, deviceId, newWaypoints) {
    console.log("test1: " + protocolId + ", " + deviceId + " retreived waypoints: " + JSON.stringify(newWaypoints, null, '\t'));
    waypoints = newWaypoints;
});
mavlinkProtocol1.on('setWaypointsSuccessful', function(protocolId, deviceId) {
    console.log("test1: " + protocolId + ", " + deviceId + " set waypoints successful");
});
mavlinkProtocol1.on('setWaypointsError', function(protocolId, deviceId, text) {
    console.log("test1: " + protocolId + ", " + deviceId + " set waypoints error: " + text);
});
mavlinkProtocol1.on('targetWaypoint', function(protocolId, deviceId, sequence) {
    console.log("test1: " + protocolId + ", " + deviceId + " targeted waypoint: " + sequence);
});
mavlinkProtocol1.on('waypointAchieved', function(protocolId, deviceId, sequence) {
    console.log("test1: " + protocolId + ", " + deviceId + " waypoint achieved: " + sequence);
});
mavlinkProtocol1.on('statusText', function(protocolId, deviceId, severity, text) {
    console.log("test1: " + protocolId + ", " + deviceId + " status text: " + severity + " : " + text);
});

mavlinkProtocol1.on('autoPilotType', function(protocolId, deviceId, text) {
    console.log("test1: " + protocolId + ", " + deviceId + " pilot type: " + text);
});
mavlinkProtocol1.on('deviceType', function(protocolId, deviceId, text) {
    console.log("test1: " + protocolId + ", " + deviceId + " device type: " + text);
});

mavlinkProtocol1.on('batteryState', function(protocolId, deviceId, batteryVoltage, batteryCurrent, batteryRemaining) {
    console.log("test1: " + protocolId + ", " + deviceId + " battery state: " + 
	" battery voltage: " + batteryVoltage +
	" battery current: " + batteryCurrent +
	" battery remaining: " + batteryRemaining);
});

mavlinkProtocol1.on('commState', function(protocolId, deviceId, commDropRate, commErrors) {
    console.log("test1: " + protocolId + ", " + deviceId + " comm state: " + 
	" comm drop rate: " + commDropRate +
	" comm errors: " + commErrors);
});

mavlinkProtocol1.on('systemStatusChanged', function(protocolId, deviceId, systemStatus, systemStatusText) {
    console.log("test1: " + protocolId + ", " + deviceId + " system status changed: " + systemStatus + " : " + systemStatusText);
});

mavlinkProtocol1.on('autonomousModeChanged', function(protocolId, deviceId, state) {
    console.log("test1: " + protocolId + ", " + deviceId + " Autonomous mode changed: " + state);
});
mavlinkProtocol1.on('testModeChanged', function(protocolId, deviceId, state) {
    console.log("test1: " + protocolId + ", " + deviceId + " Test mode changed: " + state);
});
mavlinkProtocol1.on('stabilizedModeChanged', function(protocolId, deviceId, state) {
    console.log("test1: " + protocolId + ", " + deviceId + " Stabilized mode changed: " + state);
});
mavlinkProtocol1.on('hardwareInLoopModeChanged', function(protocolId, deviceId, state) {
    console.log("test1: " + protocolId + ", " + deviceId + " Hardware in loop changed: " + state);
});
mavlinkProtocol1.on('remoteControlModeChanged', function(protocolId, deviceId, state) {
    console.log("test1: " + protocolId + ", " + deviceId + " Remote control changed: " + state);
});
mavlinkProtocol1.on('guidedModeChanged', function(protocolId, deviceId, state) {
    console.log("test1: " + protocolId + ", " + deviceId + " Guided mode changed: " + state);
});
mavlinkProtocol1.on('armedModeChanged', function(protocolId, deviceId, state) {
    console.log("test1: " + protocolId + ", " + deviceId + " Armed mode changed: " + state);
});
	
mavlinkProtocol1.connect();


var vehicles = new Object();

function getId(protocolId, deviceId, name) {
    if(vehicles[protocolId] === undefined) {
	vehicles[protocolId] = new Object();
    }

    // lookup to see if id exists
    if(vehicles[protocolId][deviceId] === undefined) {
	// doesn't exist so create it

	vehicles[protocolId][deviceId] = new Vehicle();
	vehicles[protocolId][deviceId].id = uuid.v4({rng: uuid.nodeRNG});
	console.log("getId, setting vehicles[" + protcolId + "][" + deviceId + "] => " + vehicles[protocolId][deviceId].id);
    }

    // exists so return it
    return vehicles[protocolId][deviceId].id;
}

function getOptions(protocolId, id) {
    return {
	pitchAccuracy: 0.5,
	rollAccuracy: 0.5,
	yawAccuracy: 3,
	positionMode: Protocol.POSITION_MODE_DISTANCE,
	positionDiff: 1,
    };
}

var deviceId = '1';

var waypoints = null;

setTimeout(function() {
    var vehicleId = vehicles[COMPORT1]['1'].id;
    console.log("test1: requesting arming for " + vehicleId);
    if(mavlinkProtocol1.setArmedMode.call(mavlinkProtocol1, vehicleId, true)) {
	console.log("test1: requesting arming sent");
    } else {
	console.log("test1: requesting arming not required");
    }
}, 3000);

setTimeout(function() {
    var vehicleId = vehicles[COMPORT1]['1'].id;
    console.log("test1: requesting stabilized mode enabled for " + vehicleId);
    if(mavlinkProtocol1.setStabilizedMode.call(mavlinkProtocol1, vehicleId, true)) {
	console.log("test1: requesting stabilized mode enabled sent");
    } else {
	console.log("test1: requesting stabilized mode enabled not required");
    }
}, 6000);

setTimeout(function() {
    var vehicleId = vehicles[COMPORT1]['1'].id;
    console.log("test1: requesting autonomous mode enabled for " + vehicleId);
    if(mavlinkProtocol1.setAutonomousMode.call(mavlinkProtocol1, vehicleId, true)) {
	console.log("test1: requesting autonomous mode enabled sent");
    } else {
	console.log("test1: requesting autonomous mode enabled not required");
    }
}, 9000);

setTimeout(function() {
    var vehicleId = vehicles[COMPORT1]['1'].id;
    console.log("test1: requesting autonomous mode disabled for " + vehicleId);
    if(mavlinkProtocol1.setAutonomousMode.call(mavlinkProtocol1, vehicleId, false)) {
	console.log("test1: requesting autonomous mode disabled sent");
    } else {
	console.log("test1: requesting autonomous mode disabled not required");
    }
}, 12000);

setTimeout(function() {
    var vehicleId = vehicles[COMPORT1]['1'].id;
    console.log("test1: requesting stabilized mode disabled for " + vehicleId);
    if(mavlinkProtocol1.setStabilizedMode.call(mavlinkProtocol1, vehicleId, false)) {
	console.log("test1: requesting stabilized mode disabled sent");
    } else {
	console.log("test1: requesting stabilized mode disabled not required");
    }
}, 15000);

setTimeout(function() {
    var vehicleId = vehicles[COMPORT1]['1'].id;
    console.log("test1: requesting disarming for " + vehicleId);
    if(mavlinkProtocol1.setArmedMode.call(mavlinkProtocol1, vehicleId, false)) {
	console.log("test1: requesting disarming sent");
    } else {
	console.log("test1: requesting disarming not required");
    }
}, 18000);


/*
// request to retrieve waypoints
setTimeout(function() {

    var vehicleId = vehicles['/dev/ttyUSB0']['1'].id;
    console.log("test1: requesting waypoints for " + vehicleId);

    var i = mavlinkProtocol1.requestWaypoints.call(mavlinkProtocol1, vehicleId);
    if(!i) {
	console.log("error " + i + " requesting waypoints");
    }
}, 3000);

// request to set waypoints
setTimeout(function() {
    if(waypoints != null) {
	var vehicleId = vehicles['/dev/ttyUSB0']['1'].id;
	console.log("test1: requesting to set waypoints for " + vehicleId);

	var i = mavlinkProtocol1.requestSetWaypoints.call(mavlinkProtocol1, vehicleId, waypoints);

	if(!i) {
	    console.log("error " + i + " requesting to set waypoints");
	}
    }
}, 10000);

// request to target specific waypoint
setTimeout(function() {
    var targetedWaypoint = 3;
    var vehicleId = vehicles['/dev/ttyUSB0']['1'].id;
    console.log("test1: set target waypoint " + targetedWaypoint + " for " + vehicleId);

    var rtnVal = mavlinkProtocol1.requestSetTargetWaypoint.call(mavlinkProtocol1, vehicleId, targetedWaypoint) 

    if(rtnVal !== 1) {
	console.log("error requesting set target waypoint: " + rtnVal);
    }
}, 15000);

setTimeout(function() {
    console.log("test1: clearing waypoints");

    deviceId = vehicles['/dev/ttyUSB0']['1'];
    if(!mavlinkProtocol1.requestClearWaypoints.call(mavlinkProtocol1, deviceId)) {
	console.log("error requesting clear waypoints");
    }
}, 20000);
*/
