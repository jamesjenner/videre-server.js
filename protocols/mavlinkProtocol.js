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


// var events     = require('events');
var EventEmitter = require('events').EventEmitter;
var util       = require('util');


var mavlink    = require('../implementations/mavlink_common_v1.0');

var Protocol   = require('./protocol.js');
var MavlinkCnv = require('./mavlinkCnv.js');

// TODO: should be able to remove these, telemetry is refered to in the code but it's not doing anything afaict
var Attitude   = require('../videre-common/js/attitude');
var Point      = require('../videre-common/js/point');
var Position   = require('../videre-common/js/position');
var Telemetry  = require('../videre-common/js/telemetry');

module.exports = MavlinkProtocol;

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

MavlinkProtocol.COMMAND_COMPONENT = 50;

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

// setup MavlinkProtocol as a protocol
util.inherits(MavlinkProtocol, Protocol);

/**
 * define a new mavlink protocol 
 *
 * extends protocol
 */
function MavlinkProtocol(options) {
    MavlinkProtocol.super_.call(this, options);  // call the super constructr

    options = options || {};

    this.debugMessage = ((options.debugMessage != null) ? options.debugMessage : false);
    this.debugAttitude = ((options.debugAttitude != null) ? options.debugAttitude : false);
    this.debugSysStatus = ((options.debugSysStatus != null) ? options.debugSysStatus : false);
    this.debugWaypoints = ((options.debugWaypoints != null) ? options.debugWaypoints : false);
    this.debugHeartbeat = ((options.debugHeartbeat != null) ? options.debugHeartbeat : false);
    this.debugIMU = ((options.debugIMU != null) ? options.debugIMU : false);
    this.debugGPS = ((options.debugGPS != null) ? options.debugGPS : false);
    this.debugGPSRaw = ((options.debugGPSRaw != null) ? options.debugGPSRaw : false);
    this.debugGPSStatus = ((options.debugGPSStatus != null) ? options.debugGPSStatus : false);

    // the default for attitude accuracy is 0.05 radians, approx. 2.86 of a degree, 
    // the default for attitude accuracy is 0.02 radians, approx. 1.15 of a degree, 
    // the default for attitude accuracy is 0.002 radians, approx. 0.11 of a degree, 
    // the default for attitude accuracy is 0.003 radians, approx. 0.17 of a degree, 
    // note that attiude is represented in radians of 2pi, but split into -pi and +pi to make up the 2pi
    // this.pitchAccuracy = ((options.pitchAccuracy != null) ? options.pitchAccuracy : 0.003);
    // this.rollAccuracy = ((options.rollAccuracy != null) ? options.rollAccuracy : 0.003);
    // this.yawAccuracy = ((options.yawAccuracy != null) ? options.yawAccuracy : 0.05);

    // a negative id means that it is currently not known, it is set by the heartbeat message

    this.devices = new Object();
    this.mavlinkParser = new MAVLink();
    this.reportingGlobalPositionInt = false;

    this._setupListeners();
}

MavlinkProtocol.prototype.processData = function(data) {
    this.mavlinkParser.parseBuffer(data);
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

    MavlinkProtocol.super_.prototype._writeMessage.call(this, p);
}

/**
 * request to set the autonomous mode of the device
 *
 * id            the id of the vehicle for the request
 * setAutonomous boolean representing whether to be autonomous or not
 *
 * returns       true if request generated
 *               false if the mode was already set to this mode
 */
MavlinkProtocol.prototype.setAutonomousMode = function(vehicleId, setAutonomous) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // copy the mode
    var newMode = this.devices[deviceId]._baseMode;

    // check and apply changes as required
    if(setAutonomous) {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_AUTO_ENABLED)) {
	    return false;
	} else {
	    // we are not autonomous
	    newMode |= mavlink.MAV_MODE_FLAG_AUTO_ENABLED;
	}
    } else {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_AUTO_ENABLED)) {
	    // we are autonomous
	    newMode ^= mavlink.MAV_MODE_FLAG_AUTO_ENABLED;
	} else {
	    return false;
	}
    }

    // send message
    this._writeMessage(new mavlink.messages.set_mode(deviceId, newMode, this.devices[deviceId]._customMode));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' set autonomous mode ' + setAutonomous);
    }
    return true;
}

/**
 * request to set the test mode of the device
 *
 * id          the id of the vehicle for the request
 * setTestMode boolean representing whether to be in test mode or not
 *
 * returns     true if request generated
 *             false if the mode was already set to this mode
 */
MavlinkProtocol.prototype.setTestMode = function(vehicleId, setTestMode) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // copy the mode
    var newMode = this.devices[deviceId]._baseMode;

    // check and apply changes as required
    if(setTestMode) {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_TEST_ENABLED)) {
	    return false;
	} else {
	    // we are not test mode
	    newMode |= mavlink.MAV_MODE_FLAG_TEST_ENABLED;
	}
    } else {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_TEST_ENABLED)) {
	    // we are test mode
	    newMode ^= mavlink.MAV_MODE_FLAG_TEST_ENABLED;
	} else {
	    return false;
	}
    }

    // send message
    this._writeMessage(new mavlink.messages.set_mode(deviceId, newMode, this.devices[deviceId]._customMode));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' set test mode ' + setTestMode);
    }

    return true;
}

/**
 * request to set the stabalized  mode of the device
 *
 * id            the id of the vehicle for the request
 * setStabalized boolean representing whether to be stabalized or not
 *
 * returns       true if request generated
 *               false if the mode was already set to this mode
 */
MavlinkProtocol.prototype.setStabilizedMode = function(vehicleId, setStabilized) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // copy the mode
    var newMode = this.devices[deviceId]._baseMode;

    // check and apply changes as required
    if(setStabilized) {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_STABILIZE_ENABLED)) {
	    return false;
	} else {
	    // we are not stabilised
	    newMode |= mavlink.MAV_MODE_FLAG_STABILIZE_ENABLED;
	}
    } else {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_STABILIZE_ENABLED)) {
	    // we are stabilised
	    newMode ^= mavlink.MAV_MODE_FLAG_STABILIZE_ENABLED;
	} else {
	    return false;
	}
    }

    // send message
    this._writeMessage(new mavlink.messages.set_mode(deviceId, newMode, this.devices[deviceId]._customMode));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' set stabilized mode ' + setStabilized);
    }

    return true;
}

/**
 * request to set the hardware in loop mode of the device
 *
 * id          the id of the vehicle for the request
 * setHIL      boolean representing whether to be hardware in loop or not
 *
 * returns     true if request generated
 *             false if the mode was already set to this mode
 */
MavlinkProtocol.prototype.setHardwareInLoopMode = function(vehicleId, setHIL) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // copy the mode
    var newMode = this.devices[deviceId]._baseMode;

    // check and apply changes as required
    if(setHIL) {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_HIL_ENABLED)) {
	    return false;
	} else {
	    // we are not hardware in loop
	    newMode |= mavlink.MAV_MODE_FLAG_HIL_ENABLED;
	}
    } else {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_HIL_ENABLED)) {
	    // we are hardware in loop
	    newMode ^= mavlink.MAV_MODE_FLAG_HIL_ENABLED;
	} else {
	    return false;
	}
    }

    // send message
    this._writeMessage(new mavlink.messages.set_mode(deviceId, newMode, this.devices[deviceId]._customMode));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' set hardware in loop mode ' + setHIL);
    }

    return true;
}

