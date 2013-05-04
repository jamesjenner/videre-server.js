
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
    stateChangedListener: stateChanged,
    modeChangedListener: modeChanged,
    retreivedWaypointsListener: retreivedWaypoints,
    setWaypointsErrorListener: setWaypointsFail,
    setWaypointsSuccessfulListener: setWaypointsSuccess,
    setWaypointAchievedListener: setWaypointAcheived, 
    setWaypointTargetListener: setWaypointTarget, 

});

console.log("***************************************************************");
console.log("test1: connecting");
mavlinkProtocol.connect();

function stateChanged(value, text) {
console.log("***************************************************************");
    console.log("state: " + text);
}
function modeChanged() {
console.log("***************************************************************");
    console.log("mode: ");
    console.log("       autonomous:       " + mavlinkProtocol.autonomousMode);
    console.log("       test mode:        " + mavlinkProtocol.testMode);
    console.log("       stablized:        " + mavlinkProtocol.stablizedMode);
    console.log("       hardware in loop: " + mavlinkProtocol.hardwareInLoop);
    console.log("       remote control:   " + mavlinkProtocol.remoteControl);
    console.log("       guided:           " + mavlinkProtocol.guided);
    console.log("       armed:            " + mavlinkProtocol.armed);
}

var waypoints = null;

function retreivedWaypoints(data) {
    console.log("***************************************************************");
    console.log("test1: waypoints retreived");
    console.log(JSON.stringify(data, null, '\t'));

    waypoints = data;
}

function setWaypointsFail(text) {
    console.log("***************************************************************");
    console.log("test1: setting waypoints failed: " + text);
}

function setWaypointsSuccess() {
    console.log("***************************************************************");
    console.log("test1: setting waypoints worked!");
}

function setWaypointAcheived(waypoint) {
    console.log("***************************************************************");
    console.log("test1: waypoint acheived: " + waypoint);
}
function setWaypointTarget(waypoint) {
    console.log("***************************************************************");
    console.log("test1: targeted waypoint: " + waypoint);
}

setTimeout(function() {
    console.log("***************************************************************");
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

