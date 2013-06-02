
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
    debugWaypoints: true,
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
        " yaw: "  +  attitude.yaw +
        " heading: " + heading);
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

mavlinkProtocol1.on('systemState', function(protocolId, deviceId, batteryVoltage, batteryCurrent, batteryRemaining, commDropRate, commErrors) {
    console.log("test1: " + protocolId + ", " + deviceId + " system state: " + 
	" battery voltage: " + batteryVoltage +
	" battery current: " + batteryCurrent +
	" battery remaining: " + batteryRemaining +
	" comm drop rate: " + commDropRate +
	" comm errors: " + commErrors);
});

mavlinkProtocol1.on('systemStatusChanged', function(protocolId, deviceId, systemStatus, systemStatusText) {
    console.log("test1: " + protocolId + ", " + deviceId + " system status changed: " + systemStatus + " : " + systemStatusText);
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

/*
setTimeout(function() {
    console.log("test1: clearing waypoints");

    deviceId = vehicles['/dev/ttyUSB0']['1'];
    if(!mavlinkProtocol1.requestClearWaypoints.call(mavlinkProtocol1, deviceId)) {
	console.log("error requesting clear waypoints");
    }
}, 20000);
*/