/**
 * request to set the remote control mode of the device
 *
 * id               the id of the vehicle for the request
 * setRemoteControl boolean representing whether to be remote control or not
 *
 * returns          true if request generated
 *                  false if the mode was already set to this mode
 */
MavlinkProtocol.prototype.setRemoteControlMode = function(vehicleId, setRemoteControl) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // copy the mode
    var newMode = this.devices[deviceId]._baseMode;

    // check and apply changes as required
    if(setRemoteControl) {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_MANUAL_INPUT_ENABLED)) {
	    return false;
	} else {
	    // we are not remote control
	    newMode |= mavlink.MAV_MODE_FLAG_MANUAL_INPUT_ENABLED;
	}
    } else {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_MANUAL_INPUT_ENABLED)) {
	    // we are remote control
	    newMode ^= mavlink.MAV_MODE_FLAG_MANUAL_INPUT_ENABLED;
	} else {
	    return false;
	}
    }

    // send message
    this._writeMessage(new mavlink.messages.set_mode(deviceId, newMode, this.devices[deviceId]._customMode));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' set remote control mode ' + setRemoteControl);
    }

    return true;
}

/**
 * request to set the guided mode of the device
 *
 * id          the id of the vehicle for the request
 * setGuided   boolean representing whether to be guided or not
 *
 * returns     true if request generated
 *             false if the mode was already set to this mode
 */
MavlinkProtocol.prototype.setGuidedMode = function(vehicleId, setGuided) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // copy the mode
    var newMode = this.devices[deviceId]._baseMode;

    // check and apply changes as required
    if(setGuided) {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_GUIDED_ENABLED)) {
	    return false;
	} else {
	    // we are not guided
	    newMode |= mavlink.MAV_MODE_FLAG_GUIDED_ENABLED;
	}
    } else {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_GUIDED_ENABLED)) {
	    // we are guided
	    newMode ^= mavlink.MAV_MODE_FLAG_GUIDED_ENABLED;
	} else {
	    return false;
	}
    }

    // send message
    this._writeMessage(new mavlink.messages.set_mode(deviceId, newMode, this.devices[deviceId]._customMode));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' set guided mode ' + setGuided);
    }

    return true;
}

/**
 * request to set the armed mode of the device
 *
 * id          the id of the vehicle for the request
 * setArmed    boolean representing whether to be armed or not
 *
 * returns     true if request generated
 *             false if the mode was already set to this mode
 */
MavlinkProtocol.prototype.setArmedMode = function(vehicleId, setArmed) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // copy the mode
    var newMode = this.devices[deviceId]._baseMode;

    // check and apply changes as required
    if(setArmed) {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_SAFETY_ARMED)) {
	    return false;
	} else {
	    // we are not armed, arm
	    newMode |= mavlink.MAV_MODE_FLAG_SAFETY_ARMED;
	}
    } else {
	if(isSet(newMode, mavlink.MAV_MODE_FLAG_SAFETY_ARMED)) {
	    // we are armed, disarm
	    newMode ^= mavlink.MAV_MODE_FLAG_SAFETY_ARMED;
	} else {
	    return false;
	}
    }

    // send message
    this._writeMessage(new mavlink.messages.set_mode(deviceId, newMode, this.devices[deviceId]._customMode));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' set armed mode ' + setArmed);
    }

    return true;
}

/**
 * request to launch the device
 *
 * id          the id of the vehicle for the request
 */
MavlinkProtocol.prototype.launch = function(vehicleId) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // send message
    this._writeMessage(new mavlink.messages.command_long(deviceId, 
	mavlink.MAV_COMP_ID_ALL, 
	mavlink.MAV_CMD_NAV_TAKEOFF, 
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' launch');
    }
}

/**
 * request to land the device
 *
 * id          the id of the vehicle for the request
 */
MavlinkProtocol.prototype.land = function(vehicleId) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // send message
    this._writeMessage(new mavlink.messages.command_long(deviceId, 
	MavlinkProtocol.MAV_COMP_ID_ALL, 
	mavlink.MAV_CMD_NAV_LAND, 
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' land');
    }
}

/**
 * request the device to hold (pause/stop and hold position)
 *
 * id          the id of the vehicle for the request
 */
MavlinkProtocol.prototype.halt = function(vehicleId) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // send message
    this._writeMessage(new mavlink.messages.command_long(deviceId, 
	MavlinkProtocol.MAV_COMP_ID_ALL, 
	mavlink.MAV_CMD_OVERRIDE_GOTO, 
	1,
	mavlink.MAV_GOTO_DO_HOLD,
	mavlink.MAV_GOTO_HOLD_AT_CURRENT_POSITION,
	0,
	0,
	0,
	0,
	0));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' halt');
    }
}

/**
 * request the device to continue (go/unpause)
 *
 * id          the id of the vehicle for the request
 */
MavlinkProtocol.prototype.go = function(vehicleId) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // send message
    this._writeMessage(new mavlink.messages.command_long(deviceId, 
	MavlinkProtocol.MAV_COMP_ID_ALL, 
	mavlink.MAV_CMD_OVERRIDE_GOTO, 
	1,
	mavlink.MAV_GOTO_DO_CONTINUE,
	mavlink.MAV_GOTO_HOLD_AT_CURRENT_POSITION,
	0,
	0,
	0,
	0,
	0));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' go');
    }
}

/**
 * request the device to reboot the autopilot
 *
 * id          the id of the vehicle for the request
 */
MavlinkProtocol.prototype.rebootAutopilot = function(vehicleId) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // send message
    this._writeMessage(new mavlink.messages.command_long(deviceId, 
	MavlinkProtocol.MAV_COMP_ID_ALL, 
	mavlink.MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN, 
	1,
	0,
	2, // QGroundControl has the value of 2 here, uncertain why, it's not documented
	0,
	0,
	0,
	0,
	0));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' reboot autopilot');
    }
}

/**
 * request the device to reboot the onboard computer
 *
 * id          the id of the vehicle for the request
 */
MavlinkProtocol.prototype.reboot = function(vehicleId) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // send message
    this._writeMessage(new mavlink.messages.command_long(deviceId, 
	MavlinkProtocol.MAV_COMP_ID_ALL, 
	mavlink.MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN, 
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' reboot');
    }
}

/**
 * request the device to shutdown the autopilot
 *
 * id          the id of the vehicle for the request
 */
MavlinkProtocol.prototype.shutdownAutopilot = function(vehicleId) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // send message
    this._writeMessage(new mavlink.messages.command_long(deviceId, 
	MavlinkProtocol.MAV_COMP_ID_ALL, 
	mavlink.MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN, 
	2,
	0,
	0,
	0,
	0,
	0,
	0,
	0));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' shutdown autopilot');
    }
}

/**
 * request the device to shutdown the onboard computer
 *
 * id          the id of the vehicle for the request
 */
MavlinkProtocol.prototype.shutdown = function(vehicleId) {
    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    // send message
    this._writeMessage(new mavlink.messages.command_long(deviceId, 
	MavlinkProtocol.MAV_COMP_ID_ALL, 
	mavlink.MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN, 
	0,
	2,
	0,
	0,
	0,
	0,
	0,
	0));

    if(this.loggingOut) {
	this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' shutdown');
    }
}

/**
 * request to update the waypoints for the drone
 *
 * id          the id of the vehicle for the request
 * waypoints   the waypoints to set
 *
 * returns      1 if request generated
 *             -1 if the system id is unknown
 *             -2 if currently processing waypoints
 *             -3 no waypoints specified
 */
