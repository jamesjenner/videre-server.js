/*
 * mavlinkProtocol.js
 * 
 * Mavlink module to support vehicles
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


var SerialPort = require("serialport").SerialPort
var net        = require('net');
// var events     = require('events');
var EventEmitter = require('events').EventEmitter;
var util       = require('util');

var mavlink    = require('../implementations/mavlink_common_v1.0');

var MavlinkCnv = require('./mavlinkCnv.js');

// TODO: should be able to remove these, telemetry is refered to in the code but it's not doing anything afaict
var Attitude   = require('../videre-common/js/attitude');
var Point      = require('../videre-common/js/point');
var Position   = require('../videre-common/js/position');
var Telemetry  = require('../videre-common/js/telemetry');

/*
connection = net.createConnection(5760, '127.0.0.1');
connection.on('data', function(data) {
            mavlink.parseBuffer(data);
});
*/

module.exports = MavlinkProtocol;

MavlinkProtocol.DEFAULT_COMPORT = "/dev/ttyUSB0";
MavlinkProtocol.DEFAULT_BAUD = 57600;
MavlinkProtocol.LOCAL_HOST = "127.0.0.1";
MavlinkProtocol.DEFAULT_PORT = "5760";

MavlinkProtocol.CONNECTION_SERIAL = "serial";
MavlinkProtocol.CONNECTION_NETWORK = "network";

MavlinkProtocol.POSITION_MODE_NONE = 0;
MavlinkProtocol.POSITION_MODE_DISTANCE = 1;
MavlinkProtocol.POSITION_MODE_TIME = 2;

    /*
     * Base Mode
     *
     * 128 0b100 00000 MAV safety set to armed. Motors are enabled / running / can start. Ready to fly.
     *  64 0b010 00000 remote control input is enabled.
     *  32 0b001 00000 hardware in the loop simulation. All motors / actuators are blocked, but 
     *                 internal software is full operational.
     *  16 0b000 10000 system stabilizes electronically its attitude (and optionally position). 
     *                 It needs however further control inputs to move around.
     *   8 0b000 01000 guided mode enabled, system flies MISSIONs / mission items.
     *   4 0b000 00100 autonomous mode enabled, system finds its own goal positions. 
     *                 Guided flag can be set or not, depends on the actual implementation.
     *   2 0b000 00010 system has a test mode enabled. This flag is intended for temporary 
     *                 system tests and should not be used for stable implementations.
     *   1 0b000 00001 Reserved for future use.
     */
MavlinkProtocol.BASE_MODE_ARMED = 1 << 7;
MavlinkProtocol.BASE_MODE_REMOTE_CONTROL_ENABLED = 1 << 6;
MavlinkProtocol.BASE_MODE_HARDWARE_IN_LOOP = 1 << 5;
MavlinkProtocol.BASE_MODE_SYSTEM_STABILIZED = 1 << 4;
MavlinkProtocol.BASE_MODE_GUIDED_MODE = 1 << 3;
MavlinkProtocol.BASE_MODE_AUTONOMOUS_MODE = 1 << 2;
MavlinkProtocol.BASE_MODE_TEST_MODE = 1 << 1;
MavlinkProtocol.BASE_MODE_RESERVED = 1 << 0;

MavlinkProtocol.WAYPOINT_COMPONENT = 50;

MavlinkProtocol.WAYPOINT_NO_ACTION = 0;
MavlinkProtocol.WAYPOINT_REQUESTED = 1;
MavlinkProtocol.WAYPOINT_RECEIVING = 2;

MavlinkProtocol.WAYPOINT_UPDATE_REQUESTED = 3;
MavlinkProtocol.WAYPOINT_SENDING = 4;
MavlinkProtocol.WAYPOINT_SETTING_TARGET = 5;
MavlinkProtocol.WAYPOINT_REQUESTING_CLEAR_ALL = 6;

MavlinkProtocol._MISSION_REQUEST_LIST_TIMEOUT_ID = 0;
MavlinkProtocol._MISSION_REQUEST_TIMEOUT_ID = 1;

MavlinkProtocol._MISSION_COUNT_TIMEOUT_ID = 2;
MavlinkProtocol._MISSION_ITEM_TIMEOUT_ID = 3;
MavlinkProtocol._MISSION_SET_TARGET_ID = 4;
MavlinkProtocol._MISSION_CLEAR_ALL = 5;

// setup MavlinkProtocol as an emitter
util.inherits(MavlinkProtocol, EventEmitter);

/**
 * define a new mavlink protocol 
 *
 * options            named array of options for the mavlink protocol instance, values available are as follows:
 *   debug            true debugging enabled, otherwise debugging is disabled, false is default
 *   debugLevel       the level of debuging that will be performed, higher the value means more details
 *   connectionMethod MavlinkProtocol.CONNECTION_SERIAL or MavlinkProtocol.CONNECTION_NETWORK, serial is default
 *   networkAddress   the network address if using network connection, default is local host.
 *   networkPort      the port used when using network connection, default is MavlinkProtocol.DEFAULT_PORT
 *   serialPort       the serial port to connect when using serial connection, default is MavlinkProtocol.DEFUALT_COMPORT
 *   serialBaud       the baud rate when using serial connection, default is MavlinkProtocol.DEFAULT_BAUD
 */
function MavlinkProtocol(options) {
    options = options || {};

    EventEmitter.call(this);

    this.name = ((options.name != null) ? options.name : 'unnamed');
    this.debug = ((options.debug != null) ? options.debug : false);
    this.debugMessage = ((options.debugMessage != null) ? options.debugMessage : false);
    this.debugAttitude = ((options.debugAttitude != null) ? options.debugAttitude : false);
    this.debugSysStatus = ((options.debugSysStatus != null) ? options.debugSysStatus : false);
    this.debugWaypoints = ((options.debugWaypoints != null) ? options.debugWaypoints : false);
    this.debugHeartbeat = ((options.debugHeartbeat != null) ? options.debugHeartbeat : false);
    this.debugIMU = ((options.debugIMU != null) ? options.debugIMU : false);
    this.debugGPS = ((options.debugGPS != null) ? options.debugGPS : false);
    this.debugGPSRaw = ((options.debugGPSRaw != null) ? options.debugGPSRaw : false);
    this.debugGPSStatus = ((options.debugGPSStatus != null) ? options.debugGPSStatus : false);
    this.debugLevel = ((options.debugLevel != null) ? options.debugLevel : 0);

    // the default for attitude accuracy is 0.05 radians, approx. 2.86 of a degree, 
    // the default for attitude accuracy is 0.02 radians, approx. 1.15 of a degree, 
    // the default for attitude accuracy is 0.002 radians, approx. 0.11 of a degree, 
    // the default for attitude accuracy is 0.003 radians, approx. 0.17 of a degree, 
    // note that attiude is represented in radians of 2pi, but split into -pi and +pi to make up the 2pi
    this.pitchAccuracy = ((options.pitchAccuracy != null) ? options.pitchAccuracy : 0.003);
    this.rollAccuracy = ((options.rollAccuracy != null) ? options.rollAccuracy : 0.003);
    this.yawAccuracy = ((options.yawAccuracy != null) ? options.yawAccuracy : 0.05);

    this.connectionMethod = ((options.connectionMethod != null) ? options.connectionMethod : MavlinkProtocol.CONNECTION_SERIAL);

    this.networkAddress = ((options.networkAddress != null) ? options.networkAddress : MavlinkProtocol.LOCAL_HOST);
    this.networkPort = ((options.networkPort != null) ? options.networkPort : MavlinkProtocol.DEFAULT_PORT);

    this.serialPort = ((options.serialPort != null) ? options.serialPort : MavlinkProtocol.DEFAULT_COMPORT);
    this.serialBaud = ((options.baud != null) ? options.baud : MavlinkProtocol.DEFAULT_BAUD);

    this.positionMode = ((options.positionMode != null) ? options.positionMode : MavlinkProtocol.POSITION_MODE_NONE);
    this.positionDiff = ((options.Diff != null) ? options.Diff : 1);
    this.vehicleState = {};

    this.telemetry = new Telemetry();
    this.attitude = new Attitude();
    this.position = new Position();
    this.positionTimer = new Date().getTime();
    this.batteryVoltage   = 0;
    this.batteryCurrent   = 0;
    this.batteryRemaining = 0;
    this.commDropRate     = 0;
    this.commErrors       = 0;
    // a negative id means that it is currently not known, it is set by the heartbeat message
    this.systemId = -1;
    this.systemStatus = -1;
    this._msgSequence = 0;
    this._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;
    this._waypointCount = 0;
    this._waypointLastSequence = -1;
    this._waypointTimeoutId = null;
    this._waypointTimeoutCounter = null;
    this._baseMode = null;
    this._waypoints = new Array();
    this.timeoutIds = [null, null];

    this.autonomousMode  = false;
    this.testMode        = false;
    this.stabilizedMode  = false;
    this.hardwareInLoop  = false;
    this.remoteControl   = false;
    this.guided          = false;
    this.armed           = false;
}

