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
var mavlink = require('../implementations/mavlink_common_v1.0');
var net = require('net');

var Attitude        = require('../videre-common/js/attitude');
var Point           = require('../videre-common/js/point');
var Position        = require('../videre-common/js/position');
var Telemetry       = require('../videre-common/js/telemetry');

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

MavlinkProtocol.WAYPOINT_NOT_REQUESTED = 0;
MavlinkProtocol.WAYPOINT_REQUESTED = 1;
MavlinkProtocol.WAYPOINT_RECEIVING = 2;

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
    console.log("MavlinkProtocol(options)");
    options = options || {};

    this.debug = ((options.debug != null) ? options.debug : false);
    this.debugAttitude = ((options.debugAttitude != null) ? options.debugAttitude : false);
    this.debugSysStatus = ((options.debugSysStatus != null) ? options.debugSysStatus : false);
    this.debugWaypoints = ((options.debugWaypoints != null) ? options.debugWaypoints : false);
    this.debugHeartbeat = ((options.debugHeartbeat != null) ? options.debugHeartbeat : false);
    this.debugIMU = ((options.debugIMU != null) ? options.debugIMU : false);
    this.debugGPS = ((options.debugGPS != null) ? options.debugGPS : false);
    this.debugGPSRaw = ((options.debugGPSRaw != null) ? options.debugGPSRaw : false);
    this.debugGPSStatus = ((options.debugGPSStatus != null) ? options.debugGPSStatus : false);
    this.debugLevel = ((options.debugLevel != null) ? options.debugLevel : 0);

    this.connectionMethod = ((options.connectionMethod != null) ? options.connectionMethod : MavlinkProtocol.CONNECTION_SERIAL);

    this.networkAddress = ((options.networkAddress != null) ? options.networkAddress : MavlinkProtocol.LOCAL_HOST);
    this.networkPort = ((options.networkPort != null) ? options.networkPort : MavlinkProtocol.DEFAULT_PORT);

    this.serialPort = ((options.serialPort != null) ? options.serialPort : MavlinkProtocol.DEFAULT_COMPORT);
    this.serialBaud = ((options.baud != null) ? options.baud : MavlinkProtocol.DEFAULT_BAUD);

    this.stateChangedListener = ((options.stateChangedListener != null) ? options.stateChangedListener : function(){});
    this.modeChangedListener = ((options.modeChangedListener != null) ? options.modeChangedListener : function(){});
    this.retreivedWaypointsListener = ((options.retreivedWaypointsListener != null) ? options.retreivedWaypointsListener : function(){});

    this.vehicleState = {};

    this.telemetry = new Telemetry();
    // a negative id means that it is currently not known, it is set by the heartbeat message
    this.systemId = -1;
    this.systemStatus = -1;
    this._msgSequence = 0;
    this._waypointMode = MavlinkProtocol.WAYPOINT_NOT_REQUESTED;
    this._waypointCount = 0;
    this._waypointLastSequence = -1;
    this._baseMode = null;
    this._waypoints = new Array();
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

MavlinkProtocol.prototype._initSerialPort = function() {
    if(this.debug && this.debugLevel > 0) {
	console.log("Connecting to serial port " + this.serialPort + " baud: " + this.serialBaud);
    }

    this.serialDevice = new SerialPort(this.serialPort, {
	baudrate: this.serialBaud
    });

    this.mavlinkParser = new MAVLink();

    this._setupMavlinkListeners();

    var that = this;

    this.serialDevice.on("data", function (data) {
	if(that.debug && that.debugLevel > 9) {
	    console.log("Serial port, received data: " + data);
	}
	that.mavlinkParser.parseBuffer(data);
    });
}

function processData(data, mavlinkParser) {
    mavlinkParser.parseBuffer(data);
}

MavlinkProtocol.prototype._initNetwork = function() {
    this.netConnection = net.createConnection(this.networkPort, this.networkAddress);

    this.mavlinkParser = new MAVLink();

    this._setupMavlinkListeners();

    var that = this;

    this.netConnection.on('data', function(data) {
	that.mavlinkParser.parseBuffer(data);
    });
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
 * request the waypoints from the drone
 *
 * returns  0 if request generated
 *         -1 if the system id is unknown
 *         -2 if currently processing a request for waypoints
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

    switch(this._waypointMode) {
        case MavlinkProtocol.WAYPOINT_NOT_REQUESTED:
	    request = true;
	    break;

        case MavlinkProtocol.WAYPOINT_REQUESTED:
	    request = true;
	    break;

        case MavlinkProtocol.WAYPOINT_RECEIVING:
	    if(this.debugWaypoints && this.debugLevel > 1) {
		console.log("requestWaypoints rejected, currently receiving waypoints");
	    }
	    request = false;
	    break;
    }

    if(request) {
	// set mode to request mode
        this._waypointMode = MavlinkProtocol.WAYPOINT_REQUESTED;
	
	// request the waypoints
        this._writeMessage(new mavlink.messages.mission_request_list(this.systemId, 50));
    } else {
	if(this.debugWaypoints) {
	    console.log("Cannot request waypoints as currently receiving waypoints");
	}

	return -2;
    }

    return 0;
}