MavlinkProtocol.prototype.requestSetWaypoints = function(vehicleId, waypoints) {
    var request = false;

    if(this.debugWaypoints) {
	console.log("Requesting setting of " + waypoints.length + " waypoints");
    }

    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    if(!waypoints || waypoints.length === 0) {
	if(this.debugWaypoints) {
	    console.log("Cannot request to set waypoints when no waypoints have been specified");
	}

	return -3;
    }

    if(this.devices[deviceId]._waypointMode === MavlinkProtocol.WAYPOINT_NO_ACTION || 
       this.devices[deviceId]._waypointMode === MavlinkProtocol.WAYPOINT_UPDATE_REQUESTED) {
	// clear timeouts, just in case
        clearTimeout(this.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_COUNT_TIMEOUT_ID]);

	// setup the waypoint info
	this.devices[deviceId]._waypoints = MavlinkCnv.waypointsVtoM(waypoints);
	this.devices[deviceId]._waypointCount = this.devices[deviceId]._waypoints.length;
	this.devices[deviceId]._waypointLastSequence = -1;

	// set mode to request mode
        this.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_UPDATE_REQUESTED;
	
	// request the waypoints
	this._writeWithTimeout({
	    deviceId: deviceId,
	    message: new mavlink.messages.mission_count(deviceId, MavlinkProtocol.COMMAND_COMPONENT, waypoints.length),
	    timeout: 10000, 
	    maxAttempts: 3, 
	    messageName: 'mission count', 
	    attempts: 0,
	    timeoutId: MavlinkProtocol._MISSION_COUNT_TIMEOUT_ID,
	    onMaxAttempts: function() { this.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
	});
    } else {
	if(this.debugWaypoints) {
	    if(this.debugLevel === 0) {
		console.log("requestSetWaypoints rejected, currently busy on other activities");
	    } else {
		console.log("requestSetWaypoints rejected, current state is " + this.devices[deviceId]._getWaypointState());
	    }
	}
	return -2;
    }

    return 1;
}

/**
 * request the waypoints from the drone
 *
 * id      the id of the vehicle for the request
 *
 * returns  1 if request generated
 *         -1 if the system id is unknown
 *         -2 if currently processing waypoints
 */
MavlinkProtocol.prototype.requestWaypoints = function(vehicleId) {
    var request = false;

    if(this.debugWaypoints) {
	console.log("Requesting waypoints");
    }

    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    if(this.devices[deviceId]._waypointMode === MavlinkProtocol.WAYPOINT_NO_ACTION || 
       this.devices[deviceId]._waypointMode ===  MavlinkProtocol.WAYPOINT_REQUESTED) {
	// clear timeouts, just in case
	clearTimeout(this.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_REQUEST_LIST_TIMEOUT_ID]);
	clearTimeout(this.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_REQUEST_TIMEOUT_ID]);

	// reset the waypoint info
	this.devices[deviceId]._waypoints = new Array();
	this.devices[deviceId]._waypointCount = 0;
	this.devices[deviceId]._waypointLastSequence = -1;

	// set mode to request mode
        this.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_REQUESTED;
	
	// request the waypoints
	this._writeWithTimeout({
	    deviceId: deviceId,
	    message: new mavlink.messages.mission_request_list(deviceId, MavlinkProtocol.COMMAND_COMPONENT),
	    timeout: 10000, 
	    maxAttempts: 3, 
	    messageName: 'mission request list', 
	    attempts: 0,
	    timeoutId: MavlinkProtocol._MISSION_REQUEST_LIST_TIMEOUT_ID,
	    onMaxAttempts: function() { this.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
	});
    } else {
	if(this.debugWaypoints) {
	    if(this.debugLevel === 0) {
		console.log("requestWaypoints rejected, currently busy on other activities");
	    } else {
		console.log("requestWaypoints rejected, current state is " + this.devices[deviceId]._getWaypointState());
	    }
	}
	return -2;
    }

    return 1;
}

/**
 * request that the target is set to the specified waypoint
 *
 * id          the id of the vehicle for the request
 * waypoint    the waypoint that is to be the target
 *
 * returns      1 if request generated
 *             -1 if the system id is unknown
 *             -2 if currently busy
 */
MavlinkProtocol.prototype.requestSetTargetWaypoint = function(vehicleId, waypoint) {
    if(this.debugWaypoints) {
	console.log("setting target waypoint: " + waypoint);
    }

    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    if(this.devices[deviceId]._waypointMode === MavlinkProtocol.WAYPOINT_NO_ACTION) {
	// set mode to setting target
	// this.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_SETTING_TARGET;
	
	// request set target waypoint
	this._writeMessage(new mavlink.messages.mission_set_current(deviceId, MavlinkProtocol.COMMAND_COMPONENT, waypoint));

	if(this.loggingOut) {
	    this.loggerOut.info(vehicleId + ':' + deviceId + ':' + ' request set target waypoint ' + waypoint);
	}

	/*
	this._writeWithTimeout({
	    deviceId: deviceId,
	    message: new mavlink.messages.mission_set_current(deviceId, MavlinkProtocol.COMMAND_COMPONENT, waypoint),
	    timeout: 10000, 
	    maxAttempts: 3, 
	    messageName: 'mission set current', 
	    attempts: 0,
	    timeoutId: MavlinkProtocol._MISSION_SET_TARGET_ID,
	    onMaxAttempts: function() { this.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
	});
	*/
    } else {
	if(this.debugWaypoints) {
	    if(this.debugLevel === 0) {
		console.log("requestSetTarget rejected, currently busy on other activities");
	    } else {
		console.log("requestSetTarget rejected, current state is " + this.devices[deviceId]._getWaypointState());
	    }
	}

	return -2;
    }

    return 1;
}

/**
 * request that the target is set to the specified waypoint
 *
 * id          the id of the vehicle for the request
 * waypoint    the waypoint that is to be the target
 *
 * returns      1 if request generated
 *             -1 if the system id is unknown
 *             -2 if currently busy
 */
MavlinkProtocol.prototype.requestClearWaypoints = function(vehicleId) {
    if(this.debugWaypoints) {
	console.log("clearing waypoints");
    }

    // convert the videre id to the mavlink id
    var deviceId = this.getMavlinkId(vehicleId);

    if(this.devices[deviceId]._waypointMode === MavlinkProtocol.WAYPOINT_NO_ACTION) {
	// request to clear all waypoints 

	/*
	 * it appears that while the spec at http://qgroundcontrol.org/mavlink/waypoint_protocol
 	 * states that the clear all will respond with an ack, testing has shown different.
	 * examining the code for QGroundControl has also shown that it doesn't wait for an ack
	 * so leaving the code here to perform the timeout, however expect that it is a send and 
	 * forget....
	 *
	// set mode to requesting clear all
	this.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_REQUESTING_CLEAR_ALL;
	
	this._writeWithTimeout({
	    deviceId: deviceId,
	    message: new mavlink.messages.mission_clear_all(deviceId, MavlinkProtocol.COMMAND_COMPONENT),
	    timeout: 10000, 
	    maxAttempts: 3, 
	    messageName: 'mission clear all', 
	    attempts: 0,
	    timeoutId: MavlinkProtocol._MISSION_CLEAR_ALL,
	    onMaxAttempts: function() { this.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
	});
	*/

	this._writeMessage(new mavlink.messages.mission_clear_all(deviceId, MavlinkProtocol.COMMAND_COMPONENT));
    } else {
	if(this.debugWaypoints) {
	    if(this.debugLevel === 0) {
		console.log("requestClearWaypoints rejected, currently busy on other activities");
	    } else {
		console.log("requestClearWaypoints rejected, current state is " + this.devices[deviceId]._getWaypointState());
	    }
	}

	return -2;
    }

    return 1;
}