/**
 * connect to the remote mavlink based device
 */
MavlinkProtocol.prototype.connect = function() {
    if(this.connectionMethod === MavlinkProtocol.CONNECTION_SERIAL) {
	this._initSerialPort();
    } else {
	this._initNetwork();
    }
}

/**
 * disconnect from the remote mavlink based device
 */
MavlinkProtocol.prototype.disconnect = function() {
    if(this.connectionMethod === MavlinkProtocol.CONNECTION_SERIAL) {
	this._closeSerialPort();
    } else {
	this._closeNetworkConnection();
    }
}

MavlinkProtocol.prototype._initSerialPort = function() {
    if(this.debug && this.debugLevel > 0) {
	console.log("Opening serial port " + this.serialPort + " baud: " + this.serialBaud);
    }

    this.serialDevice = new SerialPort(this.serialPort, {
	baudrate: this.serialBaud
    });

    this.mavlinkParser = new MAVLink();

    this._setupMavlinkListeners();

    var self = this;

    this.serialDevice.on("data", function (data) {
	if(self.debug && self.debugLevel > 9) {
	    console.log("Serial port, received data: " + data);
	}
	self.mavlinkParser.parseBuffer(data);
    });
}

MavlinkProtocol.prototype._closeSerialPort = function() {
    if(this.debug && this.debugLevel > 0) {
	console.log("Closing serial port " + this.serialPort);
    }

    if(this.serialDevice) {
	this.serialDevice.close();
	this.serialDevice = null;
    }
}

MavlinkProtocol.prototype._initNetwork = function() {
    this.netConnection = net.createConnection(this.networkPort, this.networkAddress);

    this.mavlinkParser = new MAVLink();

    this._setupMavlinkListeners();

    var self = this;

    this.netConnection.on('data', function(data) {
	self.mavlinkParser.parseBuffer(data);
    });
}

MavlinkProtocol.prototype._closeNetworkConnection = function() {
    if(this.netConnection) {
	this.netConnection.end();
	this.netConnection = null;
    }
}

/**
 * writes data to the mavlink connection
 *
 * data - the data to write to the mavlink connection
 *
 */
MavlinkProtocol.prototype._writeMessage = function(data) {
    _.extend(data, {
	srcSystem: 255,
	srcComponent: 0,
	// seq: getNextSequence()
    });

    p = new Buffer(data.pack());

    if(this.connectionMethod === MavlinkProtocol.CONNECTION_SERIAL) {
	if(this.debug && this.debugLevel > 9) {
	    console.log("write: calling serialDevice.write: " + p);
	}
	this.serialDevice.write(p);
    } else {
	// TODO: set this up for network, need to check if below is correct...
	if(this.debug && this.debugLevel > 9) {
	    console.log("write: calling netConnection.write: " + p);
	}
        this.netConnection.write(p);
    }
}

/**
 * request to update the waypoints for the drone
 *
 * returns  1 if request generated
 *         -1 if the system id is unknown
 *         -2 if currently processing waypoints
 *         -3 no waypoints specified
 */
