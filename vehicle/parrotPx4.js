/*
 * parrotArDroneV1.js
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

var util            = require('util');
var arDrone         = require('ar-drone');

var QuadCopter      = require('./quadCopter.js');
var UnmannedVehicle = require('./unmannedVehicle.js');
var TransformParrot = require('./transform/transformParrotArDroneV1.js');
var State           = require('../videre-common/js/state');
var Attitude        = require('../videre-common/js/attitude');
var Telemetry       = require('../videre-common/js/telemetry');

var MavlinkProtocol = require('./mavlinkProtocol.js');


module.exports = ParrotPx4;

ParrotPx4.CTRL_DEFAULT = "CTRL_DEFAULT";
ParrotPx4.CTRL_INIT = "CTRL_INIT";
ParrotPx4.CTRL_LANDED = "CTRL_LANDED";
ParrotPx4.CTRL_FLYING = "CTRL_FLYING";
ParrotPx4.CTRL_HOVERING = "CTRL_HOVERING";
ParrotPx4.CTRL_TEST = "CTRL_TEST";
ParrotPx4.CTRL_TRANS_TAKEOFF = "CTRL_TRANS_TAKEOFF";
ParrotPx4.CTRL_TRANS_GOTOFIX = "CTRL_TRANS_GOTOFIX";
ParrotPx4.CTRL_TRANS_LANDING = "CTRL_TRANS_LANDING";
ParrotPx4.CTRL_TRANS_LOOPING = "CTRL_TRANS_LOOPING";

ParrotARDroneV1._transform = new TransformParrot();


function ParrotPx4(options) {
    ParrotPx4.super_.call(this, options);  // call the super constructr

    options = options || {};

    this.networkAddress = ((options.networkAddress != null) ? options.networkAddress : "localhost");
    this.networkPort = ((options.networkPort != null) ? options.networkPort : "9001");
    this.serialPort = ((options.serialPort != null) ? options.serialPort : "/dev/ttyUSB0");
    this.serialBaud = ((options.baud != null) ? options.baud : 57600);

    this.debug = ((options.debug != null) ? options.debug : false);
    this.debugLevel = options.debugLevel || 0;
    this.state = new State();
    this.batteryVoltage = 0;
    this.batteryCharge = 0;
    this.batteryCurrent = 0;
    this.commDropRate = 0;
    this.commErrors = 0;

    this.mavlinkDevice = new MavlinkProtocol({
	debug: this.debug,
	debugLevel: this.debugLevel,
	connectionMethod: MavlinkProtocol.CONNECTION_SERIAL,
        positionMode: MavlinkProtocol.POSITION_MODE_DISTANCE,
        serialPort: this.serialPort,
        serialBaud: this.serialBaud,
        networkAddress: this.networkAddress,
        networkPort this.networkPort,
        positionDiff: 1,
    });
}

util.inherits(ParrotPx4, QuadCopter);

ParrotPx4.prototype._processData = function(navData) {
    var telemetry = new Telemetry({
	state: d.controlState,
	batteryCharge: d.batteryPercentage,
	attitude: new Attitude({ pitch: d.rotation.pitch, roll: d.rotation.roll, yaw: d.rotation.yaw }),
	altitude: d.altitude,
	velocity: {x: d.xVelocity, y: d.yVelocity, z: d.zVelocity},
	batteryVoltage: = this.batteryVoltage,
	batteryCharge: = this.batteryRemaining,
	batteryCurrent: = this.batteryCurrent,
	commDropRate: = this.commDropRate,
	commErrors: this.CommErrors,
	});

    this._rcvdTelemetry(telemetry);
};

mavlinkProtocol.on('attitude', function(attitude) {
    console.log("test1: attitude pitch: " + attitude.pitch + " roll: " + attitude.roll + " yaw: "  +  attitude.yaw);
});

mavlinkProtocol.on('positionGPSRawInt', function(position) {
    this.position = position;
    this._rcvdPosition(this.position);
});

mavlinkProtocol.on('systemState', function(batteryVoltage, batteryCurrent, batteryRemaining, commDropRate, commErrors) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' battery voltage: ' + batteryVoltage +
	    ' battery charger: ' + batteryRemaining +
	    ' battery current: ' + batteryCurrent + 
	    ' comm drop rate: ' + commDropRate +
	    ' comm errors: ' + commErrors);
    }

    this.batteryVoltage = batteryVoltage;
    this.batteryCharge = batteryRemaining;
    this.batteryCurrent = batteryCurrent;
    this.commDropRate = commDropRate;
    this.commErrors = CommErrors;
});

mavlinkProtocol.on('statusText', function(severity, text) {
    console.log("test1:" + 
	" status: " + severity + 
	" : " + text); 
    // TODO: figure out how this should be used, if it is used
});

mavlinkProtocol.on('positionGPSRawInt', function(position) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
            ' gps position lat: ' + position.latitude + ' lng: ' + position.longitude + ' alt: ' + position.altitude);
    }

    this.position = position;
    this._position(this.position);
});

mavlinkDevice.on('stateChanged', function(value, text) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' system status changed to: ' + value + ' : ' + text);
    }

    this.state.state = value;
    this._stateChanged(this.state);
});

mavlinkDevice.on('autonomousModeChanged', function(autonomousMode) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' autonomous mode: ' + systemStatusText);
    }

    this.state.autonomous = autonomousMode;
    this._stateChanged(this.state);
});

mavlinkDevice.on('testModeChanged', function(testMode) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' test mode: ' + systemStatusText);
    }

    this.state.testMode = testMode;
    this._stateChanged(this.state);
});

mavlinkDevice.on('stabilizedModeChanged', function(stabilizedMode) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' stabilized mode: ' + systemStatusText);
    }

    this.state.stabilized = stablizedMode;
    this._stateChanged(this.state);
});

mavlinkDevice.on('hardwareInLoopModeChanged', function(hardwareInLoop) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' hardware in loop mode: ' + systemStatusText);
    }

    this.state.hardwareInLoop = hardwareInLoop;
    this._stateChanged(this.state);
});

mavlinkDevice.on('remoteControlModeChanged', function(remoteControl) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' remote control mode: ' + systemStatusText);
    }

    this.state.remoteControl = remoteControl;
    this._stateChanged(this.state);
});

mavlinkDevice.on('guidedModeChanged', function(guided) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' guided mode: ' + systemStatusText);
    }

    this.state.guided = guided;
    this._stateChanged(this.state);
});

mavlinkDevice.on('armedModeChanged', function(armed) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' armed mode: ' + systemStatusText);
    }

    this.state.armed = armed;
    this._stateChanged(this.state);
});

mavlinkDevice.on('retreivedWaypoints', function(data) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' waypoints retreived.');
    }

    this._waypointsRetreived(data);
});

mavlinkDevice.on('setWaypointsError', function(text) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' waypoints set failed: ' + text);
    }

    this._waypointsSetFailed(text);
});

mavlinkDevice.on('setWaypointsSuccessful', function() {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' waypoints set successful');
    }

    this._waypointsSetSuccessful();
});

mavlinkDevice.on('targetWaypoint', function(waypoint) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' waypoint targeted: ' + waypoint);
    }

    this._waypointTargeted(waypoint);
});

mavlinkDevice.on('waypointAchieved', function(waypoint) {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' waypoint acheived: ' + waypoint);
    }

    this._waypointAchieved(waypoint);
});

QuadCopter.prototype.connect = function() {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' connecting.');
    }

    this.mavlinkDevice.connect();

    this._connectionState(UnmannedVehicle.COMMS_CONNECTED);
};

QuadCopter.prototype.disconnect = function() {
    if(this.debug && this.debugLevel > 2) {
	console.log(
	    (new Date()) + ' ' + this.name + 
	    ' disconnecting.');
    }

    this.mavlinkDevice.disconnect();

    this._connectionState(UnmannedVehicle.COMMS_DISCONNECTED);
};

QuadCopter.prototype.reconnect = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' reset');
    }

    this.mavlinkDevice.disconnect();
    this.mavlinkDevice.connect();

    this._connectionState(UnmannedVehicle.COMMS_CONNECTED);
};

QuadCopter.prototype.reset = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' reset');
    }
};

QuadCopter.prototype.takeoff = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' takeoff ');
    }
};

QuadCopter.prototype.land = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' land');
    }
};

QuadCopter.prototype.up = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' up: ');
    }
};

QuadCopter.prototype.down = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' down: ');
    }
};

QuadCopter.prototype.left = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' left: ');
    }
};

QuadCopter.prototype.right = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' right: ');
    }
};

QuadCopter.prototype.turnLeft = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' turnLeft: ');
    }
};

QuadCopter.prototype.turnRight = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' turnRight: ');
    }
};

QuadCopter.prototype.forward = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' forward: ');
    }
};

QuadCopter.prototype.reverse = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' reverse: ');
    }
};

QuadCopter.prototype.abort = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' abort');
    }
};

QuadCopter.prototype.stop = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' stop');
    }
};

QuadCopter.prototype.reset = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotPx4: ' + this.name + ' reset');
    }
};

parrotPx4.prototype.testRun = function() {
};

parrotPx4.prototype.transformTelemetry = function(d) {
    return parrotPx4._transform.transformTelemetry(d);
};
