
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
    debugLevel: DEBUG_LEVEL,
    connectionMethod: MavlinkProtocol.CONNECTION_SERIAL,
    stateChangedListener: stateChanged,
    modeChangedListener: modeChanged,
    retreivedWaypointsListener: retreivedWaypoints


});

console.log("test1: connecting");
mavlinkProtocol.connect();

function stateChanged(value, text) {
    console.log("state: " + text);
}
function modeChanged() {
    console.log("mode: ");
    console.log("       autonomous:       " + mavlinkProtocol.autonomousMode);
    console.log("       test mode:        " + mavlinkProtocol.testMode);
    console.log("       stablized:        " + mavlinkProtocol.stablizedMode);
    console.log("       hardware in loop: " + mavlinkProtocol.hardwareInLoop);
    console.log("       remote control:   " + mavlinkProtocol.remoteControl);
    console.log("       guided:           " + mavlinkProtocol.guided);
    console.log("       armed:            " + mavlinkProtocol.armed);
}
function retreivedWaypoints(waypoints) {
    console.log("test1: waypoints retreived");
    console.log(JSON.stringify(waypoints, null, '\t'));
}

// TODO: how to handle timeouts? ...
setTimeout(function() {
    var i = mavlinkProtocol.requestWaypoints.call(mavlinkProtocol);
}, 3000);

setTimeout(function() {
    var i = mavlinkProtocol.requestWaypoints.call(mavlinkProtocol);
}, 5000);

setTimeout(function() {
    var i = mavlinkProtocol.requestWaypoints.call(mavlinkProtocol);
}, 60000);