MavlinkProtocol.prototype._setupMavlinkListeners = function() {

    var that = this;
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
    if (that.debug && that.debugLevel > 9) {
	console.log(message.name + ' <- received message');
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
    
    if(that.debug && that.debugLevel == 1) {
	console.log('Ping');
    } else if (that.debug && that.debugLevel > 1) {
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
    if(that.systemId === -1) {
	that.systemId = message.header.srcSystem;
	that.systemMavlinkVersion = message.mavlink_version;
	that.systemType = message.type;
    }

    // if the system status has changed then update it
    if(that.systemStatus != message.system_status) {
	that.systemStatus = message.system_status

	switch(message.system_status) {
	    case mavlink.MAV_STATE_UNINIT:
		that.systemStatusText = 'Uninitialized';
		break;
	    case mavlink.MAV_STATE_BOOT:
		that.systemStatusText = 'Booting';
		break;
	    case mavlink.MAV_STATE_CALIBRATING:
		that.systemStatusText = 'Calibrating';
		break;
	    case mavlink.MAV_STATE_STANDBY:
		that.systemStatusText = 'Standby';
		break;
	    case mavlink.MAV_STATE_ACTIVE:
		that.systemStatusText = 'Active';
		break;
	    case mavlink.MAV_STATE_CRITICAL:
		that.systemStatusText = 'Critical';
		break;
	    case mavlink.MAV_STATE_EMERGENCY:
		that.systemStatusText = 'Emergency / Mayday';
		break;
            case mavlink.MAV_STATE_POWEROFF:
		that.systemStatusText = 'Shuting down';
		break;
	}

	// call the state changed callback
	that.stateChangedListener(that.systemStatus, that.systemStatusText);
    }
       
    // if the base mode has changed then update it
    if(that._baseMode != message.base_mode) {
	that.autonomousMode = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_AUTO_ENABLED != 0 ? true : false;
	that.testMode       = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_TEST_ENABLED != 0 ? true : false;
	that.stablizedMode  = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_STABILIZE_ENABLED != 0 ? true : false;
	that.hardwareInLoop = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_HIL_ENABLED != 0 ? true : false;
	that.remoteControl  = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_MANUAL_INPUT_ENABLED != 0 ? true : false;
	that.guided         = message.base_mode & MavlinkProtocol.MAV_MODE_FLAG_GUIDED_ENABLED != 0 ? true : false;
	that.armed          = message.base_mode & MavlinkProtocol.BASE_MODE_ARMED != 0 ? true : false;

	that._baseMode = message.base_mode;

	// call the state changed callback
	that.modeChangedListener();
    }

    /*
    that.vehicleState = _.extend(that.vehicleState, {
	type: message.type,
	autopilot: message.autopilot,
	base_mode: message.base_mode,
	custom_mode: message.custom_mode,
	system_status: message.system_status,
	mavlink_version: message.mavlink_version
    });
    */

    // set the system id from the heartbeat if it is not currently set
    if(that.debugHeartbeat && that.debugLevel == 1) {
	console.log('Heartbeat');
    } else if (that.debugHeartbeat && that.debugLevel > 1) {
	console.log('Heartbeat, figuring out details...');
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
	console.log('           autonomous mode:  ' + that.autonomousMode);
	console.log('           test mode:        ' + that.testMode);
	console.log('           stabalized mode:  ' + that.stablizedMode);
	console.log('           hardware in loop: ' + that.hardwareInLoop);
	console.log('           remote control:   ' + that.remoteControl);
	console.log('           guided:           ' + that.guided);
	console.log('           armed:            ' + that.armed);
	console.log('           custom mode:      ' + message.custom_mode);
	console.log('           system status:    ' + sysState);
	console.log('           mavlink version:  ' + message.mavlink_version);
    }
});

/* waypoint management */
this.mavlinkParser.on('MISSION_COUNT', function(message) {
    /*
     * This message is emitted as response to MISSION_REQUEST_LIST by the MAV and to initiate a write transaction. 
     * The GCS can then request the individual mission item based on the knowledge of the total number of MISSIONs.
     */
    if(that.debugWaypoints) {
	if(that.debugLevel == 1) {
	    console.log('Mission Count');
	} else if (that.debugLevel > 1) {
	    console.log('Mission Count: ' +
		' sys: ' + message.header.srcSystem +
		' component: ' + message.header.srcComponent +
		' target sys: ' + message.target_system + 
		' target component: ' + message.target_component + 
		' count: ' + message.count);
	}
    }

    // it not requested and we receiving waypoints then that's okay, treat it like we requested it
    if(that._waypointMode === MavlinkProtocol.WAYPOINT_NOT_REQUESTED || 
       that._waypointMode === MavlinkProtocol.WAYPOINT_REQUESTED) {
	// set to receiving waypoint
	that._waypointMode = MavlinkProtocol.WAYPOINT_RECEIVING;

	that._waypointCount = message.count;
	that._waypointLastSequence = -1;
	that._waypoints = new Array();

	// request the first waypoint
	that._writeMessage.call(that, new mavlink.messages.mission_request(message.header.srcSystem, message.header.srcComponent, 0));
    }
});

this.mavlinkParser.on('MISSION_ITEM', function(message) {
    /* 
     * Message encoding a mission item. This message is emitted to announce the presence of a mission item and to 
     * set a mission item on the system. The mission item can be either in x, y, z meters (type: LOCAL) or x:lat, 
     * y:lon, z:altitude. Local frame is Z-down, right handed (NED), global frame is Z-up, right handed (ENU). 
     * See also http://qgroundcontrol.org/mavlink/waypoint_protocol.
     *
     *
     * contents:
     *   target_system    System ID
     *   target_component Component ID
     *   seq              Sequence
     *   frame            The coordinate system of the MISSION. see MAV_FRAME in mavlink_types.h
     *   command          The scheduled action for the MISSION. see MAV_CMD in common.xml MAVLink specs
     *   current          false:0, true:1
     *   autocontinue     auto-continue to next wp
     *   param1           PARAM1 / For NAV command MISSIONs: Radius in which the MISSION is accepted as reached, 
     *                    in meters
     *   param2           PARAM2 / For NAV command MISSIONs: Time that the MAV should stay inside the PARAM1 
     *                    radius before advancing, in milliseconds
     *   param3           PARAM3 / For LOITER command MISSIONs: Orbit to circle around the MISSION, in meters. 
     *                    If positive the orbit direction should be clockwise, if negative the orbit direction 
     *                    should be counter-clockwise.
     *   param4           PARAM4 / For NAV and LOITER command MISSIONs: Yaw orientation in degrees, [0..360] 0 = NORTH
     *   x                PARAM5 / local: x position, global: latitude
     *   y                PARAM6 / y position: global: longitude
     *   z                PARAM7 / z position: global: altitude
     */
    /*
     * MAV_FRAME definition:
     *
     *   0    MAV_FRAME_GLOBAL              Global coordinate frame, WGS84 coordinate system. First value / x: latitude, 
     *                                      second value / y: longitude, third value / z: positive altitude over mean sea 
     *                                      level (MSL)
     *   1    MAV_FRAME_LOCAL_NED           Local coordinate frame, Z-up (x: north, y: east, z: down).
     *   2    MAV_FRAME_MISSION             NOT a coordinate frame, indicates a mission command.
     *   3    MAV_FRAME_GLOBAL_RELATIVE_ALT Global coordinate frame, WGS84 coordinate system, relative altitude 
     *                                      over ground with respect to the home position. First value / x: latitude, 
     *                                      second value / y: longitude, third value / z: positive altitude with 0 being 
     *                                      at the altitude of the home location.
     *   4    MAV_FRAME_LOCAL_ENU           Local coordinate frame, Z-down (x: east, y: north, z: up)
     */
    /*
     * MAV_CMD summary:
     *
     * Commands to be executed by the MAV. They can be executed on user request, or as part of a mission script. 
     * If the action is used in a mission, the parameter mapping to the waypoint/mission message is as follows: 
     * Param 1, Param 2, Param 3, Param 4, X: Param 5, Y:Param 6, Z:Param 7. This command list is similar what 
     * ARINC 424 is for commercial aircraft: A data format how to interpret waypoint/mission data.
     */

    if(that.debugWaypoints && that.debugLevel == 1) {
	console.log('Mission Item');
    } else if (that.debugWaypoints && that.debugLevel > 1) {
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

    switch(that._waypointMode) {
        case MavlinkProtocol.WAYPOINT_NOT_REQUESTED:
	    // if the first one then switch to receiving mode as it's okay to receive when not requested, otherwise ignore
            if(message.seq > 0) {
		if(that.debugWaypoints && that.debugLevel > 1) {
		    console.log("Waypoint has not been requested and sequence is larger than 0, ignoring");
		}
		break;
	    }

        case MavlinkProtocol.WAYPOINT_REQUEST:
            that._waypointMode = MavlinkProtocol.WAYPOINT_RECEIVING;

        case MavlinkProtocol.WAYPOINT_RECEIVING:
	    if(that._waypointLastSequence != -1 && that._waypointLastSequence != message.seq) {
		if(that.debugWaypoints && that.debugLevel > 1) {
		    console.log("Mission item: receiving waypoint out of order, ignoring");
		}
		// received waypoint out of sequence, ignore
		break;
	    }

	    // update the last sequence processed
	    that._waypointLastSequence = message.seq + 1;

	    var loiter = false;
	    
	    // TODO: if we receive a MAV_CMD_NAV_LAST then we should ignore as it's just a holder,
	    // it may be that it is used internally and not actually communicated between systems
	    
	    // TODO: extend support beyond the nav commands listed below
	    
	    // convert the waypoint to a point
	    var point = new Point(message.x, message.y, {
		sequence: message.seq,
		current: message.current === 1 ? true : false,
		altitude: message.z,
		isHome: false,
		loiter: false,
		loiterTime: 0,
		loiterRadius: 0,
		returnHome: false,
		terminus: false,
	    });

	    switch(message.command) {
	        case mavlink.MAV_CMD_NAV_RETURN_TO_LAUNCH:
		    point.returnHome = true;
		    break;

	        case mavlink.MAV_CMD_NAV_TAKEOFF:
		    point.start = true;
		    point.pitch = message.param1;
		    point.yaw = message.param4;
		    break;

	        case mavlink.MAV_CMD_NAV_LAND:
		    point.yaw = message.param4;
		    point.terminus = true;
		    point.stop = true;
		    break;

	        case mavlink.MAV_CMD_NAV_LOITER_TIME:
		    point.loiter = true;
		    point.loiterTime = message.param1;
		    point.loiterRadius = message.param3;
		    point.yaw = message.param4;
		    break;

		case mavlink.MAV_CMD_NAV_LOITER_TURNS:
		    point.loiter = true;
		    point.loiterLaps = message.param1;
		    point.loiterRadius = message.param3;
		    point.yaw = message.param4;
		    break;

		case mavlink.MAV_CMD_NAV_LOITER_UNLIM:
		    point.loiter = true;
		    point.loiterRadius = message.param3;
		    point.autoContinue = false;
		    point.yaw = message.param4;
		    break;

		case mavlink.MAV_CMD_NAV_WAYPOINT:
		    point.loiter = message.param1 != 0 || message.param3 != 0 ? true : false;
                    point.loiterTime = message.param1;
                    point.loiterRadius = message.param3;
		    point.accuracy = message.param2;
		    point.yaw = message.param4;
		    break;
	    }

	    that._waypoints.push(point);
	    
	    if(message.seq + 1 == that._waypointCount) {
		// we have the last waypoint 
	    
		// QMissionControl sends an ack as a 0 id message back after all waypoints received,
		// this is odd as the msg 0 is the heartbeat, so uncertain why it is doing this
	    
		// call the waypoint callback, passing the waypoints
		that.retreivedWaypointsListener(that._waypoints);
		// reset the mode and the waypoints
		that._waypointMode = MavlinkProtocol.WAYPOINT_NOT_REQUESTED;
		that.waypoints = new Array();
	    } else {
		// send requets for next waypoint
		that._writeMessage.call(that, 
		    new mavlink.messages.mission_request(
		    message.header.srcSystem, 
		    message.header.srcComponent, 
		    that._waypointLastSequence));
	    }
	    break;

	default:
	    if(that.debugWaypoints && that.debugLevel > 1) {
		console.log("Mission item: waypoint state unknown, ignoring");
	    }
	    break;
    }
});

this.mavlinkParser.on('MISSION_ITEM_REACHED', function(message) {
    console.log('Mission item reached ' + message.seq);
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
    if(that.debugGPS && that.debugLevel == 1) {
	console.log('Global position (int)');
    } else if (that.debugGPS && that.debugLevel > 1) {
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

    var lat = message.lat/10000000;

    // should we have a configurable tollerance based on the accuracy of the GPS?
    if(that.telemetry.armed != armed) {
    }

    that.vehicleState = _.extend(that.vehicleState, {
	lat: message.lat/10000000,
	lon: message.lon/10000000,
	alt: message.alt/1000,
	relative_alt: message.relative_alt/1000,
	vx: message.vx/100,
	vy: message.vy/100,
	vz: message.vz/100,
	hdg: message.hdg/100
    });
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
    if(that.debug && that.debugLevel == 1) {
	console.log('Status text');
    } else if (that.debug && that.debugLevel > 1) {
	console.log('Status text' + 
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
    if(that.debug && that.debugLevel == 1) {
	console.log('Param Value');
    } else if (that.debug && that.debugLevel > 1) {
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
    if(that.debugIMU && that.debugLevel == 1) {
        console.log('High res IMU');
    } else if (that.debugIMU && that.debugLevel > 1) {
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

    that.vehicleState = _.extend(that.vehicleState, {
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
});

this.mavlinkParser.on('GPS_STATUS', function(message) {
    // TODO: consider how to handle this
    that.vehicleState = _.extend(that.vehicleState, {
	satellites_visible: message.satellites_visible,
	satellite_prn: new Uint8Array(message.satellite_prn),
	satellite_used: new Uint8Array(message.satellite_used),
	satellite_elevation: new Uint8Array(message.satellite_elevation),
	satellite_azimuth: new Uint8Array(message.satellite_azimuth),
	satellite_snr: new Uint8Array(message.satellite_snr)
    });
    
    if(that.debugGPSStatus && that.debugLevel == 1) {
        console.log('GPS Status');
    } else if (that.debugGPSStatus && that.debugLevel > 1) {
	console.log('GPS Status: ' +
	    ' sats visible: ' + that.vehicleState.satellites_visible);

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
    if(that.debugSysStatus && that.debugLevel == 1) {
	console.log('Sys Status');
    } else if (that.debugSysStatus && that.debugLevel > 1) {
	console.log('Sys Status:' +
	    ' battery voltage (millivolts): ' + message.voltage_battery + 
	    ' current (10 millamperes): ' + message.current_battery + 
	    ' remaining %: ' + message.battery_remaining + 
	    ' comm drop rate %: ' + message.drop_rate_comm + 
	    ' comm errors: ' + message.errors_com);
    }

    that.vehicleState = _.extend(that.vehicleState, {
	voltage_battery: message.voltage_battery,
	current_battery: message.current_battery,
	battery_remaining: message.battery_remaining,
	drop_rate_comm: message.drop_rate_comm,
	errors_comm: message.errors_comm
    });
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
    if(that.debugAttitude && that.debugLevel == 1) {
	console.log('Attitude');
    } else if (that.debugAttitude && that.debugLevel > 1) {
	console.log('Attitude:' + 
	    ' pitch: ' + message.pitch + 
	    ' roll: ' + message.roll + 
	    ' yaw: ' + message.yaw + 
	    ' pitch speed: ' + message.pitch.speed + 
	    ' rollspeed: ' + message.rollspeed + 
	    ' yaw speed: ' + message.yawspeed);
    }

    that.vehicleState = _.extend(that.vehicleState, {
	pitch: message.pitch,
	roll: message.roll,
	yaw: message.yaw,
	pitchspeed: message.pitchspeed,
	rollspeed: message.rollspeed,
	yawspeed: message.yawspeed
    });
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
    if(that.debug && that.debugLevel == 1) {
	console.log('VFR HUD');
    } else if (that.debug && that.debugLevel > 1) {
	console.log('VFR HUD:' + 
	    ' air speed: ' + message.airspeed + 
	    ' ground speed: ' + message.groundspeed + 
	    ' heading: ' + message.heading + 
	    ' throttle: ' + message.throttle + 
	    ' climb: ' + message.climb);
    }

    that.vehicleState = _.extend(that.vehicleState, {
	airspeed: message.airspeed,
	groundspeed: message.groundspeed,
	heading: message.heading,
	throttle: message.throttle,
	climb: message.climb
    });
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
    if(that.debugGPSRaw && that.debugLevel == 1) {
	console.log('GPS Raw (int)');
    } else if (that.debugGPSRaw && that.debugLevel > 1) {
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

    that.vehicleState = _.extend(that.vehicleState, {
	fix_type: message.fix_type,
	satellites_visible: message.satellites_visible,
	lat: message.lat / 10000000,
	lon: message.lon / 10000000,
	alt: message.alt / 1000,
	eph: message.eph,
	epv: message.epv,
	vel: message.vel,
	cog: message.cog
    });
});

/* end init listeners for mavlink */

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