MavlinkProtocol.prototype._setupListeners = function() {

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

// TODO: support vision related messages

this.mavlinkParser.on('message', function(message) {
    if(self.debugMessage) {
	console.log(message.name + ' <- received message for ' + self.id + ":" + message.header.srcSystem + ", protocol " + self.name);
    }

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name);
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

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
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

    var deviceId = message.header.srcSystem;

    if(self.devices[deviceId] === undefined) {
        var vehicleId = self.getVehicleIdFunction(self.id, deviceId, self.name);

	var options = self.getDeviceOptionsFunction(self.id, deviceId);
	self.devices[deviceId] = new _Device(deviceId, vehicleId, options);
    }

    // if the system status has changed then update it
    if(self.devices[deviceId].systemStatus != message.system_status) {
	self.devices[deviceId].systemStatus = message.system_status;

	switch(message.system_status) {
	    case mavlink.MAV_STATE_UNINIT:
		self.devices[deviceId].systemStatusText = 'Uninitialized';
		break;
	    case mavlink.MAV_STATE_BOOT:
		self.devices[deviceId].systemStatusText = 'Booting';
		break;
	    case mavlink.MAV_STATE_CALIBRATING:
		self.devices[deviceId].systemStatusText = 'Calibrating';
		break;
	    case mavlink.MAV_STATE_STANDBY:
		self.devices[deviceId].systemStatusText = 'Standby';
		break;
	    case mavlink.MAV_STATE_ACTIVE:
		self.devices[deviceId].systemStatusText = 'Active';
		break;
	    case mavlink.MAV_STATE_CRITICAL:
		self.devices[deviceId].systemStatusText = 'Critical';
		break;
	    case mavlink.MAV_STATE_EMERGENCY:
		self.devices[deviceId].systemStatusText = 'Emergency / Mayday';
		break;
            case mavlink.MAV_STATE_POWEROFF:
		self.devices[deviceId].systemStatusText = 'Shuting down';
		break;
	}

	// fire the stateChanged event

	self.emit('systemStatusChanged', self.id, deviceId, self.devices[deviceId].systemStatus, self.devices[deviceId].systemStatusText);
    }
       
    if(self.devices[deviceId]._customMode != message.custom_mode) {
	self.devices[deviceId]._customMode = message.custom_mode;
	self.emit('customModechanged', self.id, deviceId, self.devices[deviceId]._customMode);
    }

    /*
    console.log("heartbeat => " + 
	JSON.stringify(message.base_mode) + " toString(2) -> " + 
	message.base_mode.toString(2) + " integer -> " + 
	parseInt(message.base_mode, 2) + " raw -> " + 
	self.devices[deviceId]._baseMode + " : " + message.base_mode + " bin -> " + 
	parseInt(self.devices[deviceId]._baseMode, 2).toString(2) + " : " + parseInt(message.base_mode, 2).toString(2));
    */

    // if the base mode has changed then update it
    if(self.devices[deviceId]._baseMode != message.base_mode) {
	var autonomousModeOld = self.devices[deviceId].autonomousMode;
	var testModeOld = self.devices[deviceId].testMode;
	var stabilizedModeOld = self.devices[deviceId].stabilizedMode;
	var hardwareInLoopOld = self.devices[deviceId].hardwareInLoop;
	var remoteControlOld = self.devices[deviceId].remoteControl;
	var guidedOld = self.devices[deviceId].guided;
	var armedOld = self.devices[deviceId].armed;

	var newMode = message.base_mode;
	self.devices[deviceId].customMode      = isSet(newMode, mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED);
	self.devices[deviceId].autonomousMode  = isSet(newMode, mavlink.MAV_MODE_FLAG_AUTO_ENABLED);
	self.devices[deviceId].testMode        = isSet(newMode, mavlink.MAV_MODE_FLAG_TEST_ENABLED);
	self.devices[deviceId].stabilizedMode  = isSet(newMode, mavlink.MAV_MODE_FLAG_STABILIZE_ENABLED);
	self.devices[deviceId].hardwareInLoop  = isSet(newMode, mavlink.MAV_MODE_FLAG_HIL_ENABLED);
	self.devices[deviceId].remoteControl   = isSet(newMode, mavlink.MAV_MODE_FLAG_MANUAL_INPUT_ENABLED);
	self.devices[deviceId].guided          = isSet(newMode, mavlink.MAV_MODE_FLAG_GUIDED_ENABLED);
	self.devices[deviceId].armed           = isSet(newMode, mavlink.MAV_MODE_FLAG_SAFETY_ARMED);

	self.devices[deviceId]._baseMode = message.base_mode;

	// fire the mode changed event as appropriate
	if(autonomousModeOld != self.devices[deviceId].autonomousMode) {
	    self.emit('autonomousModeChanged', self.id, deviceId, self.devices[deviceId].autonomousMode);
	}

	if(testModeOld != self.devices[deviceId].testMode) {
	    self.emit('testModeChanged', self.id, deviceId, self.devices[deviceId].testMode);
	}

	if(stabilizedModeOld != self.devices[deviceId].stabilizedMode) {
	    self.emit('stabilizedModeChanged', self.id, deviceId, self.devices[deviceId].stabilizedMode);
	}

	if(hardwareInLoopOld != self.devices[deviceId].hardwareInLoop) {
	    self.emit('hardwareInLoopModeChanged', self.id, deviceId, self.devices[deviceId].hardwareInLoop);
	}

	if(remoteControlOld != self.devices[deviceId].remoteControl) {
	    self.emit('remoteControlModeChanged', self.id, deviceId, self.devices[deviceId].remoteControl);
	}

	if(guidedOld != self.devices[deviceId].guided) {
	    self.emit('guidedModeChanged', self.id, deviceId, self.devices[deviceId].guided);
	}

	if(armedOld != self.devices[deviceId].armed) {
	    self.emit('armedModeChanged', self.id, deviceId, self.devices[deviceId].armed);
	}
    }

    if(self.devices[deviceId].autopilot === 'unknown' || self.devices[deviceId]._autopilot !== message.autopilot) {
	self.devices[deviceId]._autopilot = message.autopilot;

	switch(message.autopilot) {
	    case mavlink.MAV_AUTOPILOT_GENERIC:
		self.devices[deviceId].autopilot = 'Generic';
		break;
            case mavlink.MAV_AUTOPILOT_PIXHAWK:
		self.devices[deviceId].autopilot = 'PIXHAWK';
		break;
            case mavlink.MAV_AUTOPILOT_SLUGS:
		self.devices[deviceId].autopilot = 'SLUGS';
		break;
            case mavlink.MAV_AUTOPILOT_ARDUPILOTMEGA:
		self.devices[deviceId].autopilot = 'ArduPilotMega';
		break;
            case mavlink.MAV_AUTOPILOT_OPENPILOT:
		self.devices[deviceId].autopilot = 'OpenPilot';
		break;
            case mavlink.MAV_AUTOPILOT_GENERIC_WAYPOINTS_ONLY:
		self.devices[deviceId].autopilot = 'Generic waypoints only';
		break;
            case mavlink.MAV_AUTOPILOT_GENERIC_WAYPOINTS_AND_SIMPLE_NAVIGATION_ONLY:
		self.devices[deviceId].autopilot = 'Generic waypoints and simple navigation';
		break;
            case mavlink.MAV_AUTOPILOT_GENERIC_MISSION_FULL:
		self.devices[deviceId].autopilot = 'Generic autopilot and full mission command set';
		break;
            case mavlink.MAV_AUTOPILOT_INVALID:
		self.devices[deviceId].autopilot = 'No valid autopilot';
		break;
            case mavlink.MAV_AUTOPILOT_PPZ:
		self.devices[deviceId].autopilot = 'PPZ UAV';
		break;
            case mavlink.MAV_AUTOPILOT_UDB:
		self.devices[deviceId].autopilot = 'UAV Dev Board';
		break;
            case mavlink.MAV_AUTOPILOT_FP:
		self.devices[deviceId].autopilot = 'FlexiPilot';
		break;
            case mavlink.MAV_AUTOPILOT_PX4:
		self.devices[deviceId].autopilot = 'PX4 Autopilot';
		break;
            case mavlink.MAV_AUTOPILOT_SMACCMPILOT:
		self.devices[deviceId].autopilot = 'SMACCM';
		break;

	    default:
		self.devices[deviceId].autopilot = 'Unrecognised ' + message.autopilot;
		break;
	}
	self.emit('autoPilotType', self.id, deviceId, self.devices[deviceId].autopilot);
    }
    if(self.devices[deviceId].deviceType === 'unknown' || self.devices[deviceId]._deviceType !== message.deviceType) {
	self.devices[deviceId]._deviceType = message.deviceType;

	switch(message.type) {
	    case mavlink.MAV_TYPE_GENERIC:
	        self.devices[deviceId].deviceType = 'Generic micro air vehicle';
		break;
	    case mavlink.MAV_TYPE_FIXED_WING:
	        self.devices[deviceId].deviceType = 'Fixed wing aircraft';
		break;
	    case mavlink.MAV_TYPE_QUADROTOR:
		self.devices[deviceId].deviceType = 'Quadrotor';
		break;
	    case mavlink.MAV_TYPE_COAXIAL:
		self.devices[deviceId].deviceType = 'Coaxial helicopter';
		break;
	    case mavlink.MAV_TYPE_HELICOPTER:
		self.devices[deviceId].deviceType = 'Helicopter with tail rotor';
		break;
	    case mavlink.MAV_TYPE_ANTENNA_TRACKER:
		self.devices[deviceId].deviceType = 'Ground installation';
		break;
	    case mavlink.MAV_TYPE_GCS:
		self.devices[deviceId].deviceType = 'Ground control station';
		break;
	    case mavlink.MAV_TYPE_AIRSHIP:
		self.devices[deviceId].deviceType = 'Airship, controlled';
		break;
	    case mavlink.MAV_TYPE_FREE_BALLOON:
		self.devices[deviceId].deviceType = 'Free balloon, uncontrolled';
		break;
	    case mavlink.MAV_TYPE_ROCKET:
		self.devices[deviceId].deviceType = 'Rocket';
		break;
	    case mavlink.MAV_TYPE_GROUND_ROVER:
		self.devices[deviceId].deviceType = 'Ground rover';
		break;
	    case mavlink.MAV_TYPE_SURFACE_BOAT:
		self.devices[deviceId].deviceType = 'Surface vessel';
		break;
	    case mavlink.MAV_TYPE_SUBMARINE:
		self.devices[deviceId].deviceType = 'Submarine';
		break;
	    case mavlink.MAV_TYPE_HEXAROTOR:
		self.devices[deviceId].deviceType = 'Hexarotor';
		break;
	    case mavlink.MAV_TYPE_OCTOROTOR:
		self.devices[deviceId].deviceType = 'Octorotor';
		break;
	    case mavlink.MAV_TYPE_TRICOPTER:
		self.devices[deviceId].deviceType = 'Tricopter';
		break;
	    case mavlink.MAV_TYPE_FLAPPING_WING:
		self.devices[deviceId].deviceType = 'Flapping wing';
		break;
	    case mavlink.MAV_TYPE_KITE:
		self.devices[deviceId].deviceType = 'Kite';
		break;

	    default:
		self.devices[deviceId].deviceType = 'Unrecognised ' + message.type;
		break;
	}
	self.emit('deviceType', self.id, deviceId, self.devices[deviceId].deviceType);
    }

    // set the system id from the heartbeat if it is not currently set
    if(self.debugHeartbeat && self.debugLevel == 1) {
	console.log('Heartbeat');
    } else if (self.debugHeartbeat && self.debugLevel > 1) {
	var autopilot = 'unknown';

	console.log('Heartbeat  src sys:          ' + message.header.srcSystem);
	console.log('           src component:    ' + message.header.srcComponent);
	console.log('           type:             ' + self.devices[deviceId].deviceType);
	console.log('           autopilot:        ' + self.devices[deviceId].autopilot);
	console.log('           base_mode:        ' + message.base_mode);
	console.log('           autonomous mode:  ' + self.devices[deviceId].autonomousMode);
	console.log('           test mode:        ' + self.devices[deviceId].testMode);
	console.log('           stabalized mode:  ' + self.devices[deviceId].stablizedMode);
	console.log('           hardware in loop: ' + self.devices[deviceId].hardwareInLoop);
	console.log('           remote control:   ' + self.devices[deviceId].remoteControl);
	console.log('           guided:           ' + self.devices[deviceId].guided);
	console.log('           armed:            ' + self.devices[deviceId].armed);
	console.log('           custom mode:      ' + message.custom_mode);
	console.log('           system status:    ' + sysState);
	console.log('           mavlink version:  ' + message.mavlink_version);
    }

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
	    ' autopilot: ' + self.devices[deviceId].autopilot +
	    ' base_mode: ' + message.base_mode +
	    ' autonomous mode: ' + self.devices[deviceId].autonomousMode +
	    ' test mode: ' + self.devices[deviceId].testMode +
	    ' stabalized mode: ' + self.devices[deviceId].stablizedMode +
	    ' hardware in loop: ' + self.devices[deviceId].hardwareInLoop +
	    ' remote control: ' + self.devices[deviceId].remoteControl +
	    ' guided: ' + self.devices[deviceId].guided +
	    ' armed: ' + self.devices[deviceId].armed +
	    ' system status: ' + sysState);
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
	if(self.debugLevel == 0) {
	    console.log('Mission Count');
	} else if (self.debugLevel > 0) {
	    console.log('Mission Count: ' +
		' sys: ' + message.header.srcSystem +
		' component: ' + message.header.srcComponent +
		' target sys: ' + message.target_system + 
		' target component: ' + message.target_component + 
		' count: ' + message.count);
	}
    }

    var deviceId = message.header.srcSystem;

    // it not requested and we receiving waypoints then that's okay, treat it like we requested it
    // clear the timeout as we received the mission count
    clearTimeout(self.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_REQUEST_LIST_TIMEOUT_ID]);

    if(message.count > 0) {
	if(self.devices[deviceId]._waypointMode === MavlinkProtocol.WAYPOINT_NO_ACTION || 
	   self.devices[deviceId]._waypointMode === MavlinkProtocol.WAYPOINT_REQUESTED) {
	    // set to receiving waypoint
	    self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_RECEIVING;

	    self.devices[deviceId]._waypointCount = message.count;
	    self.devices[deviceId]._waypointLastSequence = -1;
	    self.devices[deviceId]._waypoints = new Array();

	    // request the first waypoint
	    self._writeWithTimeout.call(self, {
		deviceId: deviceId,
		message: new mavlink.messages.mission_request(message.header.srcSystem, message.header.srcComponent, 0),
		timeout: 10000, 
		maxAttempts: 3, 
		messageName: 'mission request', 
		attempts: 0,
		timeoutId: MavlinkProtocol._MISSION_REQUEST_TIMEOUT_ID,
		onMaxAttempts: function() { self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
	    });
	} else {
	    // something weird has happened, so lets set back to no action
	    self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;
	}
    } else {
	// no waypoints so nothing to do
        self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;

	// call the waypoint callback, passing the waypoints
	self.emit('retreivedNoWaypoints', self.id, deviceId);

    }
});

