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

MavlinkProtocol.WAYPOINT_IDLE = 0;
MavlinkProtocol.WAYPOINT_REQUEST = 1;
MavlinkProtocol.WAYPOINT_RECEIVING = 2;
MavlinkProtocol.WAYPOINT_COMPLETE = 3;

function MavlinkProtocol(options) {
    options = options || {};

    this.debug = ((options.debug != null) ? options.debug : false);

    this.connectionMethod = ((options.debug != null) ? options.connectionMethod : MavlinkProtocol.CONNECTION_SERIAL);

    this.networkAddress = ((options.networkAddress != null) ? options.networkAddress : MavlinkProtocol.LOCAL_HOST);
    this.networkPort = ((options.networkPort != null) ? options.networkPort : MavlinkProtocol.DEFAULT_PORT);

    this.serialPort = ((options.serialPort != null) ? options.serialPort : MavlinkProtocol.DEFAULT_COMPORT);
    this.serialBaud = ((options.baud != null) ? options.baud : MavlinkProtocol.DEFAULT_BAUD);

    this.vehicleState = {};

    this.telemetry = new Telemetry();
    // a negative id means that it is currently not known, it is set by the heartbeat message
    this.systemId = -1;
    this._msgSequence = 0;
    this.waypointMode = MavlinkProtocol.WAYPOINT_IDLE;
    this.waypointCount = 0;
    this.waypointLastSequence = -1;
}

MavlinkProtocol.prototype.connect = function() {
    if(this.connectionMethod === MavlinkProtocol.CONNECTION_SERIAL) {
	this._initSerialPort();
    } else {
	this._initNetwork();
    }

    this._setupMavlinkListeners();
}

MavlinkProtocol.prototype._initSerialPort = function() {
    this.serialDevice = new SerialPort(this.serialPort, {
	baudrate: this.baud
    });

    this.mavlinkParser = new MAVLink();

    this._setupMavlinkListeners();

    this.serialDevice.on("data", function (data) {
	this.mavlinkParser.parseBuffer(data);
    });
}

MavlinkProtocol.prototype._initNetwork = function() {
    this.netConnection = net.createConnection(this.networkPort, this.networkAddress);

    this.netConnection.on('data', function(data) {
	mavlinkParser.parseBuffer(data);
    });
}

MavlinkProtocol.prototype.write = function(data) {
    if(this.connectionMethod === MavlinkProtocol.CONNECTION_SERIAL) {
	serialPort.write(data);
    } else {
	// TODO: set this up

    }
}

/**
 * request the waypoints from the drone
 *
 * returns  0 if request generated
 *         -1 if the system id is unknown
 *         -2 if currently processing a request for waypoints
 */
MavlinkProtocol.prototype.requestWaypoints = function(data) {
    var request = false;

    if(this.debug > 0) {
	console.log("Requesting waypoints");
    }

    if(systemId = -1) {
	if(this.debug > 0) {
	    console.log("Cannot request waypoints as system id has not been set");
	}

	return -1;
    }

    switch(this.waypointMode) {
        case MavlinkProtocol.WAYPOINT_IDLE:
	    if(this.debug > 1) {
		console.log("requestWaypoints accepted, currently idle");
	    }
	    request = true;
	    break;

        case MavlinkProtocol.WAYPOINT_REQUEST:
	    if(this.debug > 1) {
		console.log("requestWaypoints accepted, consecutive request");
	    }
	    request = true;
	    break;

        case MavlinkProtocol.WAYPOINT_RECEIVING:
	    if(this.debug > 1) {
		console.log("requestWaypoints rejected, currently receiving waypoints");
	    }
	    request = false;
	    break;

	// TODO: this seems redundant
        case MavlinkProtocol.WAYPOINT_COMPLETE:
	    if(this.debug > 1) {
		console.log("requestWaypoints accepted, currently in complete mode");
	    }
	    request = true;
	    break;
    }

    if(request) {
	// set mode to request mode
        this.waypointMode = MavlinkProtocol.WAYPOINT_REQUEST;
	
	// clear current waypoints
	
	// request the waypoints
        this._writeMessage(new mavlink.messages.mission_request_list(systemId, 50));
    } else {
	if(this.debug > 0) {
	    console.log("Cannot request waypoints as currently receiving waypoints");
	}

	return -2;
    }

    return 0;
}