MavlinkProtocol.prototype.requestSetWaypoints = function(waypoints) {
    var request = false;

    if(this.debugWaypoints) {
	if(this.waypoints) {
	    console.log("Requesting setting of " + waypoints.length + " waypoints");
	} else {
	    console.log("Requesting setting of " + waypoints + " waypoints");
	}
    }

    if(this.systemId === -1) {
	if(this.debugWaypoints) {
	    console.log("Cannot request to set waypoints as system id has not been set");
	}

	return -1;
    }

    if(!this.waypoints || this.waypoints.length === 0) {
	if(this.debugWaypoints) {
	    console.log("Cannot request to set waypoints when no waypoints have been specified");
	}

	return -3;
    }

    if(this._waypointMode === MavlinkProtocol.WAYPOINT_NO_ACTION || 
       this._waypointMode === MavlinkProtocol.WAYPOINT_UPDATE_REQUESTED) {
	// clear timeouts, just in case
        clearTimeout(this.timeoutIds[MavlinkProtocol._MISSION_COUNT_TIMEOUT_ID]);

	// setup the waypoint info
	this._waypoints = MavlinkCnv.waypointsVtoM(waypoints);
	this._waypointCount = this._waypoints.length;
	this._waypointLastSequence = -1;

	// set mode to request mode
        this._waypointMode = MavlinkProtocol.WAYPOINT_UPDATE_REQUESTED;
	
	// request the waypoints
	this._writeWithTimeout({
	    message: new mavlink.messages.mission_count(this.systemId, MavlinkProtocol.WAYPOINT_COMPONENT, waypoints.length),
	    timeout: 10000, 
	    maxAttempts: 3, 
	    messageName: 'mission count', 
	    attempts: 0,
	    timeoutId: MavlinkProtocol._MISSION_COUNT_TIMEOUT_ID,
	    onMaxAttempts: function() { this._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
	});
    } else {
	if(this.debugWaypoints) {
	    if(this.debugLevel === 0) {
		console.log("requestSetWaypoints rejected, currently busy on other activities");
	    } else {
		console.log("requestSetWaypoints rejected, current state is " + this._getWaypointState());
	    }
	}
	return -2;
    }

    return 1;
}

/**
 * request the waypoints from the drone
 *
 * returns  1 if request generated
 *         -1 if the system id is unknown
 *         -2 if currently processing waypoints
 */
MavlinkProtocol.prototype.requestWaypoints = function() {
    var request = false;

    if(this.debugWaypoints) {
	console.log("Requesting waypoints");
    }

    if(this.systemId === -1) {
	if(this.debugWaypoints) {
	    console.log("Cannot request waypoints as system id has not been set");
	}

	return -1;
    }

    if(this._waypointMode === MavlinkProtocol.WAYPOINT_NO_ACTION || 
       this._waypointMode ===  MavlinkProtocol.WAYPOINT_REQUESTED) {
	// clear timeouts, just in case
	clearTimeout(this.timeoutIds[MavlinkProtocol._MISSION_REQUEST_LIST_TIMEOUT_ID]);
	clearTimeout(this.timeoutIds[MavlinkProtocol._MISSION_REQUEST_TIMEOUT_ID]);

	// reset the waypoint info
	this._waypoints = new Array();
	this._waypointCount = 0;
	this._waypointLastSequence = -1;

	// set mode to request mode
        this._waypointMode = MavlinkProtocol.WAYPOINT_REQUESTED;
	
	// request the waypoints
	this._writeWithTimeout({
	    message: new mavlink.messages.mission_request_list(this.systemId, MavlinkProtocol.WAYPOINT_COMPONENT),
	    timeout: 10000, 
	    maxAttempts: 3, 
	    messageName: 'mission request list', 
	    attempts: 0,
	    timeoutId: MavlinkProtocol._MISSION_REQUEST_LIST_TIMEOUT_ID,
	    onMaxAttempts: function() { this._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
	});
    } else {
	if(this.debugWaypoints) {
	    if(this.debugLevel === 0) {
		console.log("requestWaypoints rejected, currently busy on other activities");
	    } else {
		console.log("requestWaypoints rejected, current state is " + this._getWaypointState());
	    }
	}
	return -2;
    }

    return 1;
}

/**
 * request that the target is set to the specified waypoint
 *
 * waypoint    the waypoint that is to be the target
 *
 * returns  1 if request generated
 *         -1 if the system id is unknown
 *         -2 if currently busy
 */
MavlinkProtocol.prototype.requestSetTargetWaypoint = function(waypoint) {
    if(this.debugWaypoints) {
	console.log("setting target waypoint: " + waypoint);
    }

    if(this.systemId === -1) {
	if(this.debugWaypoints) {
	    console.log("Cannot request waypoints as system id has not been set");
	}

	return -1;
    }

    if(this._waypointMode === MavlinkProtocol.WAYPOINT_NO_ACTION) {
	// set mode to setting target
	this._waypointMode = MavlinkProtocol.WAYPOINT_SETTING_TARGET;
	
	// request the waypoints
	this._writeWithTimeout({
	    message: new mavlink.messages.mission_set_current(this.systemId, MavlinkProtocol.WAYPOINT_COMPONENT, waypoint),
	    timeout: 10000, 
	    maxAttempts: 3, 
	    messageName: 'mission set current', 
	    attempts: 0,
	    timeoutId: MavlinkProtocol._MISSION_SET_TARGET_ID,
	    onMaxAttempts: function() { this._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
	});
    } else {
	if(this.debugWaypoints) {
	    if(this.debugLevel === 0) {
		console.log("requestSetTarget rejected, currently busy on other activities");
	    } else {
		console.log("requestSetTarget rejected, current state is " + this._getWaypointState());
	    }
	}

	return -2;
    }

    return 1;
}

/**
 * request that the target is set to the specified waypoint
 *
 * waypoint    the waypoint that is to be the target
 *
 * returns  1 if request generated
 *         -1 if the system id is unknown
 *         -2 if currently busy
 */
MavlinkProtocol.prototype.requestClearWaypoints = function() {
    if(this.debugWaypoints) {
	console.log("clearing waypoints");
    }

    if(this.systemId === -1) {
	if(this.debugWaypoints) {
	    console.log("Cannot clear waypoints as system id has not been set");
	}

	return -1;
    }

    if(this._waypointMode === MavlinkProtocol.WAYPOINT_NO_ACTION) {
	// request to clear all waypoints 

	/*
	 * it appears that while the spec at http://qgroundcontrol.org/mavlink/waypoint_protocol
 	 * states that the clear all will respond with an ack, testing has shown different.
	 * examining the code for QGroundControl has also shown that it doesn't wait for an ack
	 * so leaving the code here to perform the timeout, however expect that it is a send and 
	 * forget....
	 *
	// set mode to requesting clear all
	this._waypointMode = MavlinkProtocol.WAYPOINT_REQUESTING_CLEAR_ALL;
	
	this._writeWithTimeout({
	    message: new mavlink.messages.mission_clear_all(this.systemId, MavlinkProtocol.WAYPOINT_COMPONENT),
	    timeout: 10000, 
	    maxAttempts: 3, 
	    messageName: 'mission clear all', 
	    attempts: 0,
	    timeoutId: MavlinkProtocol._MISSION_CLEAR_ALL,
	    onMaxAttempts: function() { this._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
	});
	*/

	this._writeMessage(new mavlink.messages.mission_clear_all(this.systemId, MavlinkProtocol.WAYPOINT_COMPONENT));
    } else {
	if(this.debugWaypoints) {
	    if(this.debugLevel === 0) {
		console.log("requestClearWaypoints rejected, currently busy on other activities");
	    } else {
		console.log("requestClearWaypoints rejected, current state is " + this._getWaypointState());
	    }
	}

	return -2;
    }

    return 1;
}

MavlinkProtocol.prototype._getWaypointState = function() {
    var currentStateText = "";

    switch(this._waypointMode) {
        case MavlinkProtocol.WAYPOINT_NO_ACTION:
	    currentStateText = "no action";
	    break;

        case MavlinkProtocol.WAYPOINT_REQUESTED:
	    currentStateText = "waypoints requested";
	    break;

        case MavlinkProtocol.WAYPOINT_RECEIVING:
	    currentStateText = "receiving waypoints";
	    break;

        case MavlinkProtocol.WAYPOINT_UPDATE_REQUESTED:
	    currentStateText = "requesting to update waypoints";
	    break;

        case MavlinkProtocol.WAYPOINT_SENDING:
	    currentStateText = "updating waypoints";
	    break;

        case MavlinkProtocol.WAYPOINT_SETTING_TARGET:
	    currentStateText = "setting target";
	    break;
    }

    return currentStateText;
}

MavlinkProtocol.prototype._writeWithTimeout = function(options) {
    var self = this;

    self.timeoutIds[options.timeoutId] = setTimeout(function() {
	options.attempts++;

	if(options.attempts > 3) {
	    if(self.debug) {
		console.log("Message " + options.messageName + " response timed out, retries exceeded");
	    }

	    if(options.onMaxAttempts) {
		options.onMaxAttempts.call(self);
	    }
	} else {
	    if(self.debug && self.debugLevel > 1) {
		console.log("Message " + options.messageName + " timed out, retrying. Attempt: " + options.attempts);
	    }

	    self._writeWithTimeout.call(self, options);
	}
    }, options.timeout);

    self._writeMessage(options.message);
}

MavlinkProtocol.prototype._setupMavlinkListeners = function() {

    var self = this;
/*
 * mav status:
 *
 * The general system state. If the system is following the MAVLink standard, the system state 
 * is mainly defined by three orthogonal states/modes: 
 *
 * - The system mode, which is either 
 *     LOCKED (motors shut down and locked), 
 *     MANUAL (system under RC control), 
 *     GUIDED (system with autonomous position control, position setpoint controlled manually) or 
 *     AUTO (system guided by path/waypoint planner). 
 *
 * - The NAV_MODE defined the current flight state: 
 *     LIFTOFF (often an open-loop maneuver), 
 *     LANDING, 
 *     WAYPOINTS or 
 *     VECTOR. 
 *
 * This represents the internal navigation state machine. The system status shows wether the 
 * system is currently active or not and if an emergency occured. During the CRITICAL and 
 * EMERGENCY states the MAV is still considered to be active, but should start emergency 
 * procedures autonomously. After a failure occured it should first move from active to 
 * critical to allow manual intervention and then move to emergency after a certain timeout.
 *
 */


this.mavlinkParser.on('message', function(message) {
    if(self.debugMessage) {
	console.log(message.name + ' <- received message for ' + self.name);
    }
});

this.mavlinkParser.on('PING', function(message) {
    /*
    time_usec  Unix timestamp in microseconds
    seq  PING sequence
    target_systemu    0: request ping from all receiving systems, 
                      if greater than 0: message is a ping response and number is the system id of the requesting system
    target_component  0: request ping from all receiving components, 
                      if greater than 0: message is a ping response and number is the system id of the requesting system
    */
    
    if(self.debug && self.debugLevel == 1) {
	console.log('Ping');
    } else if (self.debug && self.debugLevel > 1) {
	console.log('Ping' + 
	    ' time_usec: ' + message.time_usec + 
	    ' seq: ' + message.seq +
	    ' target_system: ' + message.target_system +
	    ' target_component: ' + message.target_component);
    }
});

this.mavlinkParser.on('HEARTBEAT', function(message) {
    /*
     * type            Type of the MAV (quadrotor, helicopter, etc)
     * autopilot       Autopilot type / class.
     * base_mode       System mode bitfield, see MAV_MODE_FLAGS ENUM in mavlink/include/mavlink_types.h
     * custom_mode     A bitfield for use for autopilot-specific flags.
     * system_status   System status flag, see MAV_STATE ENUM
     * mavlink_version MAVLink version
    */

    // setup the system id if it is not set
    if(self.systemId === -1) {
	self.systemId = message.header.srcSystem;
	self.systemMavlinkVersion = message.mavlink_version;
	self.systemType = message.type;
    }

    // if the system status has changed then update it
    if(self.systemStatus != message.system_status) {
	self.systemStatus = message.system_status

	switch(message.system_status) {
	    case mavlink.MAV_STATE_UNINIT:
		self.systemStatusText = 'Uninitialized';
		break;
	    case mavlink.MAV_STATE_BOOT:
		self.systemStatusText = 'Booting';
		break;
	    case mavlink.MAV_STATE_CALIBRATING:
		self.systemStatusText = 'Calibrating';
		break;
	    case mavlink.MAV_STATE_STANDBY:
		self.systemStatusText = 'Standby';
		break;
	    case mavlink.MAV_STATE_ACTIVE:
		self.systemStatusText = 'Active';
		break;
	    case mavlink.MAV_STATE_CRITICAL:
		self.systemStatusText = 'Critical';
		break;
	    case mavlink.MAV_STATE_EMERGENCY:
		self.systemStatusText = 'Emergency / Mayday';
		break;
            case mavlink.MAV_STATE_POWEROFF:
		self.systemStatusText = 'Shuting down';
		break;
	}

	// fire the stateChanged event
	self.emit('systemStatusChanged', self.systemStatus, self.systemStatusText);
    }
       
    // if the base mode has changed then update it
    if(self._baseMode != message.base_mode) {
	var autonomousModeOld = self.autonomousMode;
	var testModeOld = self.testMode;
	var stabilizedModeOld = self.stabilizedMode;
	var hardwareInLoopOld = self.hardwareInLoop;
	var remoteControlOld = self.remoteControl;
	var guidedOld = self.guided;
	var armedOld = self.armed;

	self.autonomousMode  = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_AUTO_ENABLED != 0 ? true : false;
	self.testMode        = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_TEST_ENABLED != 0 ? true : false;
	self.stabilizedMode  = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_STABILIZE_ENABLED != 0 ? true : false;
	self.hardwareInLoop  = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_HIL_ENABLED != 0 ? true : false;
	self.remoteControl   = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_MANUAL_INPUT_ENABLED != 0 ? true : false;
	self.guided          = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_GUIDED_ENABLED != 0 ? true : false;
	self.armed           = message.base_mode & MavlinkProtocol.BASE_MODE_ARMED != 0 ? true : false;

	self._baseMode = message.base_mode;

	// fire the mode changed event as appropriate
	if(autonomousModeOld != self.autonomousMode) {
	    self.emit('autonomousModeChanged', self.autonomousMode);
	}

	if(testModeOld != self.testMode) {
	    self.emit('testModeChanged', self.testMode);
	}

	if(stabilizedModeOld != self.stabilizedMode) {
	    self.emit('stabilizedModeChanged', self.stabilizedMode);
	}

	if(hardwareInLoopOld != self.hardwareInLoop) {
	    self.emit('hardwareInLoopModeChanged', self.hardwareInLoop);
	}

	if(remoteControlOld != self.remoteControl) {
	    self.emit('remoteControlModeChanged', self.remoteControl);
	}

	if(guidedOld != self.guided) {
	    self.emit('guidedModeChanged', self.guided);
	}

	if(armedOld != self.armed) {
	    self.emit('armedModeChanged', self.armed);
	}
    }

    // set the system id from the heartbeat if it is not currently set
    if(self.debugHeartbeat && self.debugLevel == 1) {
	console.log('Heartbeat');
    } else if (self.debugHeartbeat && self.debugLevel > 1) {
        var mavType = 'unknown';
	var autopilot = 'unknown';
	var sysStatus = 'unknown';

	switch(message.autopilot) {
	    case mavlink.MAV_AUTOPILOT_GENERIC:
		autopilot = 'Generic';
		break;
            case mavlink.MAV_AUTOPILOT_PIXHAWK:
		autopilot = 'PIXHAWK';
		break;
            case mavlink.MAV_AUTOPILOT_SLUGS:
		autopilot = 'SLUGS';
		break;
            case mavlink.MAV_AUTOPILOT_ARDUPILOTMEGA:
		autopilot = 'ArduPilotMega / ArduCopter';
		break;
            case mavlink.MAV_AUTOPILOT_OPENPILOT:
		autopilot = 'OpenPilot';
		break;
            case mavlink.MAV_AUTOPILOT_GENERIC_WAYPOINTS_ONLY:
		autopilot = 'Generic autopilot only supporting simple waypoints';
		break;
            case mavlink.MAV_AUTOPILOT_GENERIC_WAYPOINTS_AND_SIMPLE_NAVIGATION_ONLY:
		autopilot = 'Generic autopilot supporting waypoints and other simple navigation';
		break;
            case mavlink.MAV_AUTOPILOT_GENERIC_MISSION_FULL:
		autopilot = 'Generic autopilot supporting the full mission command set';
		break;
            case mavlink.MAV_AUTOPILOT_INVALID:
		autopilot = 'No valid autopilot';
		break;
            case mavlink.MAV_AUTOPILOT_PPZ:
		autopilot = 'PPZ UAV';
		break;
            case mavlink.MAV_AUTOPILOT_UDB:
		autopilot = 'UAV Dev Board';
		break;
            case mavlink.MAV_AUTOPILOT_FP:
		autopilot = 'FlexiPilot';
		break;
            case mavlink.MAV_AUTOPILOT_PX4:
		autopilot = 'PX4 Autopilot';
		break;
            case mavlink.MAV_AUTOPILOT_SMACCMPILOT:
		autopilot = '';
		break;
	}
	switch(message.type) {
	    case mavlink.MAV_TYPE_GENERIC:
	        mavType = 'Generic micro air vehicle';
		break;
	    case mavlink.MAV_TYPE_FIXED_WING:
	        mavType = 'Fixed wing aircraft';
		break;
	    case mavlink.MAV_TYPE_QUADROTOR:
		mavType = 'Quadrotor';
		break;
	    case mavlink.MAV_TYPE_COAXIAL:
		mavType = 'Coaxial helicopter';
		break;
	    case mavlink.MAV_TYPE_HELICOPTER:
		mavType = 'Normal helicopter with tail rotor';
		break;
	    case mavlink.MAV_TYPE_ANTENNA_TRACKER:
		mavType = 'Ground installation';
		break;
	    case mavlink.MAV_TYPE_GCS:
		mavType = 'Operator control unit / ground control station';
		break;
	    case mavlink.MAV_TYPE_AIRSHIP:
		mavType = 'Airship, controlled';
		break;
	    case mavlink.MAV_TYPE_FREE_BALLOON:
		mavType = 'Free balloon, uncontrolled';
		break;
	    case mavlink.MAV_TYPE_ROCKET:
		mavType = 'Rocket';
		break;
	    case mavlink.MAV_TYPE_GROUND_ROVER:
		mavType = 'Ground rover';
		break;
	    case mavlink.MAV_TYPE_SURFACE_BOAT:
		mavType = 'Surface vessel, boat, ship';
		break;
	    case mavlink.MAV_TYPE_SUBMARINE:
		mavType = 'Submarine';
		break;
	    case mavlink.MAV_TYPE_HEXAROTOR:
		mavType = 'Hexarotor';
		break;
	    case mavlink.MAV_TYPE_OCTOROTOR:
		mavType = 'Octorotor';
		break;
	    case mavlink.MAV_TYPE_TRICOPTER:
		mavType = 'Tricopter';
		break;
	    case mavlink.MAV_TYPE_FLAPPING_WING:
		mavType = 'Flapping wing';
		break;
	    case mavlink.MAV_TYPE_KITE:
		mavType = 'Kite';
		break;
	}

	console.log('Heartbeat  src sys:          ' + message.header.srcSystem);
	console.log('           src component:    ' + message.header.srcComponent);
	console.log('           type:             ' + mavType);
	console.log('           autopilot:        ' + autopilot);
	console.log('           base_mode:        ' + message.base_mode);
	console.log('           autonomous mode:  ' + self.autonomousMode);
	console.log('           test mode:        ' + self.testMode);
	console.log('           stabalized mode:  ' + self.stablizedMode);
	console.log('           hardware in loop: ' + self.hardwareInLoop);
	console.log('           remote control:   ' + self.remoteControl);
	console.log('           guided:           ' + self.guided);
	console.log('           armed:            ' + self.armed);
	console.log('           custom mode:      ' + message.custom_mode);
	console.log('           system status:    ' + sysState);
	console.log('           mavlink version:  ' + message.mavlink_version);
    }
});

/*
 * This message is recieved as response to MISSION_REQUEST_LIST, stating the number of missions that can be 
 * received.
 *
 * At this point each individual mission is requested.
 */
this.mavlinkParser.on('MISSION_COUNT', function(message) {
    if(self.debugWaypoints) {
	if(self.debugLevel == 1) {
	    console.log('Mission Count');
	} else if (self.debugLevel > 1) {
	    console.log('Mission Count: ' +
		' sys: ' + message.header.srcSystem +
		' component: ' + message.header.srcComponent +
		' target sys: ' + message.target_system + 
		' target component: ' + message.target_component + 
		' count: ' + message.count);
	}
    }

    // clear the timeout as we received the mission count
    clearTimeout(self.timeoutIds[MavlinkProtocol._MISSION_REQUEST_LIST_TIMEOUT_ID]);

    // it not requested and we receiving waypoints then that's okay, treat it like we requested it
    if(message.count > 0 && 
       (self._waypointMode === MavlinkProtocol.WAYPOINT_NO_ACTION || 
       self._waypointMode === MavlinkProtocol.WAYPOINT_REQUESTED)) {
	// set to receiving waypoint
	self._waypointMode = MavlinkProtocol.WAYPOINT_RECEIVING;

	self._waypointCount = message.count;
	self._waypointLastSequence = -1;
	self._waypoints = new Array();

	// request the first waypoint
	self._writeWithTimeout.call(self, {
	    message: new mavlink.messages.mission_request(message.header.srcSystem, message.header.srcComponent, 0),
	    timeout: 10000, 
	    maxAttempts: 3, 
	    messageName: 'mission request', 
	    attempts: 0,
	    timeoutId: MavlinkProtocol._MISSION_REQUEST_TIMEOUT_ID,
	    onMaxAttempts: function() { self._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
	});
    } else {
	// obviously no waypoints so nothing to do
        self._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;
    }
});

/* 
 * This message is recieved in response to a MISSION_REQUEST, this contains the mission item details.
 *
 * The next mission item can be requested, if complete then an ACK is sent.
 */
this.mavlinkParser.on('MISSION_ITEM', function(message) {

    if(self.debugWaypoints && self.debugLevel == 1) {
	console.log('Mission Item');
    } else if (self.debugWaypoints && self.debugLevel > 1) {
	console.log('Mission Item: ' +
	    ' seq: ' + message.seq +
	    ' frame: ' + message.frame +
	    ' cmd: ' + message.command +
	    ' current: ' + message.current +
	    ' autocontinue: ' + message.autocontinue +
	    ' param1: ' + message.param1 +
	    ' param2: ' + message.param2 +
	    ' param3: ' + message.param3 +
	    ' param4: ' + message.param4 +
	    ' x: ' + message.x +
	    ' y: ' + message.y +
	    ' z: ' + message.z)
    }

    // clear the timeout as we received a mission item 
    clearTimeout(self.timeoutIds[MavlinkProtocol._MISSION_REQUEST_TIMEOUT_ID]);

    switch(self._waypointMode) {
        case MavlinkProtocol.WAYPOINT_NO_ACTION:
	    // if the first one then switch to receiving mode as it's okay to receive when not requested, otherwise ignore
            if(message.seq > 0) {
		if(self.debugWaypoints && self.debugLevel > 1) {
		    console.log("Waypoint has not been requested and sequence is larger than 0, ignoring");
		}
		break;
	    }

        case MavlinkProtocol.WAYPOINT_REQUEST:
            self._waypointMode = MavlinkProtocol.WAYPOINT_RECEIVING;

        case MavlinkProtocol.WAYPOINT_RECEIVING:
	    if(self._waypointLastSequence != -1 && self._waypointLastSequence != message.seq) {
		if(self.debugWaypoints && self.debugLevel > 1) {
		    console.log("Mission item: receiving waypoint out of order, ignoring");
		}
		// received waypoint out of sequence, ignore
		break;
	    }

	    // update the last sequence processed
	    self._waypointLastSequence = message.seq + 1;

	    // push the command onto the waypoints stack, we convert these when they're complete
	    self._waypoints.push(message);
	    
	    if(message.seq + 1 == self._waypointCount) {
		// we have the last waypoint 
	    
		// send an ack as the remote system will be waiting for one
		self._writeMessage.call(self, 
		    new mavlink.messages.mission_ack(
			message.header.srcSystem, 
			message.header.srcComponent, 
			mavlink.MAV_MISSION_ACCEPTED));

		// reset the mode and the waypoints
		self._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;

		// convert the waypoints to videre format
		var waypoints = MavlinkCnv.waypointsMtoV(self._waypoints);

		// call the waypoint callback, passing the waypoints
		self.emit('retreivedWaypoints', waypoints);

		// reset waypoints
		self._waypoints = new Array();
	    } else {
		// send requets for next waypoint, with a timeout for retries
		self._writeWithTimeout.call(self, {
		    message: new mavlink.messages.mission_request(
			message.header.srcSystem, 
			message.header.srcComponent, 
			self._waypointLastSequence),
		    timeout: 10000, 
		    maxAttempts: 3, 
		    messageName: 'mission request', 
		    attempts: 0,
		    timeoutId: MavlinkProtocol._MISSION_REQUEST_TIMEOUT_ID,
		    onMaxAttempts: function() { self._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
		});
	    }
	    break;

	default:
	    if(self.debugWaypoints && self.debugLevel > 1) {
		console.log("Mission item: waypoint state unknown, ignoring");
	    }
	    break;
    }
});

// TODO: there is no timeout with setting the mission/waypoints, this should be changed

/* 
 * This message is recieved in response to a MISSION_COUNT, this requests details for the specified item.
 *
 * Mission requests are to be in order and completed with an ACK.
 */
this.mavlinkParser.on('MISSION_REQUEST', function(message) {
    if(self.debugWaypoints && self.debugLevel == 1) {
	console.log('Mission Request');
    } else if (self.debugWaypoints && self.debugLevel > 1) {
	console.log('Mission Request for item: ' + message.seq);
    }

    // clear the timeout that created the requst, if the first item
    clearTimeout(self.timeoutIds[MavlinkProtocol._MISSION_COUNT_TIMEOUT_ID]);
    clearTimeout(self.timeoutIds[MavlinkProtocol._MISSION_ITEM_TIMEOUT_ID]);

    switch(self._waypointMode) {
        case MavlinkProtocol.WAYPOINT_NO_ACTION:
	    if(message.seq != 0) {
		if(self.debugWaypoints && self.debugLevel > 1) {
		    console.log('Mission Request for item: ' + message.seq + ' when not expecting requests, ignored');
		}
		break;
	    }

        case MavlinkProtocol.WAYPOINT_UPDATE_REQUESTED:
	    self._waypointMode = MavlinkProtocol.WAYPOINT_SENDING;

        case MavlinkProtocol.WAYPOINT_SENDING:
	    // send the requested waypoint
	    if(message.seq > self._waypoints.length) {
		if(self.debugWaypoints && self.debugLevel > 1) {
		    console.log('Mission Request for item: ' + message.seq + ' is larger than number of waypoints, ignored');
		}
		break;
	    }

	    // if waypoint is the current or previous waypoint, then accept
	    if(self._waypointLastSequence + 1 === message.seq) {
		// we have the expected sequence
		self._waypointLastSequence = message.seq;

		self._writeWithTimeout.call(self, {
		    message: 
		    new mavlink.messages.mission_item(
			message.header.srcSystem, 
			message.header.srcComponent, 
			message.seq,
			self._waypoints[message.seq].frame,
			self._waypoints[message.seq].command,
			self._waypoints[message.seq].current,
			self._waypoints[message.seq].autocontinue,
			self._waypoints[message.seq].param1,
			self._waypoints[message.seq].param2,
			self._waypoints[message.seq].param3,
			self._waypoints[message.seq].param4,
			self._waypoints[message.seq].x,
			self._waypoints[message.seq].y,
			self._waypoints[message.seq].z),
		    timeout: 10000, 
		    maxAttempts: 3, 
		    messageName: 'mission item', 
		    attempts: 0,
		    timeoutId: MavlinkProtocol._MISSION_ITEM_TIMEOUT_ID,
		    onMaxAttempts: function() { this._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
		});
	    } else if (self._waypointLastSequence === message.seq) {
		// we have been sent the same sequence twice, just ignore
		console.log('received same sequence, ignoring');
	    } else {
		// we are out of sequence, the received sequence is not correct, error
		// expected 0, got 1
		console.log('received incorrect sequence, sending error via ack. Expected: ' + 
		    self._waypointLastSequence + ', got:  ' + message.seq);

		self._writeMessage.call(self, 
		    new mavlink.messages.mission_ack(
			message.header.srcSystem, 
			message.header.srcComponent, 
			mavlink.MAV_MISSION_INVALID_SEQUENCE));
	    }
	    break;

	default:
	    if (self.debugWaypoints && self.debugLevel > 1) {
		console.log('Mission Request for item: ' + message.seq + ' when in unknown state, ignored');
	    }
	    break;
    }
});

/*
 * This message is recieved when all the missions have been sent.
 */
this.mavlinkParser.on('MISSION_ACK', function(message) {
    if(self.debugWaypoints) {
	console.log('Mission Ack ' + message.type);
    }

    // clear timers
    clearTimeout(self.timeoutIds[MavlinkProtocol._MISSION_COUNT_TIMEOUT_ID]);
    clearTimeout(self.timeoutIds[MavlinkProtocol._MISSION_ITEM_TIMEOUT_ID]);
    clearTimeout(self.timeoutIds[MavlinkProtocol._MISSION_CLEAR_ALL]);

    // reset the state
    self._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;

    if(message.type === mavlink.MAV_MISSION_ACCEPTED) {
	switch(self._waypointMode) {
	    case MavlinkProtocol.WAYPOINT_NO_ACTION:
		if(self.debugWaypoints && self.debugLevel > 1) {
		    console.log('Mission Ack but state is no action, ignoring');
		}
		break;

	    case MavlinkProtocol.WAYPOINT_UPDATE_REQUESTED:
		if(self.debugWaypoints && self.debugLevel > 1) {
		    console.log('Mission Ack but state is update requested, reseting to no action');
		}
		self._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;
		break;

	    case MavlinkProtocol.WAYPOINT_SENDING:
		if(self._waypointLastSequence + 1 == self._waypoints.length) {
		    if(self.debugWaypoints && self.debugLevel > 1) {
			console.log('Mission update sucessful');
		    }

		    // call the success listener
		    self.emit('setWaypointsSuccessful');
		}

		self._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;
		break;
	}
    } else {
	// an error has occurred, so no point continuing
	self._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;

	// clear out the timeout just in case it was set
	clearTimeout(self.timeoutIds[MavlinkProtocol._MISSION_COUNT_TIMEOUT_ID]);

	// display debug if appropriate
	switch(message.type) {
	    case MAV_MISSION_ERROR:
		text = "Mission_ack: generic error / not accepting mission commands at all right now";
		break;

	    case MAV_MISSION_UNSUPPORTED_FRAME:
		text = "Mission_ack: coordinate frame is not supported";
		break;

	    case MAV_MISSION_UNSUPPORTED:
		text = "Mission_ack: command is not supported";
		break;

	    case MAV_MISSION_NO_SPACE:
		text = "Mission_ack: mission item exceeds storage space";
		break;

	    case MAV_MISSION_INVALID:
		text = "Mission_ack: one of the parameters has an invalid value";
		break;

	    case MAV_MISSION_INVALID_PARAM1:
		text = "Mission_ack: param1 has an invalid value";
		break;

	    case MAV_MISSION_INVALID_PARAM2:
		text = "Mission_ack: param2 has an invalid value";
		break;

	    case MAV_MISSION_INVALID_PARAM3:
		text = "Mission_ack: param3 has an invalid value";
		break;

	    case MAV_MISSION_INVALID_PARAM4:
		text = "Mission_ack: param4 has an invalid value";
		break;

	    case MAV_MISSION_INVALID_PARAM5:
		text = "Mission_ack: _Xx/param5 has an invalid value";
		break;

	    case MAV_MISSION_INVALID_PARAM6:
		text = "Mission_ack: _Yy/param6 has an invalid value";
		break;

	    case MAV_MISSION_INVALID_PARAM7:
		text = "Mission_ack: param7 has an invalid value";
		break;

	    case MAV_MISSION_INVALID_SEQUENCE:
		text = "Mission_ack: received waypoint out of sequence";
		break;

	    case MAV_MISSION_DENIED:
		text = "Mission_ack: not accepting any mission commands from this communication partner";
		break;
	}

	// fire error event
	self.emit('setWaypointsError', text + "" + self._waypointSequence);

        if(self.debugWaypoints) {
	    console.log(text);
	}
    }
});

this.mavlinkParser.on('MISSION_CURRENT', function(message) {
    if(self.debugWaypoints) {
	console.log('Mission set to current: ' + message.seq);
    }

    if(self._waypointMode === MavlinkProtocol.WAYPOINT_SETTING_TARGET) {
	// clear out the timeout in case is still was set
	clearTimeout(self.timeoutIds[MavlinkProtocol._MISSION_SET_TARGET_ID]);
	self._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;
    }

    self.emit('targetWaypoint', message.seq);
});

this.mavlinkParser.on('MISSION_ITEM_REACHED', function(message) {
    console.log('Mission item reached ' + message.seq);

    self.emit('waypointAchieved', message.seq);
});

this.mavlinkParser.on('GLOBAL_POSITION_INT', function(message) {
    /* 
     * The filtered global position (e.g. fused GPS and accelerometers). 
     * The position is in GPS-frame (right-handed, Z-up). It is designed 
     * as scaled integer message since the resolution of float is not sufficient.
     *
     * time_boot_msu  Timestamp (milliseconds since system boot)
     * lat            Latitude, expressed as * 1E7
     * lon            Longitude, expressed as * 1E7
     * alt            Altitude in meters, expressed as * 1000 (millimeters), above MSL
     * relative_alt   Altitude above ground in meters, expressed as * 1000 (millimeters)
     * vx             Ground X Speed (Latitude), expressed as m/s * 100
     * vy             Ground Y Speed (Longitude), expressed as m/s * 100
     * vz             Ground Z Speed (Altitude), expressed as m/s * 100
     * hdg            Compass heading in degrees * 100, 0.0..359.99 degrees. If unknown, set to: 65535
     */
    if(self.debugGPS && self.debugLevel == 1) {
	console.log('Global position (int)');
    } else if (self.debugGPS && self.debugLevel > 1) {
	console.log('Global position (int)' + 
	    ' lat: ' + message.lat / 10000000 + 
	    ' lng: ' + message.lon / 10000000 + 
	    ' alt: ' + message.alt / 1000 +
	    ' rel alt: ' + message.relative_alt / 1000 +
	    ' vx: ' + message.vx / 100 +
	    ' vy: ' + message.vy / 100 +
	    ' vz: ' + message.vz / 100 +
	    ' hdg: ' + message.hdg / 100
	);
    }

    // TODO: using raw as int doesn't appear to be reported, not sure why
    /*
    self.vehicleState = _.extend(self.vehicleState, {
	lat: message.lat/10000000,
	lon: message.lon/10000000,
	alt: message.alt/1000,
	relative_alt: message.relative_alt/1000,
	vx: message.vx/100,
	vy: message.vy/100,
	vz: message.vz/100,
	hdg: message.hdg/100
    });
    */
});

this.mavlinkParser.on('STATUS_TEXT', function(message) {
    /* 
     * Status text message. These messages are printed in yellow in the COMM console of QGroundControl. 
     *
     * WARNING: They consume quite some bandwidth, so use only for important status and error messages. 
     * If implemented wisely, these messages are buffered on the MCU and sent only at a limited 
     * rate (e.g. 10 Hz).
     *
     * severity  Severity of status. Relies on the definitions within RFC-5424. See enum MAV_SEVERITY.
     * text      Status text message, without null termination character
     */
    if(self.debug && self.debugLevel == 1) {
	console.log('Status text');
    } else if (self.debug && self.debugLevel > 1) {
	console.log('Status text' + 
	    ' severity: ' + message.severity +
	    ' text: ' + message.text);
    }

    self.emit('statusText', message.severity, message.text);
});

this.mavlinkParser.on('PARAM_VALUE', function(message) {
    /*
    * Emit the value of a onboard parameter. 
    *
    * The inclusion of param_count and param_index in the message allows the recipient to keep track 
    * of received parameters and allows him to re-request missing parameters after a loss or timeout.
    *
    * param_id       Onboard parameter id, terminated by NULL if the length is less than 16 human-
    *                readable chars and WITHOUT null termination (NULL) byte if the length is exactly 
    *                16 chars - applications have to provide 16+1 bytes storage if the ID is stored 
    *                as string
    * param_value    Onboard parameter value
    * param_type     Onboard parameter type: see the MAV_PARAM_TYPE enum for supported data types.
    * param_count    Total number of onboard parameters
    * param_index    Index of this onboard parameter
    */
    if(self.debug && self.debugLevel == 1) {
	console.log('Param Value');
    } else if (self.debug && self.debugLevel > 1) {
	console.log('Param Value' + 
	    ' param_id: ' + message.id +
	    ' param_value: ' + message.param_value +
	    ' param_type: ' + message.param_type +
	    ' param_count: ' + message.param_count +
	    ' param_index: ' + message.param_index);
    }
});

this.mavlinkParser.on('HIGHRES_IMU', function(message) {
    /* 
     * The IMU readings in SI units in NED body frame
     *
     * time_usec       Timestamp (microseconds, synced to UNIX time or since system boot)
     * xacc            X acceleration (m/s^2)
     * yacc            Y acceleration (m/s^2)
     * zacc            Z acceleration (m/s^2)
     * xgyro           Angular speed around X axis (rad / sec)
     * ygyro           Angular speed around Y axis (rad / sec)
     * zgyro           Angular speed around Z axis (rad / sec)
     * xmag            X Magnetic field (Gauss)
     * ymag            Y Magnetic field (Gauss)
     * zmag            Z Magnetic field (Gauss)
     * abs_pressure    Absolute pressure in millibar
     * diff_pressure   Differential pressure in millibar
     * pressure_alt    Altitude calculated from pressure
     * temperature     Temperature in degrees celsius
     * fields_updated  Bitmask for fields that have updated since last message, bit 0 = xacc, bit 12: temperature
     */
    if(self.debugIMU && self.debugLevel == 1) {
        console.log('High res IMU');
    } else if (self.debugIMU && self.debugLevel > 1) {
	console.log('High res IMU:' +
	    ' time_usec: ' + message.time_usec +
	    ' xacc: ' + message.xacc +
	    ' yacc: ' + message.yacc +
	    ' zacc: ' + message.zacc +
	    ' xgyro: ' + message.xgyro +
	    ' ygyro: ' + message.ygyro +
	    ' zgyro: ' + message.zgyro +
	    ' xmag: ' + message.xmag +
	    ' ymag: ' + message.ymag +
	    ' zmag: ' + message.zmag +
	    ' abs_pressure: ' + message.abs_pressure +
	    ' diff_pressure: ' + message.diff_pressure +
	    ' pressure_alt: ' + message.pressure_alt +
	    ' temperature: ' + message.temperature
	);
    }

    /*
    * TODO: implement reportin the pressure based altitude, possibly the x/y/z mag as well
    self.vehicleState = _.extend(self.vehicleState, {
	time_usec: message.time_usec,
	xacc: message.xacc,
	yacc: message.yacc,
	zacc: message.zacc,
	xgyro: message.xgyro,
	ygyro: message.ygyro,
	zgyro: message.zgyro,
	xmag: message.xmag,
	ymag: message.ymag,
	zmag: message.zmag,
	abs_pressure: message.abs_pressure,
	diff_pressure: message.diff_pressure,
	pressure_alt: message.pressure_alt,
	temperature: message.temperature
    });
    */
});

this.mavlinkParser.on('GPS_STATUS', function(message) {
    // TODO: consider how to handle this
    self.vehicleState = _.extend(self.vehicleState, {
	satellites_visible: message.satellites_visible,
	satellite_prn: new Uint8Array(message.satellite_prn),
	satellite_used: new Uint8Array(message.satellite_used),
	satellite_elevation: new Uint8Array(message.satellite_elevation),
	satellite_azimuth: new Uint8Array(message.satellite_azimuth),
	satellite_snr: new Uint8Array(message.satellite_snr)
    });
    
    if(self.debugGPSStatus && self.debugLevel == 1) {
        console.log('GPS Status');
    } else if (self.debugGPSStatus && self.debugLevel > 1) {
	console.log('GPS Status: ' +
	    ' sats visible: ' + self.vehicleState.satellites_visible);

	for(var i = 0, l = message.satellite_prn.length; i < l; i++) {
	    console.log(' Satellite ' + i + ',' +
		' id: ' + parseInt(message.satellite_prn.charCodeAt(i), 10) + ', ' +
		' used: ' + parseInt(message.satellite_used.charCodeAt(i), 10) + ', ' +
		' elevation: ' + parseInt(message.satellite_elevation.charCodeAt(i), 10) + ', ' +
		' azimuth: ' + parseInt(message.satellite_azimuth.charCodeAt(i), 10) + ', ' +
		' snr: ' + parseInt(message.satellite_snr.charCodeAt(i), 10) 
	    );
	}
    }
});

this.mavlinkParser.on('SYS_STATUS', function(message) {
    /*
    * The general system state. If the system is following the MAVLink standard, the system state 
    * is mainly defined by three orthogonal states/modes: The system mode, which is either LOCKED 
    * (motors shut down and locked), MANUAL (system under RC control), GUIDED (system with 
    * autonomous position control, position setpoint controlled manually) or AUTO (system guided 
    * by path/waypoint planner). 
    *
    * The NAV_MODE defined the current flight state: LIFTOFF (often an open-loop maneuver), 
    * LANDING, WAYPOINTS or VECTOR. This represents the internal navigation state machine. The 
    * system status shows wether the system is currently active or not and if an emergency occured. 
    *
    * During the CRITICAL and EMERGENCY states the MAV is still considered to be active, but 
    * should start emergency procedures autonomously. After a failure occured it should first move 
    * from active to critical to allow manual intervention and then move to emergency after a 
    * certain timeout.
    */

    // According to the doco, batery voltage is in milivolts, which should mean divide by 1000,
    // strangely the test device is reporting 57v. TODO: test if voltage is reported correctly

    if(self.debugSysStatus && self.debugLevel == 1) {
	console.log('Sys Status');
    } else if (self.debugSysStatus && self.debugLevel > 1) {
	console.log('Sys Status:' +
	    ' battery voltage (millivolts): ' + message.voltage_battery + 
	    ' current (10 millamperes): ' + message.current_battery + 
	    ' remaining %: ' + message.battery_remaining + 
	    ' comm drop rate %: ' + message.drop_rate_comm + 
	    ' comm errors: ' + message.errors_com);
    }

    if(self.batteryVoltage    != message.voltage_battery / 1000 || 
	self.batteryCurrent   != message.current_battery / 100 ||
	self.batteryRemaining != message.battery_remaining ||
	self.commDropRate     != message.drop_rate_comm ||
	self.commErrors       != message.errors_comm) {

	self.batteryVoltage   = message.voltage_battery / 1000;
	self.batteryCurrent   = message.current_battery / 100;
	self.batteryRemaining = message.battery_remaining;
	self.commDropRate     = message.drop_rate_comm;
	self.commErrors       = message.errors_comm;

	self.emit('systemState', self.batteryVoltage, self.batteryCurrent, self.batteryRemaining, self.commDropRate, self.commErrors);
    }
});

this.mavlinkParser.on('ATTITUDE', function(message) {
    /* 
     * The attitude in the aeronautical frame (right-handed, Z-down, X-front, Y-right).
     *
     * time_boot_ms   Timestamp (milliseconds since system boot)
     * roll           Roll angle (rad, -pi..+pi)
     * pitch          Pitch angle (rad, -pi..+pi)
     * yaw            Yaw angle (rad, -pi..+pi)
     * rollspeed      Roll angular speed (rad/s)
     * pitchspeed     Pitch angular speed (rad/s)
     * yawspeed       Yaw angular speed (rad/s)
     */
    if(self.debugAttitude && self.debugLevel == 1) {
	console.log('Attitude');
    } else if (self.debugAttitude && self.debugLevel > 1) {
	console.log('Attitude:' + 
	    ' pitch: ' + message.pitch + 
	    ' roll: ' + message.roll + 
	    ' yaw: ' + message.yaw + 
	    ' pitch speed: ' + message.pitch.speed + 
	    ' rollspeed: ' + message.rollspeed + 
	    ' yaw speed: ' + message.yawspeed);
    }

    // only recognise an attitude change if the change is more than the accuracy of the attitude
    // console.log('pitch prev: ' + message.pitch + " was: " + self.attitude.pitch + " accuracy: " + self.attitudeAccuracy);
    if((self.attitude.pitch > message.pitch + self.pitchAccuracy || self.attitude.pitch < message.pitch - self.pitchAccuracy) ||
       (self.attitude.roll  > message.roll  + self.rollAccuracy  || self.attitude.roll  < message.roll  - self.rollAccuracy) ||
       (self.attitude.yaw   > message.yaw   + self.yawAccuracy   || self.attitude.yaw   < message.yaw   - self.yawAccuracy)) {

        // update the attitude
	self.attitude.pitch = message.pitch;
	self.attitude.roll = message.roll;
	self.attitude.yaw = message.yaw;

	// TODO; do we need to know the speed of change?
	/*
	pitchspeed: message.pitchspeed,
	rollspeed: message.rollspeed,
	yawspeed: message.yawspeed
	*/

	// fire the event
	self.emit('attitude', self.attitude);
    }
});

this.mavlinkParser.on('VFR_HUD', function(message) {
    /* Metrics typically displayed on a HUD for fixed wing aircraft
     *
     * airspeed    Current airspeed in m/s
     * groundspeed Current ground speed in m/s
     * heading     Current heading in degrees, in compass units (0..360, 0=north)
     * throttle    Current throttle setting in integer percent, 0 to 100
     * alt         Current altitude (MSL), in meters
     * climb       Current climb rate in meters/second
     */
    if(self.debugVFR_HUD && self.debugLevel == 1) {
	console.log('VFR HUD');
    } else if (self.debugVFR_HUD && self.debugLevel > 1) {
	console.log('VFR HUD:' + 
	    ' air speed: ' + message.airspeed + 
	    ' ground speed: ' + message.groundspeed + 
	    ' heading: ' + message.heading + 
	    ' throttle: ' + message.throttle + 
	    ' climb: ' + message.climb);
    }

    // Appears to be only reported for fixed wing aircraft
    /*
    self.vehicleState = _.extend(self.vehicleState, {
	airspeed: message.airspeed,
	groundspeed: message.groundspeed,
	heading: message.heading,
	throttle: message.throttle,
	climb: message.climb
    });
    */
});

this.mavlinkParser.on('GPS_RAW_INT', function(message) {
    /*
     * The global position, as returned by the Global Positioning System (GPS). 
     * This is NOT the global position estimate of the sytem, but rather a RAW 
     * sensor value. See message GLOBAL_POSITION for the global position 
     * estimate. Coordinate frame is right-handed, Z-axis up (GPS frame).
     *
     * time_usec          Timestamp (microseconds since UNIX epoch or microseconds since system boot)
     * fix_type           0-1: no fix, 2: 2D fix, 3: 3D fix. Some applications will not use the value of 
     *                    this field unless it is at least two, so always correctly fill in the fix.
     * lat                Latitude in 1E7 degrees
     * lon                Longitude in 1E7 degrees
     * alt                Altitude in 1E3 meters (millimeters) above MSL
     * ephu               GPS HDOP horizontal dilution of position in cm (m*100). If unknown, set to: 65535
     * epvu               GPS VDOP horizontal dilution of position in cm (m*100). If unknown, set to: 65535
     * velu               GPS ground speed (m/s * 100). If unknown, set to: 65535
     * cogu               Course over ground (NOT heading, but direction of movement) in degrees * 100, 
     *                    0.0..359.99 degrees. If unknown, set to: 65535
     * satellites_visible Number of satellites visible. If unknown, set to 255
     */
    if(self.debugGPSRaw && self.debugLevel == 1) {
	console.log('GPS Raw (int)');
    } else if (self.debugGPSRaw && self.debugLevel > 1) {
	console.log('GPS Raw (int):' + 
	    ' fix type: ' + message.fix_type +
	    ' lat: ' + message.lat / 10000000 + 
	    ' lng: ' + message.lon / 10000000 + 
	    ' alt: ' + message.alt / 1000 + 
	    ' eph: ' + message.eph / 100 + 
	    ' epv: ' + message.epv / 100 + 
	    ' vel: ' + message.vel / 100 + 
	    ' cog: ' + message.cog);
    }

    // need tollerance factor here?
    // self.emit('positionGPSRawInt', message.lat / 10000000, message.lon / 10000000, message.alt / 1000);

    var lat = message.lat / 10000000; 
    var lng = message.lon / 10000000;

    var reportPos = false;

    switch(self.positionMode) {
        case MavlinkProtocol.POSITION_MODE_NONE:
	    reportPos = true;
	    break;

        case MavlinkProtocol.POSITION_MODE_DISTANCE:
	    if(measure(self.position.latitude, self.position.longitude, lat, lng) * 1000 > self.positionDiff) {
		reportPos = true;
	    }
	    break;

        case MavlinkProtocol.POSITION_MODE_TIME:
            var currentTime = new Date().getTime();

	    if(currentTime - self.positionTimer > self.positionDiff * 1000) {
		reportPos = true;
		self.positionTimer = currentTime;
	    }
	    break;
    }


    if(reportPos) {
	self.position.latitude  = message.lat / 10000000;
	self.position.longitude = message.lon / 10000000;
	self.position.altitude  = message.alt / 1000;

	self.emit('positionGPSRawInt', self.position);
    }
});

/* end init listeners for mavlink */

}

/*
 * measures the distance between to points in kilometers
 *
 * params:
 *    latitude1   latitude of the first point
 *    longitude1  longitude of the first point
 *    latitude2   latitude of the second point
 *    longitude2  longitude of the second point
 *    radius      radius to be used, defaults to 6371.
 *      
 * note that the following code is derived from code sourced from 
 * http://www.movable-type.co.uk/scripts/latlong.html
 * copyright belongs to Chris Veness 2002-2012. Chris has licenced the code under creative commons 
 * by attribution, refer http://creativecommons.org/licenses/by/3.0/
 */
function measure(lat1, lon1, lat2, lon2, radius) {  
    var R = 6371; // km

    /*
    var dLat = toRad(lat2-lat1);
    var dLon = toRad(lon2-lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);
    */
    var dLat = (lat2-lat1) * (Math.PI / 180);
    var dLon = (lon2-lon1) * (Math.PI / 180);

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * (Math.PI / 170)) * Math.cos(lat2 * (Math.PI / 170)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;

    return d;
    /*
    double R = 6371; // km

    double dLat = (lat2-lat1)* (PI / 180);
    double dLon = (lon2-lon1)* (PI / 180);

    double a = sin(dLat/2) * sin(dLat/2) + 
               cos(lat1 * (PI / 180)) * cos(lat2 * (PI / 180)) * sin(dLon/2) * sin(dLon/2);
    double c = 2 * atan2(sqrt(a), sqrt(1-a));
    double d = R * c;
    return d;
    */
}

/* convert from degrees to radians */
function toRad(v) {
    return v * Math.PI / 180;
}

function getNextSequence() {
    this._msgSequence++;

    if(this._msgSequence > 255) {
	this._msgSequence = 1;
    }

    return this._msgSequence;
}
//
// console.log(" test ping message: " + msg);
// serialPort.write(msg.pack());