/* 
 * This message is recieved in response to a MISSION_REQUEST, this contains the mission item details.
 *
 * The next mission item can be requested, if complete then an ACK is sent.
 */
this.mavlinkParser.on('MISSION_ITEM', function(message) {

    if(self.debugWaypoints && self.debugLevel == 0) {
	console.log('Mission Item');
    } else if (self.debugWaypoints && self.debugLevel > 0) {
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

    var deviceId = message.header.srcSystem;

    // clear the timeout as we received a mission item 
    clearTimeout(self.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_REQUEST_TIMEOUT_ID]);

    switch(self.devices[deviceId]._waypointMode) {
        case MavlinkProtocol.WAYPOINT_NO_ACTION:
	    // if the first one then switch to receiving mode as it's okay to receive when not requested, otherwise ignore
            if(message.seq > 0) {
		if(self.debugWaypoints && self.debugLevel > 0) {
		    console.log("Waypoint has not been requested and sequence is larger than 0, ignoring");
		}
		break;
	    }

        case MavlinkProtocol.WAYPOINT_REQUEST:
            self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_RECEIVING;

        case MavlinkProtocol.WAYPOINT_RECEIVING:
	    if(self.devices[deviceId]._waypointLastSequence != -1 && self.devices[deviceId]._waypointLastSequence != message.seq) {
		if(self.debugWaypoints && self.debugLevel > 0) {
		    console.log("Mission item: receiving waypoint out of order, ignoring");
		}
		// received waypoint out of sequence, ignore
		break;
	    }

	    // update the last sequence processed
	    self.devices[deviceId]._waypointLastSequence = message.seq + 1;

	    // push the command onto the waypoints stack, we convert these when they're complete
	    self.devices[deviceId]._waypoints.push(message);
	    
	    if(message.seq + 1 == self.devices[deviceId]._waypointCount) {
		// we have the last waypoint 
	    
		// send an ack as the remote system will be waiting for one
		self._writeMessage.call(self, 
		    new mavlink.messages.mission_ack(
			message.header.srcSystem, 
			message.header.srcComponent, 
			mavlink.MAV_MISSION_ACCEPTED));

		// reset the mode and the waypoints
		self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;

		// convert the waypoints to videre format
		var waypoints = MavlinkCnv.waypointsMtoV(self.devices[deviceId]._waypoints);

		// call the waypoint callback, passing the waypoints
		self.emit('retreivedWaypoints', self.id, deviceId, waypoints);

		// reset waypoints
		self.devices[deviceId]._waypoints = new Array();
	    } else {
		// send requets for next waypoint, with a timeout for retries
		self._writeWithTimeout.call(self, {
		    deviceId: deviceId,
		    message: new mavlink.messages.mission_request(
			message.header.srcSystem, 
			message.header.srcComponent, 
			self.devices[deviceId]._waypointLastSequence),
		    timeout: 10000, 
		    maxAttempts: 3, 
		    messageName: 'mission request', 
		    attempts: 0,
		    timeoutId: MavlinkProtocol._MISSION_REQUEST_TIMEOUT_ID,
		    onMaxAttempts: function() { self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
		});
	    }
	    break;

	default:
	    if(self.debugWaypoints && self.debugLevel > 0) {
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
    if(self.debugWaypoints && self.debugLevel == 0) {
	console.log('Mission Request');
    } else if (self.debugWaypoints && self.debugLevel > 0) {
	console.log('Mission Request for item: ' + message.seq);
    }

    var deviceId = message.header.srcSystem;

    // clear the timeout that created the requst, if the first item
    clearTimeout(self.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_COUNT_TIMEOUT_ID]);
    clearTimeout(self.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_ITEM_TIMEOUT_ID]);

    switch(self.devices[deviceId]._waypointMode) {
        case MavlinkProtocol.WAYPOINT_NO_ACTION:
	    if(message.seq != 0) {
		if(self.debugWaypoints && self.debugLevel > 0) {
		    console.log('Mission Request for item: ' + message.seq + ' when not expecting requests, ignored');
		}
		break;
	    }

        case MavlinkProtocol.WAYPOINT_UPDATE_REQUESTED:
	    self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_SENDING;

        case MavlinkProtocol.WAYPOINT_SENDING:
	    // send the requested waypoint
	    if(message.seq > self.devices[deviceId]._waypoints.length) {
		if(self.debugWaypoints && self.debugLevel > 0) {
		    console.log('Mission Request for item: ' + message.seq + ' is larger than number of waypoints, ignored');
		}
		break;
	    }

	    // if waypoint is the current or previous waypoint, then accept
	    if(self.devices[deviceId]._waypointLastSequence + 1 === message.seq) {
		// we have the expected sequence
		self.devices[deviceId]._waypointLastSequence = message.seq;

		self._writeWithTimeout.call(self, {
		    deviceId: deviceId,
		    message: 
		    new mavlink.messages.mission_item(
			message.header.srcSystem, 
			message.header.srcComponent, 
			message.seq,
			self.devices[deviceId]._waypoints[message.seq].frame,
			self.devices[deviceId]._waypoints[message.seq].command,
			self.devices[deviceId]._waypoints[message.seq].current,
			self.devices[deviceId]._waypoints[message.seq].autocontinue,
			self.devices[deviceId]._waypoints[message.seq].param1,
			self.devices[deviceId]._waypoints[message.seq].param2,
			self.devices[deviceId]._waypoints[message.seq].param3,
			self.devices[deviceId]._waypoints[message.seq].param4,
			self.devices[deviceId]._waypoints[message.seq].x,
			self.devices[deviceId]._waypoints[message.seq].y,
			self.devices[deviceId]._waypoints[message.seq].z),
		    timeout: 10000, 
		    maxAttempts: 3, 
		    messageName: 'mission item', 
		    attempts: 0,
		    timeoutId: MavlinkProtocol._MISSION_ITEM_TIMEOUT_ID,
		    onMaxAttempts: function() { self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION }
		});
	    } else if (self.devices[deviceId]._waypointLastSequence === message.seq) {
		// we have been sent the same sequence twice, just ignore
		console.log('received same sequence, ignoring');
	    } else {
		// we are out of sequence, the received sequence is not correct, error
		// expected 0, got 1
		console.log('received incorrect sequence, sending error via ack. Expected: ' + 
		    self.devices[deviceId]._waypointLastSequence + ', got:  ' + message.seq);

		self._writeMessage.call(self, 
		    new mavlink.messages.mission_ack(
			message.header.srcSystem, 
			message.header.srcComponent, 
			mavlink.MAV_MISSION_INVALID_SEQUENCE));
	    }
	    break;

	default:
	    if (self.debugWaypoints && self.debugLevel > 0) {
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


    var deviceId = message.header.srcSystem;

    // clear timers
    clearTimeout(self.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_COUNT_TIMEOUT_ID]);
    clearTimeout(self.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_ITEM_TIMEOUT_ID]);
    clearTimeout(self.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_CLEAR_ALL]);

    if(message.type === mavlink.MAV_MISSION_ACCEPTED) {
	switch(self.devices[deviceId]._waypointMode) {
	    case MavlinkProtocol.WAYPOINT_NO_ACTION:
		if(self.debugWaypoints && self.debugLevel > 0) {
		    console.log('Mission Ack but state is no action, ignoring');
		}
		break;

	    case MavlinkProtocol.WAYPOINT_UPDATE_REQUESTED:
		if(self.debugWaypoints && self.debugLevel > 0) {
		    console.log('Mission Ack but state is update requested, reseting to no action');
		}
		self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;
		break;

	    case MavlinkProtocol.WAYPOINT_SENDING:
		// set the waypoint mode before emiting the event, incase the listener decides to initiate something else
		self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;

		if(self.devices[deviceId]._waypointLastSequence + 1 == self.devices[deviceId]._waypoints.length) {
		    if(self.debugWaypoints && self.debugLevel > 0) {
			console.log('Mission update sucessful');
		    }

		    // call the success listener
		    self.emit('setWaypointsSuccessful', self.id, deviceId);
		} else {
		    if(self.debugWaypoints && self.debugLevel > 0) {
			console.log('Mission update unsucessful, received ack before it was expected');
		    }
		}
		break;
	}
    } else {
	// an error has occurred, so no point continuing
	self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;

	// clear out the timeout just in case it was set
	clearTimeout(self.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_COUNT_TIMEOUT_ID]);

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
	self.emit('setWaypointsError', self.id, deviceId, text + "" + self._waypointSequence);

        if(self.debugWaypoints) {
	    console.log(text);
	}
    }
});