MavlinkProtocol.prototype._setupMavlinkListeners = function() {

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
    if (this.debug > 2) {
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
    
    if(this.debug == 1) {
	console.log('Ping');
    } else if (this.debug > 1) {
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

    /* 
     * MAV Types:
     *
     *  0 Generic micro air vehicle.
     *  1 Fixed wing aircraft.
     *  2 Quadrotor
     *  3 Coaxial helicopter
     *  4 Normal helicopter with tail rotor.
     *  5 Ground installation
     *  6 Operator control unit / ground control station
     *  7 Airship, controlled
     *  8 Free balloon, uncontrolled
     *  9 Rocket
     * 10 Ground rover
     * 11 Surface vessel, boat, ship
     * 12 Submarine
     * 13 Hexarotor
     * 14 Octorotor
     * 15 Octorotor
     * 16 Flapping wing
     * 17 Flapping wing
     */

    /*
     * Autopilot values:
     *
     *  0 Generic autopilot, full support for everything
     *  1 PIXHAWK autopilot, http://pixhawk.ethz.ch
     *  2 SLUGS autopilot, http://slugsuav.soe.ucsc.edu
     *  3 ArduPilotMega / ArduCopter, http://diydrones.com
     *  4 OpenPilot, http://openpilot.org
     *  5 Generic autopilot only supporting simple waypoints
     *  6 Generic autopilot supporting waypoints and other simple navigation commands
     *  7 Generic autopilot supporting the full mission command set
     *  8 No valid autopilot, e.g. a GCS or other MAVLink component
     *  9 PPZ UAV - http://nongnu.org/paparazzi
     * 10 UAV Dev Board
     * 11 FlexiPilot
     * 12 PX4 Autopilot - http://pixhawk.ethz.ch/px4/
     * 13 SMACCMPilot - http://smaccmpilot.org
     */

    /*
     * System status
     *
     * 0 Uninitialized system, state is unknown.
     * 1 System is booting up.
     * 2 System is calibrating and not flight-ready.
     * 3 System is grounded and on standby. It can be launched any time.
     * 4 System is active and might be already airborne. Motors are engaged.
     * 5 System is in a non-normal flight mode. It can however still navigate.
     * 6 System is in a non-normal flight mode. It lost control over parts or 
     *   over the whole airframe. It is in mayday and going down.
     * 7 System just initialized its power-down sequence, will shut down now.
     */
    if(this.debug == 1) {
	console.log('Heartbeat');
    } else if (this.debug > 1) {
	console.log('Heartbeat: ' +
	    ' type: ' + message.type + 
	    ' autopilot: ' + message.autopilot + 
	    ' base_mode: ' + message.base_mode + 
	    ' custom_mode: ' + message.custom_mode + 
	    ' system_status: ' + message.system_status + 
	    ' mavlink_version: ' + message.mavlink_version
	);
    }

    var armed = message.base_mode & MavlinkProtocol.BASE_MODE_ARMED != 0 ? true : false;

    if(this.telemetry.armed != armed) {
	this.telemetry.armed = armed;
	this.telemetry.dirty = true;
    }
    /*
MavlinkProtocol.BASE_MODE_ARMED
MavlinkProtocol.BASE_MODE_REMOTE_CONTROL_ENABLED
MavlinkProtocol.BASE_MODE_HARDWARE_IN_LOOP
MavlinkProtocol.BASE_MODE_SYSTEM_STABILIZED
MavlinkProtocol.BASE_MODE_GUIDED_MODE
MavlinkProtocol.BASE_MODE_AUTONOMOUS_MODE
MavlinkProtocol.BASE_MODE_TEST_MODE
MavlinkProtocol.BASE_MODE_RESERVED
    */
    this.vehicleState = _.extend(this.vehicleState, {
	type: message.type,
	autopilot: message.autopilot,
	base_mode: message.base_mode,
	custom_mode: message.custom_mode,
	system_status: message.system_status,
	mavlink_version: message.mavlink_version
    });
});

/*
MavlinkProtocol.WAYPOINT_IDLE = 0;
MavlinkProtocol.WAYPOINT_REQUEST = 1;
MavlinkProtocol.WAYPOINT_RECEIVING = 2;
MavlinkProtocol.WAYPOINT_COMPLETE = 3;
* JGJ
*/


/* waypoint management */
this.mavlinkParser.on('MISSION_COUNT', function(message) {
    /*
     * This message is emitted as response to MISSION_REQUEST_LIST by the MAV and to initiate a write transaction. 
     * The GCS can then request the individual mission item based on the knowledge of the total number of MISSIONs.
     */
    if(DEBUG_MISSION_COUNT) {
	if(DEBUG == 1) {
	    console.log('Mission Count');
	} else if (DEBUG > 1) {
	    console.log('Mission Count: ' +
		' sys: ' + message.header.srcSystem +
		' component: ' + message.header.srcComponent +
		' target sys: ' + message.target_system + 
		' target component: ' + message.target_component + 
		' count: ' + message.count);
	    console.log(JSON.stringify(message));
	}
    }

    if(this.waypointMode === MavlinkProtocol.WAYPOINT_IDLE || 
       this.waypointMode === MavlinkProtocol.WAYPOINT_REQUEST || 
       this.waypointMode === MavlinkProtocol.WAYPOINT_COMPLETE) {
	// set to receiving waypoint
	this.waypointMode = MavlinkProtocol.WAYPOINT_RECEIVING;

	this.waypointCount = message.count;
	this.waypointLastSequence = -1;

	// send message
	if(this.debug > 1) {
	    console.log("requesting first waypoint");
	}
	this._writeMessage(new mavlink.messages.mission_request(message.header.srcSystem, message.header.srcComponent, 0));
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

    if(DEBUG_MISSION_ITEM) {
	if(DEBUG == 1) {
	    console.log('Mission Item');
	} else if (DEBUG > 1) {
	    console.log('Mission Item: ' +
		' sys: ' + message.header.srcSystem +
		' component: ' + message.header.srcComponent +
		' target sys: ' + message.target_system + 
		' target component: ' + message.target_component + 
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
    }

    switch(this.waypointMode) {
        case MavlinkProtocol.WAYPOINT_IDLE:
	    // if the first one, then switch to receiving mode
            if(message.current > 0) {
		break;
	    }

        case MavlinkProtocol.WAYPOINT_REQUEST:
            this.waypointMode = MavlinkProtocol.WAYPOINT_RECEIVING;

        case MavlinkProtocol.WAYPOINT_RECEIVING:
	    if(waypointLastSequence != -1 && waypointLastSequence + 1 != message.current) {
		// received waypoint out of sequence
		break;
	    }
	    this.waypointLastSequence = message.current;
	    
	    // TODO: save the waypoint
	    
	    // send message
	    if(this.debug > 1) {
		console.log("requesting waypoint " + (this.waypointLastSequence + 1));
	    }
	    this._writeMessage(new mavlink.messages.mission_request(
		message.header.srcSystem, 
		message.header.srcComponent, 
		this.waypointLastSequence + 1));

	// error?? ignore
        case MavlinkProtocol.WAYPOINT_COMPLETE:
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
    if(this.debug == 1) {
	console.log('Global position (int)');
    } else if (this.debug > 1) {
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
    if(this.telemetry.armed != armed) {
    }

    this.vehicleState = _.extend(this.vehicleState, {
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
    if(this.debug == 1) {
	console.log('Status text');
    } else if (this.debug > 1) {
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
    if(this.debug == 1) {
	console.log('Param Value');
    } else if (this.debug > 1) {
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
    if(this.debug == 1) {
        console.log('High res IMU');
    } else if (this.debug > 1) {
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

    this.vehicleState = _.extend(this.vehicleState, {
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
    this.vehicleState = _.extend(this.vehicleState, {
	satellites_visible: message.satellites_visible,
	satellite_prn: new Uint8Array(message.satellite_prn),
	satellite_used: new Uint8Array(message.satellite_used),
	satellite_elevation: new Uint8Array(message.satellite_elevation),
	satellite_azimuth: new Uint8Array(message.satellite_azimuth),
	satellite_snr: new Uint8Array(message.satellite_snr)
    });
    
    if(this.debug == 1) {
        console.log('GPS Status');
    } else if (this.debug > 1) {
	console.log('GPS Status: ' +
	    ' sats visible: ' + this.vehicleState.satellites_visible);

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
    if(this.debug == 1) {
	console.log('Sys Status');
    } else if (this.debug > 1) {
	console.log('Sys Status:' +
	    ' battery voltage (millivolts): ' + message.voltage_battery + 
	    ' current (10 millamperes): ' + message.current_battery + 
	    ' remaining %: ' + message.battery_remaining + 
	    ' comm drop rate %: ' + message.drop_rate_comm + 
	    ' comm errors: ' + message.errors_com);
    }

    this.vehicleState = _.extend(this.vehicleState, {
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
    if(this.debug == 1) {
	console.log('Attitude');
    } else if (this.debug > 1) {
	console.log('Attitude:' + 
	    ' pitch: ' + message.pitch + 
	    ' roll: ' + message.roll + 
	    ' yaw: ' + message.yaw + 
	    ' pitch speed: ' + message.pitch.speed + 
	    ' rollspeed: ' + message.rollspeed + 
	    ' yaw speed: ' + message.yawspeed);
    }

    this.vehicleState = _.extend(this.vehicleState, {
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
    if(this.debug == 1) {
	console.log('VFR HUD');
    } else if (this.debug > 1) {
	console.log('VFR HUD:' + 
	    ' air speed: ' + message.airspeed + 
	    ' ground speed: ' + message.groundspeed + 
	    ' heading: ' + message.heading + 
	    ' throttle: ' + message.throttle + 
	    ' climb: ' + message.climb);
    }

    this.vehicleState = _.extend(this.vehicleState, {
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
    if(this.debug == 1) {
	console.log('GPS Raw (int)');
    } else if (this.debug > 1) {
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

    this.vehicleState = _.extend(this.vehicleState, {
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

}

MavlinkProtocol.prototype._writeMessage = function(request) {
    _.extend(request, {
	srcSystem: 255,
	srcComponent: 0,
	// seq: getNextSequence()
    });

    p = new Buffer(request.pack());
    console.log("sending message " + p);
    this.serialPort.write(p);
};

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

