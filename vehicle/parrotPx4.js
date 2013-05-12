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

var util               = require('util');
var arDrone            = require('ar-drone');

var QuadCopter         = require('./quadCopter.js');
var UnmannedVehicle    = require('./unmannedVehicle.js');
var TransformParrotPx4 = require('./transform/transformParrotPx4.js');
var State              = require('../videre-common/js/state');
var Attitude           = require('../videre-common/js/attitude');
var Telemetry          = require('../videre-common/js/telemetry');

var MavlinkProtocol    = require('./mavlinkProtocol.js');


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

ParrotPx4._transform = new TransformParrotPx4();


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
    this.attitude = new Attitude();

    this.mavlinkDevice = new MavlinkProtocol({
	debug: this.debug,
	debugLevel: this.debugLevel,
	connectionMethod: MavlinkProtocol.CONNECTION_SERIAL,
        positionMode: MavlinkProtocol.POSITION_MODE_DISTANCE,
        serialPort: this.serialPort,
        serialBaud: this.serialBaud,
        networkAddress: this.networkAddress,
        networkPort: this.networkPort,
        positionDiff: 1,
    });

    initialiseMavlinkDevice.call(this);
}

util.inherits(ParrotPx4, QuadCopter);

ParrotPx4.prototype._processData = function(navData) {
    var telemetry = new Telemetry({
	attitude: new Attitude({ pitch: this.attitude.pitch, roll: this.attitude.roll, yaw: this.attitude.yaw }),
// 	velocity: {x: d.xVelocity, y: d.yVelocity, z: d.zVelocity},
	batteryVoltage: this.batteryVoltage,
	batteryCharge: this.batteryRemaining,
	batteryCurrent: this.batteryCurrent,
	commDropRate: this.commDropRate,
	commErrors: this.CommErrors,
	});

    if(this.position != null && this.position.altitude != null) {
        telemetry.altitude = this.position.altitude;
    }

    this._rcvdTelemetry(telemetry);
};

function initialiseMavlinkDevice() {
    self = this;

    this.mavlinkDevice.on('attitude', function(attitude) {
	self.attitude.pitch = attitude.pitch;
	self.attitude.roll = attitude.roll;
	self.attitude.yaw = attitude.yaw;

        self._processData.call(self);
    });

    this.mavlinkDevice.on('positionGPSRawInt', function(position) {
	self.position = position;
	self._rcvdPosition(self.position);
    });

    this.mavlinkDevice.on('systemState', function(batteryVoltage, batteryCurrent, batteryRemaining, commDropRate, commErrors) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' battery voltage: ' + batteryVoltage +
		' battery charger: ' + batteryRemaining +
		' battery current: ' + batteryCurrent + 
		' comm drop rate: ' + commDropRate +
		' comm errors: ' + commErrors);
	}

	self.batteryVoltage = batteryVoltage;
	self.batteryCharge = batteryRemaining;
	self.batteryCurrent = batteryCurrent;
	self.commDropRate = commDropRate;
	self.commErrors = CommErrors;
    });

    this.mavlinkDevice.on('statusText', function(severity, text) {
	console.log("parrotPx4:" + 
	    " status: " + severity + 
	    " : " + text); 
	// TODO: figure out how this should be used, if it is used
    });

    this.mavlinkDevice.on('positionGPSRawInt', function(position) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' gps position lat: ' + position.latitude + ' lng: ' + position.longitude + ' alt: ' + position.altitude);
	}

	self.position = position;
	self._rcvdPosition(self.position);
    });

    this.mavlinkDevice.on('stateChanged', function(value, text) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' system status changed to: ' + value + ' : ' + text);
	}

	self.state.state = value;
	self._stateChanged(self.state);
    });

    this.mavlinkDevice.on('autonomousModeChanged', function(autonomousMode) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' autonomous mode: ' + systemStatusText);
	}

	self.state.autonomous = autonomousMode;
	self._stateChanged(self.state);
    });

    this.mavlinkDevice.on('testModeChanged', function(testMode) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' test mode: ' + systemStatusText);
	}

	self.state.testMode = testMode;
	self._stateChanged(self.state);
    });

    this.mavlinkDevice.on('stabilizedModeChanged', function(stabilizedMode) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' stabilized mode: ' + systemStatusText);
	}

	self.state.stabilized = stablizedMode;
	self._stateChanged(self.state);
    });

    this.mavlinkDevice.on('hardwareInLoopModeChanged', function(hardwareInLoop) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' hardware in loop mode: ' + systemStatusText);
	}

	self.state.hardwareInLoop = hardwareInLoop;
	self._stateChanged(self.state);
    });

    this.mavlinkDevice.on('remoteControlModeChanged', function(remoteControl) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' remote control mode: ' + systemStatusText);
	}

	self.state.remoteControl = remoteControl;
	self._stateChanged(self.state);
    });

    this.mavlinkDevice.on('guidedModeChanged', function(guided) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' guided mode: ' + systemStatusText);
	}

	self.state.guided = guided;
	self._stateChanged(self.state);
    });

    this.mavlinkDevice.on('armedModeChanged', function(armed) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' armed mode: ' + systemStatusText);
	}

	self.state.armed = armed;
	self._stateChanged(self.state);
    });

    this.mavlinkDevice.on('retreivedWaypoints', function(data) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' waypoints retreived.');
	}

	self._waypointsRetreived(data);
    });

    this.mavlinkDevice.on('setWaypointsError', function(text) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' waypoints set failed: ' + text);
	}

	self._waypointsSetFailed(text);
    });

    this.mavlinkDevice.on('setWaypointsSuccessful', function() {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' waypoints set successful');
	}

	self._waypointsSetSuccessful();
    });

    this.mavlinkDevice.on('targetWaypoint', function(waypoint) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' waypoint targeted: ' + waypoint);
	}

	self._waypointTargeted(waypoint);
    });

    this.mavlinkDevice.on('waypointAchieved', function(waypoint) {
	if(self.debug && self.debugLevel > 2) {
	    console.log(
		(new Date()) + ' ' + self.name + 
		' waypoint acheived: ' + waypoint);
	}

	self._waypointAchieved(waypoint);
    });
}

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

ParrotPx4.prototype.testRun = function() {
};

ParrotPx4.prototype.transformTelemetry = function(d) {
    return ParrotPx4._transform.transformTelemetry(d);
};
