
/**
 * test1 - testing mavlinkProtocol.js 
 */

var COMPORT = "/dev/ttyUSB0";
var BAUD = 57600;

var DEBUG = true;
var DEBUG_LEVEL = 2;

var MavlinkProtocol = require('./vehicle/mavlinkProtocol.js');

console.log("test1: instantiating mavlinkProtocol");

var mavlinkProtocol = new MavlinkProtocol({
    debug: DEBUG,
    debugWaypoints: true,
    debugHeartbeat: false,
    debugMessage: false,
    debugLevel: DEBUG_LEVEL,
    connectionMethod: MavlinkProtocol.CONNECTION_SERIAL,

});

console.log("***************************************************************");
console.log("test1: connecting");

mavlinkProtocol.on('stateChanged', function(value, text) {
    console.log("***************************************************************");
    console.log("state: " + text);
});

mavlinkProtocol.on('modeChanged', function() {
    console.log("***************************************************************");
    console.log("mode: ");
    console.log("       autonomous:       " + mavlinkProtocol.autonomousMode);
    console.log("       test mode:        " + mavlinkProtocol.testMode);
    console.log("       stablized:        " + mavlinkProtocol.stablizedMode);
    console.log("       hardware in loop: " + mavlinkProtocol.hardwareInLoop);
    console.log("       remote control:   " + mavlinkProtocol.remoteControl);
    console.log("       guided:           " + mavlinkProtocol.guided);
    console.log("       armed:            " + mavlinkProtocol.armed);
});

var waypoints = null;

mavlinkProtocol.on('systemStatusChanged', function(systemStatus, systemStatusText) {
    console.log("test1: system status changed to " + systemStatusText);
});

mavlinkProtocol.on('autonomousModeChanged', function(autonomousMode) {
    console.log('test1: autonomous  ' + autonomousMode);
});

mavlinkProtocol.on('testModeChanged', function(testMode) {
    console.log('test1: test mode ' + testMode);
});

mavlinkProtocol.on('stabilizedModeChanged', function(stabilizedMode) {
    console.log('test1: stabilized  ' + stabilizedMode);
});

mavlinkProtocol.on('hardwareInLoopModeChanged', function(hardwareInLoop) {
    console.log('test1: hardwareInLoop  ' + hardwareInLoop);
});

mavlinkProtocol.on('remoteControlModeChanged', function(remoteControl) {
    console.log('test1: remoteControled ' + remoteControl);
});

mavlinkProtocol.on('guidedModeChanged', function(guided) {
    console.log('test1: guided  ' + guided);
});

mavlinkProtocol.on('armedModeChanged', function(armed) {
    console.log("test1: armed  " + armed);
});

mavlinkProtocol.on('retreivedWaypoints', function(data) {
    console.log("test1: waypoints retreived");
    console.log(JSON.stringify(data, null, '\t'));

    waypoints = data;
});

mavlinkProtocol.on('setWaypointsError', function(text) {
    console.log("test1: setting waypoints failed: " + text);
});

mavlinkProtocol.on('setWaypointsSuccessful', function() {
    console.log("test1: setting waypoints successful");
});

mavlinkProtocol.on('setWaypointAcheived', function(waypoint) {
    console.log("test1: waypoint acheived: " + waypoint);
});

mavlinkProtocol.on('targetWaypoint', function(waypoint) {
    console.log("test1: targeted waypoint: " + waypoint);
});

mavlinkProtocol.on('waypointAchieved', function(waypoint) {
    console.log("test1: waypoint acheived: " + waypoint);
});

mavlinkProtocol.connect();

setTimeout(function() {
    console.log("test1: requesting waypoints");

    var i = mavlinkProtocol.requestWaypoints.call(mavlinkProtocol);
    if(!i) {
	console.log("error " + i + " requesting waypoints");
    }
}, 3000);

setTimeout(function() {
    if(waypoints != null) {
	console.log("***************************************************************");
	console.log("test1: requesting set waypoints");

	var i = mavlinkProtocol.requestSetWaypoints.call(mavlinkProtocol, waypoints);

	if(!i) {
            console.log("error " + i + " requesting to set waypoints");
	}
    }
}, 10000);

setTimeout(function() {
    console.log("***************************************************************");
    console.log("test1: set target waypoint");

    if(!mavlinkProtocol.requestSetTargetWaypoint.call(mavlinkProtocol, 3)) {
	console.log("error requesting set target waypoint");
    }
}, 15000);

setTimeout(function() {
    console.log("***************************************************************");
    console.log("test1: clearing waypoints");

    if(!mavlinkProtocol.requestClearWaypoints.call(mavlinkProtocol)) {
	console.log("error requesting clear waypoints");
    }
}, 20000);

