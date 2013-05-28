
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

console.log("test1: instantiating mavlinkProtocol");

var mavlinkProtocol1 = new MavlinkProtocol({
    debug: DEBUG,
    getDeviceIdFunction: getId,
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

mavlinkProtocol1.on('attitude', function(deviceId, attitude) {
    console.log("test1: " + deviceId + " attitude pitch: " + attitude.pitch + " roll: " + attitude.roll + " yaw: "  +  attitude.yaw);
});
mavlinkProtocol1.on('positionGPSRawInt', function(deviceId, position) {
    console.log("test1: " + deviceId + " gps lat "  + position.latitude + " lng " + position.longitude + " alt " + position.altitude);
});
mavlinkProtocol1.on('retreivedNoWaypoints', function(deviceId, waypoints) {
    console.log("test1: " + deviceId + " retreived no waypoints");
    waypoints = waypoints;
});
mavlinkProtocol1.on('retreivedWaypoints', function(deviceId, waypoints) {
    console.log("test1: " + deviceId + " retreived waypoints: " + JSON.stringify(waypoints, null, '\t'));
    waypoints = waypoints;
});
mavlinkProtocol1.on('setWaypointsSuccessful', function(deviceId) {
    console.log("test1: " + deviceId + " set waypoints successful");
});
mavlinkProtocol1.on('setWaypointsError', function(deviceId, text) {
    console.log("test1: " + deviceId + " set waypoints error: " + text);
});
mavlinkProtocol1.on('targetWaypoint', function(deviceId, sequence) {
    console.log("test1: " + deviceId + " targeted waypoint: " + sequence);
});
mavlinkProtocol1.on('waypointAchieved', function(deviceId, sequence) {
    console.log("test1: " + deviceId + " waypoint achieved: " + sequence);
});
mavlinkProtocol1.on('statusText', function(deviceId, severity, text) {
    console.log("test1: " + deviceId + " status text: " + severity + " : " + text);
});

mavlinkProtocol1.on('systemState', function(deviceId, batteryVoltage, batteryCurrent, batteryRemaining, commDropRate, commErrors) {
    console.log("test1: " + deviceId + " system state: " + 
	" battery voltage: " + batteryVoltage +
	" battery current: " + batteryCurrent +
	" battery remaining: " + batteryRemaining +
	" comm drop rate: " + commDropRate +
	" comm errors: " + commErrors);
});

mavlinkProtocol1.on('systemStatusChanged', function(deviceId, systemStatus, systemStatusText) {
    console.log("test1: " + deviceId + " system status changed: " + systemStatus + " : " + systemStatusText);
});

mavlinkProtocol1.connect();


var vehicles = [null, null];

function getId(id) {
    // lookup to see if id exists
    if(vehicles[id] === null) {
	// doesn't exist so create it
        vehicles[id] = uuid.v4({rng: uuid.nodeRNG});
    }

    // exists so return it
    return vehicles[id];
}

function getOptions(id) {
    return {
	pitchAccuracy: 0.001,
	rollAccuracy: 0.001,
	yawAccuracy: 0.03,
	positionMode: Protocol.POSITION_MODE_POSITION,
	positionDiff: 1,
    };
}

var sysId = vehicles['1'];
var waypoints = null;

setTimeout(function() {

    deviceId = vehicles['1'];
    console.log("test1: requesting waypoints for " + deviceId);

    var i = mavlinkProtocol1.requestWaypoints.call(mavlinkProtocol1, deviceId);
    if(!i) {
	console.log("error " + i + " requesting waypoints");
    }
}, 3000);

setTimeout(function() {
    if(waypoints != null) {
	deviceId = vehicles['1'];
	console.log("test1: requesting to set waypoints for " + deviceId);

	var i = mavlinkProtocol1.requestSetWaypoints.call(mavlinkProtocol1, deviceId, waypoints);

	if(!i) {
	    console.log("error " + i + " requesting to set waypoints");
	}
    }
}, 10000);

setTimeout(function() {
    var targetedWaypoint = 3;
    deviceId = vehicles['1'];
    console.log("test1: set target waypoint " + targetedWaypoint + " for " + deviceId);
    var rtnVal = mavlinkProtocol1.requestSetTargetWaypoint.call(mavlinkProtocol1, deviceId, targetedWaypoint) 
    if(rtnVal !== 1) {
	console.log("error requesting set target waypoint: " + rtnVal);
    }
}, 15000);

/*
setTimeout(function() {
    console.log("test1: clearing waypoints");

    deviceId = vehicles['1'];
    if(!mavlinkProtocol1.requestClearWaypoints.call(mavlinkProtocol1, deviceId)) {
	console.log("error requesting clear waypoints");
    }
}, 20000);
*/
