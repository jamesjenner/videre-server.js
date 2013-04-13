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

var COMPORT = "/dev/ttyUSB0";
var BAUD = 57600;

var DEBUG = 2;
/*
connection = net.createConnection(5760, '127.0.0.1');
connection.on('data', function(data) {
            mavlink.parseBuffer(data);
});
*/

var mavlinkParser = new MAVLink();

var serialPort = new SerialPort(COMPORT, {
	baudrate: BAUD
});

// serialPort.write(message.buffer);

serialPort.on("data", function (data) {
    mavlinkParser.parseBuffer(data);
});

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

mavlinkParser.on('message', function(message) {
    console.log(message.name + ' <- received message');
});

mavlinkParser.on('PING', function(message) {
    /*
    time_usec  Unix timestamp in microseconds
    seq  PING sequence
    target_systemu    0: request ping from all receiving systems, 
                      if greater than 0: message is a ping response and number is the system id of the requesting system
    target_component  0: request ping from all receiving components, 
                      if greater than 0: message is a ping response and number is the system id of the requesting system
    */
    
    console.log('Ping' + 
	' time_usec: ' + message.time_usec + 
	' seq: ' + message.seq +
	' target_system: ' + message.target_system +
	' target_component: ' + message.target_component);
});

mavlinkParser.on('HEARTBEAT', function(message) {
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
     * Base Mode
     *
     * 128 0b10000000 MAV safety set to armed. Motors are enabled / running / can start. Ready to fly.
     *  64 0b01000000 remote control input is enabled.
     *  32 0b00100000 hardware in the loop simulation. All motors / actuators are blocked, but 
     *                internal software is full operational.
     *  16 0b00010000 system stabilizes electronically its attitude (and optionally position). 
     *                It needs however further control inputs to move around.
     *   8 0b00001000 guided mode enabled, system flies MISSIONs / mission items.
     *   4 0b00000100 autonomous mode enabled, system finds its own goal positions. 
     *                Guided flag can be set or not, depends on the actual implementation.
     *   2 0b00000010 system has a test mode enabled. This flag is intended for temporary 
     *                system tests and should not be used for stable implementations.
     *   1 0b00000001 Reserved for future use.
     */

    /*
    * System status
    *
    * 0 Uninitialized system, state is unknown.
    *   System is booting up.
    *   System is calibrating and not flight-ready.
    *   System is grounded and on standby. It can be launched any time.
    *   System is active and might be already airborne. Motors are engaged.
    *   System is in a non-normal flight mode. It can however still navigate.
    *   System is in a non-normal flight mode. It lost control over parts or 
    *   over the whole airframe. It is in mayday and going down.
    *   System just initialized its power-down sequence, will shut down now.
    */
    if(DEBUG == 1) {
	console.log('Heartbeat');
    } else if (DEBUG > 1) {
	console.log('Heartbeat: ' +
	    ' type: ' + message.type + 
	    ' autopilot: ' + message.autopilot + 
	    ' base_mode: ' + message.base_mode + 
	    ' custom_mode: ' + message.custom_mode + 
	    ' system_status: ' + message.system_status + 
	    ' mavlink_version: ' + message.mavlink_version
	);
    }

    vehicleState = _.extend(vehicleState, {
	type: message.type,
	autopilot: message.autopilot,
	base_mode: message.base_mode,
	custom_mode: message.custom_mode,
	system_status: message.system_status,
	mavlink_version: message.mavlink_version
    });
});

var vehicleState = {};

mavlinkParser.on('MISSION_ITEM_REACHED', function(message) {
    console.log('Mission item reached ' + message.seq);
});