this.mavlinkParser.on('MISSION_CURRENT', function(message) {
    if(self.debugWaypoints) {
	console.log('Mission set to current: ' + message.seq);
    }

    var deviceId = message.header.srcSystem;

    if(self.devices[deviceId]._waypointMode === MavlinkProtocol.WAYPOINT_SETTING_TARGET) {
	// clear out the timeout in case is still was set
	clearTimeout(self.devices[deviceId].timeoutIds[MavlinkProtocol._MISSION_SET_TARGET_ID]);
	self.devices[deviceId]._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;
    }

    self.emit('waypointTargeted', self.id, deviceId, message.seq);

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
	    ' seq: ' + message.seq);
    }
});

this.mavlinkParser.on('MISSION_ITEM_REACHED', function(message) {
    console.log('Mission item reached ' + message.seq);

    self.emit('waypointAchieved', self.id, deviceId, message.seq);

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
	    ' seq: ' + message.seq);
    }
});

this.mavlinkParser.on('LOCAL_POSITION_NED', function(message) {
    /* 
     * The filtered local position (e.g. fused computer vision and accelerometers). 
     * Coordinate frame is right-handed, Z-axis down (aeronautical frame, NED / 
     * north-east-down convention)
     *
     * time_boot_ms   Timestamp (milliseconds since system boot)
     * x              X Position
     * y              Y Position
     * z              Z Position
     * vx             X Speed
     * vy             Y Speed
     * vz             Z Speed
     */
    if(self.debugGPS && self.debugLevel == 1) {
	console.log('Global position (int)');
    } else if (self.debugGPS && self.debugLevel > 1) {
	console.log('Global position (int)' + 
	    ' x: ' + message.x +
	    ' y: ' + message.y +
	    ' z: ' + message.z +
	    ' vx: ' + message.vx +
	    ' vy: ' + message.vy +
	    ' vz: ' + message.vz
	);
    }
    
    // note that QGroundControl treats vx as speed and vz as vsi, so will treat the same
    // suspect that NED is only used for internally tracked items that do not use GPS, requires confirmation

    self.emit('speed', self.id, message.header.srcSystem, message.vx);
    self.emit('vsi', self.id, message.header.srcSystem, message.vz);

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
	    ' x: ' + message.x +
	    ' y: ' + message.y +
	    ' z: ' + message.z +
	    ' vx: ' + message.vx +
	    ' vy: ' + message.vy +
	    ' vz: ' + message.vz);
    }
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

    // uncertain under what conditions that GLOBAL_POSITION_INT are reported, suspect it's 
    // related to a global estimator

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

    // note that QGroundControl treats vx as speed and vz as vsi, so will treat the same
    var lat = message.lat / 10000000; 
    var lng = message.lon / 10000000;

    // set the flag to state we're using global position int, so raw gps is ignored
    // According to the logic in QGroundControl, if this is reported then GPS RAW should be ignored
    self.reportingGlobalPositionInt = true;

    self._reportPosition.call(self, message.header.srcSystem, lat, lng, alt);

    self.emit('speed', self.id, message.header.srcSystem, message.vx / 100);
    self.emit('vsi', self.id, message.header.srcSystem, message.vz / 100);
    self.emit('altitude', self.id, message.header.srcSystem, message.alt / 1000);

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
	    ' lat: ' + message.lat / 10000000 + 
	    ' lng: ' + message.lon / 10000000 + 
	    ' alt: ' + message.alt / 1000 +
	    ' rel alt: ' + message.relative_alt / 1000 +
	    ' vx: ' + message.vx / 100 +
	    ' vy: ' + message.vy / 100 +
	    ' vz: ' + message.vz / 100 +
	    ' hdg: ' + message.hdg / 100);
    }
});

