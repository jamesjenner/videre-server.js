
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
    setWaypointsSuccessfulListener: setWaypointsSuccess

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

// TODO: how to handle timeouts? ...
setTimeout(function() {
console.log("***************************************************************");
    console.log("test1: requetsing waypoints");
    var i = mavlinkProtocol.requestWaypoints.call(mavlinkProtocol);
}, 3000);

setTimeout(function() {
console.log("***************************************************************");
    console.log("test1: requetsing set waypoints");
    if(waypoints != null) {
	var i = mavlinkProtocol.requestSetWaypoints.call(mavlinkProtocol, waypoints);
    }
}, 10000);

/*
setTimeout(function() {
    var i = mavlinkProtocol.requestWaypoints.call(mavlinkProtocol);
}, 60000);
*/