mavlinkParser.on('GLOBAL_POSITION_INT', function(message) {
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
     * hdgu           Compass heading in degrees * 100, 0.0..359.99 degrees. If unknown, set to: 65535
     */
    if(DEBUG == 1) {
	console.log('Global position (int)');
    } else if (DEBUG > 1) {
	console.log('Global position (int)' + 
	    ' lat: ' + message.lat / 10000000 + 
	    ' lng: ' + message.lon/10000000 + 
	    ' alt: ' + message.alt / 1000 +
	    ' rel alt: ' + message.relative_alt / 1000 +
	    ' vx: ' + message.vx / 100 +
	    ' vy: ' + message.vy / 100 +
	    ' vz: ' + message.vz / 100 +
	    ' hdg: ' + message.hdg / 100
	);
    }

    vehicleState = _.extend(vehicleState, {
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

mavlinkParser.on('STATUS_TEXT', function(message) {
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
    if(DEBUG == 1) {
	console.log('Status text');
    } else if (DEBUG > 1) {
	console.log('Status text' + 
	    ' severity: ' + message.severity +
	    ' text: ' + message.text);
    }
});

mavlinkParser.on('PARAM_VALUE', function(message) {
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
    if(DEBUG == 1) {
	console.log('Param Value');
    } else if (DEBUG > 1) {
	console.log('Param Value' + 
	    ' param_id: ' + message.id +
	    ' param_value: ' + message.param_value +
	    ' param_type: ' + message.param_type +
	    ' param_count: ' + message.param_count +
	    ' param_index: ' + message.param_index);
    }
});

mavlinkParser.on('HIGHRES_IMU', function(message) {
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
    if(DEBUG == 1) {
        console.log('High res IMU');
    } else if (DEBUG > 1) {
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

    vehicleState = _.extend(vehicleState, {
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

mavlinkParser.on('GPS_STATUS', function(message) {
    // TODO: consider how to handle this
    vehicleState = _.extend(vehicleState, {
	satellites_visible: message.satellites_visible,
	satellite_prn: new Uint8Array(message.satellite_prn),
	satellite_used: new Uint8Array(message.satellite_used),
	satellite_elevation: new Uint8Array(message.satellite_elevation),
	satellite_azimuth: new Uint8Array(message.satellite_azimuth),
	satellite_snr: new Uint8Array(message.satellite_snr)
    });
    
    if(DEBUG == 1) {
        console.log('GPS Status');
    } else if (DEBUG > 1) {
	console.log('GPS Status: ' +
	    ' sats visible: ' + vehicleState.satellites_visible);

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

mavlinkParser.on('SYS_STATUS', function(message) {
    if(DEBUG == 1) {
	console.log('Sys Status');
    } else if (DEBUG > 1) {
	console.log('Sys Status:' +
	    ' battery voltage (millivolts): ' + message.voltage_battery + 
	    ' current (10 millamperes): ' + message.current_battery + 
	    ' remaining %: ' + message.battery_remaining + 
	    ' comm drop rate %: ' + message.drop_rate_comm + 
	    ' comm errors: ' + message.errors_com);
    }

    vehicleState = _.extend(vehicleState, {
	voltage_battery: message.voltage_battery,
	current_battery: message.current_battery,
	battery_remaining: message.battery_remaining,
	drop_rate_comm: message.drop_rate_comm,
	errors_comm: message.errors_comm
    });
});

mavlinkParser.on('ATTITUDE', function(message) {
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
    if(DEBUG == 1) {
	console.log('Attitude');
    } else if (DEBUG > 1) {
	console.log('Attitude:' + 
	    ' pitch: ' + message.pitch + 
	    ' roll: ' + message.roll + 
	    ' yaw: ' + message.yaw + 
	    ' pitch speed: ' + message.pitch.speed + 
	    ' rollspeed: ' + message.rollspeed + 
	    ' yaw speed: ' + message.yawspeed);
    }

    vehicleState = _.extend(vehicleState, {
	pitch: message.pitch,
	roll: message.roll,
	yaw: message.yaw,
	pitchspeed: message.pitchspeed,
	rollspeed: message.rollspeed,
	yawspeed: message.yawspeed
    });
});

mavlinkParser.on('VFR_HUD', function(message) {
    /* Metrics typically displayed on a HUD for fixed wing aircraft
     *
     * airspeed    Current airspeed in m/s
     * groundspeed Current ground speed in m/s
     * heading     Current heading in degrees, in compass units (0..360, 0=north)
     * throttle    Current throttle setting in integer percent, 0 to 100
     * alt         Current altitude (MSL), in meters
     * climb       Current climb rate in meters/second
     */
    if(DEBUG == 1) {
	console.log('VFR HUD');
    } else if (DEBUG > 1) {
	console.log('VFR HUD:' + 
	    ' air speed: ' + message.airspeed + 
	    ' ground speed: ' + message.groundspeed + 
	    ' heading: ' + message.heading + 
	    ' throttle: ' + message.throttle + 
	    ' climb: ' + message.climb);
    }

    vehicleState = _.extend(vehicleState, {
	airspeed: message.airspeed,
	groundspeed: message.groundspeed,
	heading: message.heading,
	throttle: message.throttle,
	climb: message.climb
    });
});

mavlinkParser.on('GPS_RAW_INT', function(message) {
    if(DEBUG == 1) {
	console.log('GPS Raw (int)');
    } else if (DEBUG > 1) {
	console.log('GPS Raw (int):' + 
	    ' lat: ' + message.lat + 
	    ' lng: ' + message.lng + 
	    ' alt: ' + message.alt + 
	    ' eph: ' + message.eph + 
	    ' epv: ' + message.epv + 
	    ' vel: ' + message.vel + 
	    ' cog: ' + message.cog);
    }

    vehicleState = _.extend(vehicleState, {
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