// this.mavlinkParser.on('STATUS_TEXT', function(message) {
this.mavlinkParser.on('STATUSTEXT', function(message) {
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
    if(self.debugStatustext && self.debugLevel == 1) {
	console.log('Status text');
    } else if (self.debugStatustext && self.debugLevel > 1) {
	console.log('Status text' + 
	    ' severity: ' + message.severity +
	    ' text: ' + message.text);
    }

    // for an unknown reason the text is null terminated, while the standard says it should be fixed length
    text = message.text.substring(0, message.text.indexOf('\u0000'));

    self.emit('statusText', self.id, message.header.srcSystem, message.severity, text);

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
	    ' severity: ' + message.severity +
	    ' text: ' + message.text);
    }
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

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
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

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
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
	    ' temperature: ' + message.temperature);
    }
});

this.mavlinkParser.on('GPS_STATUS', function(message) {
    // TODO: consider how to handle this
    
    if(self.debugGPSStatus && self.debugLevel == 1) {
        console.log('GPS Status');
    } else if (self.debugGPSStatus && self.debugLevel > 1) {
	console.log('GPS Status: ' +
	    ' sats visible: ' + message.satellites_visible);

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
	    ' battery voltage (V): ' + (message.voltage_battery / 1000) + 
	    ' current (mA): ' + (message.current_battery / 100) + 
	    ' remaining %: ' + message.battery_remaining + 
	    ' comm drop rate %: ' + message.drop_rate_comm + 
	    ' comm errors: ' + message.errors_comm);
    }

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
	    ' battery voltage (V): ' + (message.voltage_battery / 1000) + 
	    ' current (mA): ' + (message.current_battery / 100) + 
	    ' remaining %: ' + message.battery_remaining + 
	    ' comm drop rate %: ' + message.drop_rate_comm + 
	    ' comm errors: ' + message.errors_comm);
    }

    var deviceId = message.header.srcSystem;

    if(self.devices[deviceId].batteryVoltage    != message.voltage_battery / 1000 || 
	self.devices[deviceId].batteryCurrent   != message.current_battery / 100 ||
	self.devices[deviceId].batteryRemaining != message.battery_remaining) {

	self.devices[deviceId].batteryVoltage   = message.voltage_battery / 1000;
	self.devices[deviceId].batteryCurrent   = message.current_battery / 100;
	self.devices[deviceId].batteryRemaining = message.battery_remaining;

	self.emit('batteryState', self.id, deviceId,
	    self.devices[deviceId].batteryVoltage, 
	    self.devices[deviceId].batteryCurrent, 
	    self.devices[deviceId].batteryRemaining);
    }

    if(self.devices[deviceId].commDropRate != message.drop_rate_comm || self.devices[deviceId].commErrors != message.errors_comm) {

	self.devices[deviceId].commDropRate = message.drop_rate_comm;
	self.devices[deviceId].commErrors = message.errors_comm;

	self.emit('commState', self.id, deviceId, self.devices[deviceId].commDropRate, self.devices[deviceId].commErrors);
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

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
	    ' pitch: ' + message.pitch + 
	    ' roll: ' + message.roll + 
	    ' yaw: ' + message.yaw + 
	    ' pitch speed: ' + message.pitch.speed + 
	    ' rollspeed: ' + message.rollspeed + 
	    ' yaw speed: ' + message.yawspeed);
    }

    var attitude = new Attitude();
    attitude.pitch = rToP(message.pitch);
    attitude.roll = rToP(message.roll);
    attitude.yaw = rToP(message.yaw);

    attitude.x = attitude.pitch;
    attitude.y = attitude.roll;
    attitude.z = attitude.yaw;

    // report attitude change (managed by parent)
    self._reportAttitude.call(self, message.header.srcSystem, attitude);
});

