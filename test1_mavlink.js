
/**
 * test1 - testing mavlinkProtocol.js 
 */

var COMPORT1 = "/dev/ttyUSB0";
var COMPORT2 = "/dev/ttyUSB1";
var BAUD = 57600;

var DEBUG = true;
var DEBUG_LEVEL = 4;

var MavlinkProtocol = require('./protocols/mavlinkProtocol.js');
var Protocol        = require('./protocols/protocol.js');
var uuid            = require('node-uuid');

console.log("test1: instantiating mavlinkProtocol");

var mavlinkProtocol1 = new MavlinkProtocol({
    debug: DEBUG,
    getDeviceIdFunction: getId,
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
    positionMode: Protocol.POSITION_MODE_DISTANCE ,
    positionDiff: 1, 
    debugLevel: DEBUG_LEVEL,
    connectionMethod: Protocol.CONNECTION_SERIAL,
    pitchAccuracy: 0.003,
    rollAccuracy: 0.003,
    yawAccuracy: 0.05,
});

// setListeners(mavlinkProtocol1);
mavlinkProtocol1.on('attitude', function(id, attitude) {
    console.log("test1: " + id + " attitude pitch: " + attitude.pitch + " roll: " + attitude.roll + " yaw: "  +  attitude.yaw);
});

mavlinkProtocol1.on('positionGPSRawInt', function(id, position) {
    console.log("test1: " + id + " lat "  + position.latitude + " lng " + position.longitude + " alt " + position.altitude);
});

mavlinkProtocol1.connect();

var mavlinkProtocol2 = new MavlinkProtocol({
    name: 'Drone 2',
    debug: DEBUG,
    debugWaypoints: false,
    debugHeartbeat: false,
    debugMessage: false,
    debugAttitude: false,
    debugIMU: false,
    debugGPS: false,
    debugVFR_HUD: false,
    debugGPSRaw: false,
    debugGPSStatus: false,
    serialPort: COMPORT2,
    serialBaud: BAUD,
    positionMode: MavlinkProtocol.POSITION_MODE_DISTANCE ,
    positionDiff: 1, 
    debugLevel: DEBUG_LEVEL,
    connectionMethod: MavlinkProtocol.CONNECTION_SERIAL,
});

// setListeners(mavlinkProtocol2);
mavlinkProtocol2.on('attitude', makeListener.call(mavlinkProtocol2));
mavlinkProtocol2.connect();

function makeListener() {
    var self = this;
    return function(attitude) {
	console.log("test1: " + self.name + " attitude pitch: " + attitude.pitch + " roll: " + attitude.roll + " yaw: "  +  attitude.yaw);
    }
}

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
function setListeners(mavlinkProtocol) {
    /*
    mavlinkProtocol.on('attitude', function(attitude) {
	console.log("test1: " + mavlinkProtocol.name + " attitude pitch: " + attitude.pitch + " roll: " + attitude.roll + " yaw: "  +  attitude.yaw);
    });
    */
    mavlinkProtocol.on('attitude', makeListener.call(mavlinkProtocol));

    /*
    mavlinkProtocol.on('stateChanged', function(value, text) {
    });

    mavlinkProtocol.on('positionGPSRawInt', function(position) {
    });

    mavlinkProtocol.on('systemStatusChanged', function(systemStatus, systemStatusText) {
    });

    mavlinkProtocol.on('autonomousModeChanged', function(autonomousMode) {
    });

    mavlinkProtocol.on('testModeChanged', function(testMode) {
    });

    mavlinkProtocol.on('stabilizedModeChanged', function(stabilizedMode) {
    });

    mavlinkProtocol.on('hardwareInLoopModeChanged', function(hardwareInLoop) {
    });

    mavlinkProtocol.on('remoteControlModeChanged', function(remoteControl) {
    });

    mavlinkProtocol.on('guidedModeChanged', function(guided) {
    });

    mavlinkProtocol.on('armedModeChanged', function(armed) {
    });

    mavlinkProtocol.on('retreivedWaypoints', function(data) {
    });

    mavlinkProtocol.on('setWaypointsError', function(text) {
    });

    mavlinkProtocol.on('setWaypointsSuccessful', function() {
    });

    mavlinkProtocol.on('setWaypointAcheived', function(waypoint) {
    });

    mavlinkProtocol.on('targetWaypoint', function(waypoint) {
    });

    mavlinkProtocol.on('waypointAchieved', function(waypoint) {
    });

    mavlinkProtocol.on('systemState', function(batteryVoltage, batteryCurrent, batteryRemaining, commDropRate, commErrors) {
    });

    mavlinkProtocol.on('statusText', function(severity, text) {
    });
    */
}

/*
setTimeout(function() {
    console.log("test1: requesting waypoints");

    var i = mavlinkProtocol.requestWaypoints.call(mavlinkProtocol);
    if(!i) {
	console.log("error " + i + " requesting waypoints");
    }
}, 3000);

setTimeout(function() {
    if(waypoints != null) {
	console.log("test1: requesting set waypoints");

	var i = mavlinkProtocol.requestSetWaypoints.call(mavlinkProtocol, waypoints);

	if(!i) {
	    console.log("error " + i + " requesting to set waypoints");
	}
    }
}, 10000);

setTimeout(function() {
    console.log("test1: set target waypoint");

    if(!mavlinkProtocol.requestSetTargetWaypoint.call(mavlinkProtocol, 3)) {
	console.log("error requesting set target waypoint");
    }
}, 15000);

setTimeout(function() {
    console.log("test1: clearing waypoints");

    if(!mavlinkProtocol.requestClearWaypoints.call(mavlinkProtocol)) {
	console.log("error requesting clear waypoints");
    }
}, 20000);

*/