this.mavlinkParser.on('VFR_HUD', function(message) {
    /* Metrics typically displayed on a HUD for fixed wing aircraft
     *
     * airspeed    Current airspeed in m/s
     * groundspeed Current ground speed in m/s
     * heading     Current heading in degrees, in compass units (0..360, 0=north)
     * throttle    Current throttle setting in integer percent, 0 to 100
     * alt         Current altitude (MSL - mean sea level), in meters
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
	    ' altitude: ' + message.alt + 
	    ' climb: ' + message.climb);
    }

    if(self.loggingIn) {
	self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
	    ' air speed: ' + message.airspeed + 
	    ' ground speed: ' + message.groundspeed + 
	    ' heading: ' + message.heading + 
	    ' throttle: ' + message.throttle + 
	    ' altitude: ' + message.alt + 
	    ' climb: ' + message.climb);
    }

    self.devices[deviceId].speed = message.airspeed;
    self.devices[deviceId].altitude = message.alt;
    self.devices[deviceId].throttle = message.throttle;
    self.devices[deviceId].heading = message.heading;
    self.devices[deviceId].vsi = message.climb;

    // only report heading if it has not been determined (via attitude processing), as per QGroundControl logic
    if(!self.headingDetermined) {
	self.emit('heading', self.id, message.header.srcSystem, message.heading);
    }

    self.emit('speed', self.id, message.header.srcSystem, message.airspeed);
    self.emit('altitude', self.id, message.header.srcSystem, message.alt);
    self.emit('throttle', self.id, message.header.srcSystem, message.throttle);
    self.emit('vsi', self.id, message.header.srcSystem, message.climb);
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
    // only report GPS Raw if not using global position int
    if(!self.reportingGlobalPositionInt) {
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

	if(self.loggingIn) {
	    self.loggerIn.info(self.id + ':' + message.header.srcSystem + ':' + message.header.srcComponent + ': ' + message.name +
		' fix type: ' + message.fix_type +
		' lat: ' + message.lat / 10000000 + 
		' lng: ' + message.lon / 10000000 + 
		' alt: ' + message.alt / 1000 + 
		' eph: ' + message.eph / 100 + 
		' epv: ' + message.epv / 100 + 
		' vel: ' + message.vel / 100 + 
		' cog: ' + message.cog);
	}

        var lat = message.lat / 10000000; 
        var lng = message.lon / 10000000;

        self.emit('speed', self.id, message.header.srcSystem, message.vel / 100);
        self.emit('altitude', self.id, message.header.srcSystem, message.alt / 1000);

        self._reportPosition.call(self, message.header.srcSystem, lat, lng);
    }
});

/* end init listeners for mavlink */

}

MavlinkProtocol.prototype.getNextSequence = function() {
    this._msgSequence++;

    if(this._msgSequence > 255) {
	this._msgSequence = 1;
    }

    return this._msgSequence;
}

MavlinkProtocol.prototype.getMavlinkId = function(vehicleId) {
    if(this.devices === undefined) {
	console.log("no device defined for vehicle: " + vehicleId);
	console.log("devices: " + JSON.stringify(this.devices, null, '  '));
	return null;
    } else {
	for(var i in this.devices) {
	    if(this.devices[i].vehicleId === vehicleId) {
		return this.devices[i].systemId;
	    }
	}
    }
}

function _Device(systemId, vehicleId, options) {
    options = options || {};

    this.systemId = systemId;
    this.vehicleId = vehicleId;

    this.attitude = new Attitude();
    this.position = new Position();

    this.positionTimer = new Date().getTime();
    this.batteryVoltage   = 0;
    this.batteryCurrent   = 0;
    this.batteryRemaining = 0;
    this.commDropRate     = 0;
    this.commErrors       = 0;

    this._msgSequence = 0;
    this._waypointMode = MavlinkProtocol.WAYPOINT_NO_ACTION;
    this._waypointCount = 0;
    this._waypointLastSequence = -1;
    this._waypointTimeoutId = null;
    this._waypointTimeoutCounter = null;
    this._baseMode = parseInt(0, 2);
    this._customMode = parseInt(0, 2);
    this._waypoints = new Array();

    this.autonomousMode  = false;
    this.testMode        = false;
    this.stabilizedMode  = false;
    this.hardwareInLoop  = false;
    this.remoteControl   = false;
    this.guided          = false;
    this.armed           = false;

    this.systemStatus     = '';
    this.systemStatusText = '';

    this._deviceType = '';
    this._autopilot = '';

    this.pitchAccuracy = ((options.pitchAccuracy != null) ? options.pitchAccuracy : 0.03);
    this.rollAccuracy = ((options.rollAccuracy != null) ? options.rollAccuracy : 0.03);
    this.yawAccuracy = ((options.yawAccuracy != null) ? options.yawAccuracy : 0.03);
    this.positionReportingMode = ((options.positionReportingMode != null) ? options.positionReportingMode : Protocol.POSITION_MODE_DISTANCE);
    this.positionReportingValue = ((options.positionReportingValue != null) ? options.positionReportingValue : 5);

    // this is set by the heartbeat message
    this.timeoutIds = [null, null];
}

_Device.prototype._getWaypointState = function() {
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

function rToP(v) {
    return v * (180/Math.PI);
}

function isSet(flag, mask) {
    if(flag & mask) {
	return true;
    } else {
	return false;
    }
}

function setFlag(flag, mask, action) {
    if(action) {
	// set to true
	if(!(flag & mask)) {
	    // we are unset, set
	    flag |= mask;
	}
    } else {
	// set to false
	if(flag & mask) {
	    // we are set, unset
	    flag ^= mask;
	}
    }

    return flag;
}


